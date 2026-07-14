import Ajv2020, { type ErrorObject } from 'ajv/dist/2020'
import manifestSchema from '../../contracts/package/1.0.0/schema.json'
import { importIssue, type ImportIssue } from './errors'
import type { PackageManifestV1 } from './packageManifest'

export type ManifestValidationResult =
  | { valid: true; manifest: PackageManifestV1; issues: [] }
  | { valid: false; issues: ImportIssue[] }

const ajv = new Ajv2020({ allErrors: true, strict: true })
const validateSchema = ajv.compile(manifestSchema)

function escapeJsonPointerSegment(segment: string) {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1')
}

function errorPath(error: ErrorObject) {
  if (error.keyword === 'required') {
    const missingProperty = (error.params as { missingProperty?: unknown })
      .missingProperty

    if (typeof missingProperty === 'string') {
      return `${error.instancePath}/${escapeJsonPointerSegment(missingProperty)}`
    }
  }

  if (error.keyword === 'additionalProperties') {
    const additionalProperty = (
      error.params as { additionalProperty?: unknown }
    ).additionalProperty

    if (typeof additionalProperty === 'string') {
      return `${error.instancePath}/${escapeJsonPointerSegment(additionalProperty)}`
    }
  }

  return error.instancePath || '/'
}

function toManifestIssue(error: ErrorObject): ImportIssue {
  const field = errorPath(error)
  const resourceTypeError =
    error.keyword === 'enum' && /\/resources\/\d+\/mediaType$/.test(field)

  return resourceTypeError
    ? importIssue(
        'resource',
        'RESOURCE_TYPE_UNSUPPORTED',
        "Le type déclaré pour cette ressource n'est pas autorisé.",
        {
          file: 'manifest.json',
          field,
          hint: 'Utilisez uniquement PNG, JPEG, WebP ou PDF.',
        },
      )
    : importIssue(
        'validation',
        'MANIFEST_SCHEMA_INVALID',
        `Le manifest ne respecte pas le contrat : ${error.message ?? 'champ invalide'}.`,
        {
          file: 'manifest.json',
          field,
          hint: 'Corrigez le champ indiqué selon le contrat de paquet 1.0.0.',
        },
      )
}

function duplicateManifestIssues(manifest: PackageManifestV1) {
  const issues: ImportIssue[] = []
  const resourceIds = new Set<string>()
  const resourcePaths = new Set<string>()

  manifest.resources.forEach((resource, index) => {
    if (resourceIds.has(resource.id)) {
      issues.push(
        importIssue(
          'resource',
          'RESOURCE_ID_DUPLICATE',
          `L'identifiant de ressource « ${resource.id} » est utilisé plusieurs fois.`,
          {
            file: 'manifest.json',
            field: `/resources/${index}/id`,
            hint: 'Attribuez un identifiant stable distinct à chaque ressource.',
          },
        ),
      )
    }
    resourceIds.add(resource.id)

    const comparablePath = resource.path.toLowerCase()
    if (resourcePaths.has(comparablePath)) {
      issues.push(
        importIssue(
          'resource',
          'RESOURCE_PATH_DUPLICATE',
          `Le chemin de ressource « ${resource.path} » est déclaré plusieurs fois ou entre en collision de casse.`,
          {
            file: 'manifest.json',
            field: `/resources/${index}/path`,
            hint: 'Chaque ressource doit avoir un chemin unique, y compris sans tenir compte de la casse.',
          },
        ),
      )
    }
    resourcePaths.add(comparablePath)
  })

  return issues
}

export function validatePackageManifest(
  input: unknown,
): ManifestValidationResult {
  if (!validateSchema(input)) {
    return {
      valid: false,
      issues: (validateSchema.errors ?? []).map(toManifestIssue),
    }
  }

  const manifest = input as unknown as PackageManifestV1
  const issues = duplicateManifestIssues(manifest)

  return issues.length > 0
    ? { valid: false, issues }
    : { valid: true, manifest, issues: [] }
}
