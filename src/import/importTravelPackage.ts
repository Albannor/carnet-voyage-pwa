import { validateTravelDocumentForVersion } from '../contracts/voyage/registry'
import type { Travel } from '../domain/voyage/model'
import { validateTravel } from '../domain/voyage/validation'
import { importIssue, type ImportFailureKind, type ImportIssue } from './errors'
import { IMPORT_LIMITS } from './limits'
import { validatePackageManifest } from './manifestValidation'
import {
  hasTravelNormalizer,
  normalizeTravelDocument,
} from './migrations/registry'
import {
  PACKAGE_FORMAT_VERSION,
  type PackageManifestV1,
} from './packageManifest'
import {
  undeclaredFileIssues,
  validatePackageResources,
  type ImportedResource,
} from './resourceValidation'
import { readZipArchive } from './zipArchive'
import { validateTravelResourceReferences } from './travelResourceReferences'

const ACCEPTED_ZIP_MEDIA_TYPES = new Set([
  '',
  'application/zip',
  'application/x-zip-compressed',
])

export interface SelectedPackageFile {
  readonly name: string
  readonly type: string
  readonly size: number
  arrayBuffer(): Promise<ArrayBuffer>
}

export interface ValidatedTravelPackage {
  readonly manifest: PackageManifestV1
  readonly travel: Travel
  readonly resources: readonly ImportedResource[]
  readonly guideStandalonePresent: boolean
}

export type TravelPackageImportResult =
  | {
      ok: true
      package: ValidatedTravelPackage
    }
  | {
      ok: false
      kind: ImportFailureKind
      errors: readonly ImportIssue[]
    }

function failure(errors: readonly ImportIssue[]): TravelPackageImportResult {
  const firstError = errors[0]
  return {
    ok: false,
    kind: firstError?.kind ?? 'validation',
    errors:
      errors.length > 0
        ? errors
        : [
            importIssue(
              'validation',
              'ARCHIVE_CORRUPTED',
              "Le paquet n'a pas pu être validé.",
              { hint: 'Recréez le paquet puis réessayez.' },
            ),
          ],
  }
}

function parseJson(bytes: Uint8Array, file: string) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { ok: true as const, value: JSON.parse(text) as unknown }
  } catch {
    return {
      ok: false as const,
      issue: importIssue(
        'validation',
        'JSON_INVALID',
        `${file} n'est pas un document JSON UTF-8 valide.`,
        {
          file,
          hint: 'Corrigez la syntaxe JSON et l’encodage UTF-8 du fichier.',
        },
      ),
    }
  }
}

function stringField(input: unknown, field: string) {
  if (!input || typeof input !== 'object') {
    return undefined
  }
  const value = (input as Record<string, unknown>)[field]
  return typeof value === 'string' ? value : undefined
}

function mapTravelIssues(
  issues: readonly {
    code: ImportIssue['code']
    path: string
    message: string
  }[],
) {
  return issues.map((issue) =>
    importIssue('validation', issue.code, issue.message, {
      file: 'voyage.json',
      field: issue.path,
      hint: 'Corrigez le champ indiqué dans voyage.json.',
    }),
  )
}

function validateDirectoryEntries(paths: readonly string[]) {
  return paths.flatMap((path) => {
    if (path.startsWith('assets/') || path.startsWith('documents/')) {
      return []
    }

    return [
      importIssue(
        'resource',
        'RESOURCE_UNDECLARED',
        `Le dossier « ${path} » n'appartient pas à la structure autorisée.`,
        {
          file: path,
          hint: 'Utilisez uniquement les répertoires assets/ et documents/.',
        },
      ),
    ]
  })
}

export async function importTravelPackage(
  selectedFile: SelectedPackageFile,
): Promise<TravelPackageImportResult> {
  if (
    !selectedFile.name.toLowerCase().endsWith('.zip') ||
    !ACCEPTED_ZIP_MEDIA_TYPES.has(selectedFile.type.toLowerCase())
  ) {
    return failure([
      importIssue(
        'validation',
        'FILE_TYPE_UNSUPPORTED',
        "Le fichier sélectionné n'est pas une archive ZIP acceptée.",
        {
          file: selectedFile.name,
          hint: 'Sélectionnez un fichier portant l’extension .zip.',
        },
      ),
    ])
  }

  if (selectedFile.size > IMPORT_LIMITS.maxZipSize) {
    return failure([
      importIssue(
        'limit',
        'FILE_SIZE_EXCEEDED',
        "L'archive ZIP dépasse la taille maximale autorisée.",
        {
          file: selectedFile.name,
          hint: `Limitez l’archive à ${IMPORT_LIMITS.maxZipSize} octets.`,
        },
      ),
    ])
  }

  let archiveBytes: Uint8Array
  try {
    archiveBytes = new Uint8Array(await selectedFile.arrayBuffer())
  } catch {
    return failure([
      importIssue(
        'corrupt-archive',
        'ARCHIVE_CORRUPTED',
        "L'archive ZIP ne peut pas être lue.",
        {
          file: selectedFile.name,
          hint: 'Sélectionnez de nouveau le fichier ou recréez le ZIP.',
        },
      ),
    ])
  }

  if (archiveBytes.length !== selectedFile.size) {
    return failure([
      importIssue(
        'corrupt-archive',
        'ARCHIVE_CORRUPTED',
        "La taille lue de l'archive ne correspond pas au fichier sélectionné.",
        {
          file: selectedFile.name,
          hint: 'Sélectionnez de nouveau le fichier.',
        },
      ),
    ])
  }

  const archive = readZipArchive(archiveBytes)
  if (!archive.ok) {
    return failure([archive.issue])
  }

  const directoryIssues = validateDirectoryEntries(
    archive.entries
      .filter((entry) => entry.directory)
      .map((entry) => entry.path),
  )
  if (directoryIssues.length > 0) {
    return failure(directoryIssues)
  }

  const manifestBytes = archive.files.get('manifest.json')
  const travelBytes = archive.files.get('voyage.json')
  const missingFiles = [
    !manifestBytes ? 'manifest.json' : undefined,
    !travelBytes ? 'voyage.json' : undefined,
  ].filter((file): file is string => Boolean(file))

  if (missingFiles.length > 0) {
    return failure(
      missingFiles.map((file) =>
        importIssue(
          'validation',
          'REQUIRED_FILE_MISSING',
          `Le fichier obligatoire « ${file} » est absent du paquet.`,
          { file, hint: `Ajoutez ${file} à la racine de l’archive.` },
        ),
      ),
    )
  }

  const parsedManifest = parseJson(manifestBytes!, 'manifest.json')
  if (!parsedManifest.ok) {
    return failure([parsedManifest.issue])
  }

  const packageVersion = stringField(
    parsedManifest.value,
    'packageFormatVersion',
  )
  if (packageVersion && packageVersion !== PACKAGE_FORMAT_VERSION) {
    return failure([
      importIssue(
        'incompatible-version',
        'PACKAGE_VERSION_UNSUPPORTED',
        `La version de paquet ${packageVersion} n'est pas prise en charge.`,
        {
          file: 'manifest.json',
          field: '/packageFormatVersion',
          hint: `Utilisez le format de paquet ${PACKAGE_FORMAT_VERSION}.`,
        },
      ),
    ])
  }

  const manifestResult = validatePackageManifest(parsedManifest.value)
  if (!manifestResult.valid) {
    return failure(manifestResult.issues)
  }
  const manifest = manifestResult.manifest

  if (!hasTravelNormalizer(manifest.travelModelVersion)) {
    return failure([
      importIssue(
        'incompatible-version',
        'TRAVEL_VERSION_UNSUPPORTED',
        `La version de voyage ${manifest.travelModelVersion} n'est pas prise en charge.`,
        {
          file: 'manifest.json',
          field: '/travelModelVersion',
          hint: 'Utilisez voyage.json 1.0.0, 1.1.0, 1.2.0 ou 1.3.0.',
        },
      ),
    ])
  }

  const inventoryIssues = undeclaredFileIssues(manifest, archive.files)
  if (inventoryIssues.length > 0) {
    return failure(inventoryIssues)
  }

  const parsedTravel = parseJson(travelBytes!, 'voyage.json')
  if (!parsedTravel.ok) {
    return failure([parsedTravel.issue])
  }

  const travelVersion = stringField(parsedTravel.value, 'contentModelVersion')
  if (travelVersion && travelVersion !== manifest.travelModelVersion) {
    return failure([
      importIssue(
        'incompatible-version',
        'TRAVEL_VERSION_MISMATCH',
        'La version déclarée par manifest.json ne correspond pas à voyage.json.',
        {
          file: 'voyage.json',
          field: '/contentModelVersion',
          hint: 'Alignez les deux versions avant de recréer le paquet.',
        },
      ),
    ])
  }

  const contractResult = validateTravelDocumentForVersion(
    manifest.travelModelVersion,
    parsedTravel.value,
  )
  if (!contractResult.valid) {
    return failure(mapTravelIssues(contractResult.issues))
  }

  if (manifest.id !== contractResult.document.id) {
    return failure([
      importIssue(
        'validation',
        'PACKAGE_ID_MISMATCH',
        "L'identifiant du manifest ne correspond pas à celui du voyage.",
        {
          file: 'manifest.json',
          field: '/id',
          hint: 'Utilisez le même identifiant stable dans manifest.json et voyage.json.',
        },
      ),
    ])
  }

  const normalization = normalizeTravelDocument(
    manifest.travelModelVersion,
    contractResult.document,
  )
  if (!normalization.ok) {
    return failure([normalization.issue])
  }

  const semanticIssues = validateTravel(normalization.travel)
  if (semanticIssues.length > 0) {
    return failure(mapTravelIssues(semanticIssues))
  }

  const resourceReferenceIssues = validateTravelResourceReferences(
    normalization.travel,
    manifest,
  )
  if (resourceReferenceIssues.length > 0) {
    return failure(resourceReferenceIssues)
  }

  const resourceResult = await validatePackageResources(manifest, archive.files)
  if (!resourceResult.valid) {
    return failure(resourceResult.issues)
  }

  return {
    ok: true,
    package: {
      manifest,
      travel: normalization.travel,
      resources: resourceResult.resources,
      guideStandalonePresent: archive.files.has('guide-standalone.html'),
    },
  }
}
