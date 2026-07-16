import type { TravelIllustration } from '../domain/voyage/model'
import { isAllowedImageMediaType } from '../import/packageManifest'
import type { PersistedTravelResource } from '../persistence/model'
import type { TravelLibraryRepository } from '../persistence/repository'

export type TravelCoverLoadResult =
  | { readonly status: 'absent' }
  | {
      readonly status: 'ready'
      readonly illustration: TravelIllustration
      readonly resource: PersistedTravelResource
    }
  | { readonly status: 'error'; readonly message: string }

export async function loadTravelCover(
  repository: TravelLibraryRepository,
  travelId: string,
): Promise<TravelCoverLoadResult> {
  const persistedTravel = await repository.getTravel(travelId)
  if (!persistedTravel.ok) {
    return { status: 'error', message: persistedTravel.error.message }
  }

  const coverIllustrationId = persistedTravel.value.travel.coverIllustrationId
  if (!coverIllustrationId) return { status: 'absent' }

  const illustration = persistedTravel.value.travel.illustrations.find(
    (candidate) => candidate.id === coverIllustrationId,
  )
  if (!illustration) {
    return {
      status: 'error',
      message: 'La couverture déclarée est introuvable dans ce voyage.',
    }
  }

  const resource = await repository.getResource(travelId, illustration.resourceId)
  if (!resource.ok) {
    return { status: 'error', message: resource.error.message }
  }
  if (!isAllowedImageMediaType(resource.value.mediaType)) {
    return {
      status: 'error',
      message: 'La couverture locale n’est pas une image passive autorisée.',
    }
  }

  return { status: 'ready', illustration, resource: resource.value }
}
