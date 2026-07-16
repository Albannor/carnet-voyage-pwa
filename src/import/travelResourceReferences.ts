import type { Travel } from '../domain/voyage/model'
import { importIssue, type ImportIssue } from './errors'
import type { PackageManifestV1 } from './packageManifest'
import { isAllowedImageMediaType } from './packageManifest'

export function validateTravelResourceReferences(
  travel: Travel,
  manifest: PackageManifestV1,
): ImportIssue[] {
  const resources = new Map(
    manifest.resources.map((resource) => [resource.id, resource]),
  )

  const documentIssues = travel.documents.flatMap((document, index) => {
    const resource = resources.get(document.resourceId)
    if (!resource) {
      return [
        importIssue(
          'resource',
          'DOCUMENT_RESOURCE_UNKNOWN',
          `Le document « ${document.label} » référence une ressource absente du manifest.`,
          {
            file: 'voyage.json',
            field: `/documents/${index}/resourceId`,
            hint: 'Déclarez la ressource PDF dans manifest.json avec le même identifiant.',
          },
        ),
      ]
    }

    return resource.mediaType === 'application/pdf'
      ? []
      : [
          importIssue(
            'resource',
            'DOCUMENT_RESOURCE_NOT_PDF',
            `La ressource du document « ${document.label} » n'est pas un PDF passif.`,
            {
              file: 'voyage.json',
              field: `/documents/${index}/resourceId`,
              hint: 'Référencez une ressource application/pdf placée dans documents/.',
            },
          ),
        ]
  })

  const illustrationIssues = travel.illustrations.flatMap((illustration, index) => {
    const resource = resources.get(illustration.resourceId)
    if (!resource) {
      return [
        importIssue(
          'resource',
          'ILLUSTRATION_RESOURCE_UNKNOWN',
          `L’illustration « ${illustration.alt} » référence une ressource absente du manifest.`,
          {
            file: 'voyage.json',
            field: `/illustrations/${index}/resourceId`,
            hint: 'Déclarez la ressource image dans manifest.json avec le même identifiant.',
          },
        ),
      ]
    }

    return isAllowedImageMediaType(resource.mediaType)
      ? []
      : [
          importIssue(
            'resource',
            'ILLUSTRATION_RESOURCE_NOT_IMAGE',
            `La ressource de l’illustration « ${illustration.alt} » n’est pas une image passive autorisée.`,
            {
              file: 'voyage.json',
              field: `/illustrations/${index}/resourceId`,
              hint: 'Référencez une ressource image/png, image/jpeg ou image/webp placée dans assets/.',
            },
          ),
        ]
  })

  return [...documentIssues, ...illustrationIssues]
}
