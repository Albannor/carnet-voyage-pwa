import { importIssue, type ImportIssue } from './errors'
import type {
  AllowedResourceMediaType,
  PackageManifestV1,
  PackageResourceDocument,
} from './packageManifest'
import { sha256Hex } from './sha256'

export interface ImportedResource {
  readonly id: string
  readonly path: string
  readonly mediaType: AllowedResourceMediaType
  readonly bytes: Uint8Array
}

export type ResourceValidationResult =
  | { valid: true; resources: readonly ImportedResource[]; issues: [] }
  | { valid: false; issues: ImportIssue[] }

const specialFiles = new Set([
  'manifest.json',
  'voyage.json',
  'guide-standalone.html',
])

function extensionMatches(resource: PackageResourceDocument) {
  const path = resource.path.toLowerCase()

  switch (resource.mediaType) {
    case 'image/png':
      return path.startsWith('assets/') && path.endsWith('.png')
    case 'image/jpeg':
      return (
        path.startsWith('assets/') &&
        (path.endsWith('.jpg') || path.endsWith('.jpeg'))
      )
    case 'image/webp':
      return path.startsWith('assets/') && path.endsWith('.webp')
    case 'application/pdf':
      return path.startsWith('documents/') && path.endsWith('.pdf')
  }
}

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((byte, index) => bytes[index] === byte)
}

function contentMatches(
  mediaType: AllowedResourceMediaType,
  bytes: Uint8Array,
) {
  switch (mediaType) {
    case 'image/png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff])
    case 'image/webp':
      return (
        startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      )
    case 'application/pdf':
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])
  }
}

export function undeclaredFileIssues(
  manifest: PackageManifestV1,
  files: ReadonlyMap<string, Uint8Array>,
) {
  const declaredPaths = new Set(
    manifest.resources.map((resource) => resource.path),
  )

  return Array.from(files.keys()).flatMap((path) => {
    if (specialFiles.has(path) || declaredPaths.has(path)) {
      return []
    }

    return [
      importIssue(
        'resource',
        'RESOURCE_UNDECLARED',
        `Le fichier « ${path} » n'est pas déclaré dans le manifest.`,
        {
          file: path,
          hint: 'Déclarez toute ressource passive autorisée ou retirez ce fichier du paquet.',
        },
      ),
    ]
  })
}

export async function validatePackageResources(
  manifest: PackageManifestV1,
  files: ReadonlyMap<string, Uint8Array>,
): Promise<ResourceValidationResult> {
  const issues = undeclaredFileIssues(manifest, files)
  const resources: ImportedResource[] = []

  for (let index = 0; index < manifest.resources.length; index += 1) {
    const resource = manifest.resources[index]!
    const field = `/resources/${index}`
    const bytes = files.get(resource.path)

    if (!extensionMatches(resource)) {
      issues.push(
        importIssue(
          'resource',
          'RESOURCE_TYPE_UNSUPPORTED',
          `Le chemin ou l'extension de « ${resource.path} » ne correspond pas à son type autorisé.`,
          {
            file: resource.path,
            field: `${field}/mediaType`,
            hint: 'Placez les images dans assets/ et les PDF dans documents/ avec une extension cohérente.',
          },
        ),
      )
      continue
    }

    if (!bytes) {
      issues.push(
        importIssue(
          'resource',
          'RESOURCE_MISSING',
          `La ressource déclarée « ${resource.path} » est absente de l'archive.`,
          {
            file: resource.path,
            field: `${field}/path`,
            hint: 'Ajoutez la ressource au ZIP ou retirez sa déclaration.',
          },
        ),
      )
      continue
    }

    if (bytes.length !== resource.size) {
      issues.push(
        importIssue(
          'resource',
          'RESOURCE_SIZE_MISMATCH',
          `La taille de « ${resource.path} » ne correspond pas au manifest.`,
          {
            file: resource.path,
            field: `${field}/size`,
            hint: 'Recalculez la taille déclarée à partir du fichier final.',
          },
        ),
      )
      continue
    }

    if (!contentMatches(resource.mediaType, bytes)) {
      issues.push(
        importIssue(
          'resource',
          'RESOURCE_CONTENT_MISMATCH',
          `Le contenu de « ${resource.path} » ne correspond pas au type déclaré.`,
          {
            file: resource.path,
            field: `${field}/mediaType`,
            hint: 'Utilisez un fichier passif valide dans le format déclaré.',
          },
        ),
      )
      continue
    }

    let actualHash: string
    try {
      actualHash = await sha256Hex(bytes)
    } catch {
      issues.push(
        importIssue(
          'resource',
          'RESOURCE_HASH_MISMATCH',
          `L'empreinte de « ${resource.path} » ne peut pas être vérifiée.`,
          {
            file: resource.path,
            field: `${field}/sha256`,
            hint: 'Réessayez dans un navigateur prenant en charge SHA-256.',
          },
        ),
      )
      continue
    }

    if (actualHash !== resource.sha256) {
      issues.push(
        importIssue(
          'resource',
          'RESOURCE_HASH_MISMATCH',
          `L'empreinte SHA-256 de « ${resource.path} » est incorrecte.`,
          {
            file: resource.path,
            field: `${field}/sha256`,
            hint: 'Recalculez l’empreinte après toute modification de la ressource.',
          },
        ),
      )
      continue
    }

    resources.push({
      id: resource.id,
      path: resource.path,
      mediaType: resource.mediaType,
      bytes,
    })
  }

  return issues.length > 0
    ? { valid: false, issues }
    : { valid: true, resources, issues: [] }
}
