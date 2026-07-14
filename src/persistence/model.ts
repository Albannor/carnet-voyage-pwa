import type { Travel } from '../domain/voyage/model'
import type { AllowedResourceMediaType } from '../import/packageManifest'

export const INTERNAL_TRAVEL_MODEL_VERSION = 1 as const

export interface TravelLibraryEntry {
  readonly travelId: string
  readonly packageId: string
  readonly title: string
  readonly destination: string
  readonly startDate: string
  readonly endDate: string
  readonly sourcePackageVersion: string
  readonly sourceTravelVersion: string
  readonly importedAt: string
  readonly storageSchemaVersion: number
  readonly internalModelVersion: number
}

export interface PersistedTravel {
  readonly metadata: TravelLibraryEntry
  readonly travel: Travel
}

export interface PersistedTravelContent {
  readonly travelId: string
  readonly internalModelVersion: number
  readonly travel: Travel
}

export interface PersistedTravelResource {
  readonly travelId: string
  readonly resourceId: string
  readonly path: string
  readonly mediaType: AllowedResourceMediaType
  readonly size: number
  readonly sha256: string
  readonly bytes: Uint8Array
}

/**
 * Forme réservée au futur état personnel. Aucun cas d'usage de notes ou de
 * checklist n'est exposé à l'étape 4 ; seul l'espace isolé est créé.
 */
export interface PersistedPersonalState {
  readonly travelId: string
  readonly namespace: string
  readonly key: string
  readonly value: unknown
  readonly updatedAt: string
}
