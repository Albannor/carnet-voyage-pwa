import type {
  Travel,
  TravelIllustration,
  TravelIllustrationProvenance,
} from '../../../domain/voyage/model'
import { toTravelV1_2 } from '../v1_2/toTravel'
import type {
  IllustrationDocumentV1_3,
  IllustrationProvenanceDocumentV1_3,
  TravelDocumentV1_3,
} from './document'

function toProvenance(
  provenance: IllustrationProvenanceDocumentV1_3,
): TravelIllustrationProvenance {
  if (provenance.type === 'licensed') return { ...provenance }
  if (provenance.type === 'user-provided') return { ...provenance }
  return { ...provenance }
}

function toIllustration(
  illustration: IllustrationDocumentV1_3,
): TravelIllustration {
  return {
    id: illustration.id,
    resourceId: illustration.resourceId,
    alt: illustration.alt,
    caption: illustration.caption,
    provenance: toProvenance(illustration.provenance),
  }
}

export function toTravelV1_3(document: TravelDocumentV1_3): Travel {
  const normalized = toTravelV1_2({
    ...document,
    contentModelVersion: '1.2.0',
  })
  const sourceDays = new Map(document.days.map((day) => [day.id, day]))

  return {
    ...normalized,
    contentVersion: document.contentModelVersion,
    days: normalized.days.map((day) => {
      const sourceDay = sourceDays.get(day.id)
      const sourceSteps = new Map(
        (sourceDay?.steps ?? []).map((step) => [step.id, step]),
      )
      return {
        ...day,
        illustrationIds: sourceDay?.illustrationIds ?? [],
        steps: day.steps.map((step) => ({
          ...step,
          illustrationIds: sourceSteps.get(step.id)?.illustrationIds ?? [],
        })),
      }
    }),
    illustrations: (document.illustrations ?? []).map(toIllustration),
    coverIllustrationId: document.coverIllustrationId,
  }
}
