import type { Travel } from '../domain/voyage/model'
import type { AllowedResourceMediaType } from '../import/packageManifest'

export const INTERNAL_TRAVEL_MODEL_VERSION = 4 as const
export const PERSONAL_STATE_RECORD_VERSION = 1 as const
export const PERSONAL_STATE_NAMESPACES = Object.freeze({
  checklist: 'checklist',
  notes: 'notes',
})
export const GENERAL_NOTE_KEY = 'general'
export const MAX_TRAVEL_NOTE_LENGTH = 10_000

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

export interface PersistedPersonalState {
  readonly travelId: string
  readonly namespace: string
  readonly key: string
  readonly value: unknown
  readonly updatedAt: string
  readonly version?: number
}

export interface PersistedChecklistItemState extends PersistedPersonalState {
  readonly namespace: typeof PERSONAL_STATE_NAMESPACES.checklist
  readonly version: typeof PERSONAL_STATE_RECORD_VERSION
  readonly value: { readonly checked: boolean }
}

export interface PersistedTravelNoteState extends PersistedPersonalState {
  readonly namespace: typeof PERSONAL_STATE_NAMESPACES.notes
  readonly key: typeof GENERAL_NOTE_KEY
  readonly version: typeof PERSONAL_STATE_RECORD_VERSION
  readonly value: { readonly text: string }
}

export interface TravelPersonalState {
  readonly checkedItemKeys: readonly string[]
  readonly note: string
}

export function checklistItemStateKey(checklistId: string, itemId: string) {
  return `${checklistId}/${itemId}`
}
