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

/** Pièces ajoutées par l’utilisateur, stockées à part du contenu importé. */
export const USER_PIECE_RECORD_VERSION = 1 as const
export const MAX_USER_PIECE_BYTES = 10 * 1024 * 1024
export const MAX_USER_PIECE_TITLE_LENGTH = 120
export const MAX_USER_PIECES_PER_TRAVEL = 100

export const USER_PIECE_MEDIA_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const
export type UserPieceMediaType = (typeof USER_PIECE_MEDIA_TYPES)[number]

/** Catégorie choisie explicitement par l’utilisateur, jamais déduite d’un titre. */
export const USER_PIECE_KINDS = [
  'transport',
  'accommodation',
  'activity',
  'insurance',
  'other',
] as const
export type UserPieceKind = (typeof USER_PIECE_KINDS)[number]

export type UserPieceAttachment =
  | { readonly type: 'travel' }
  | { readonly type: 'day'; readonly dayId: string }
  | { readonly type: 'step'; readonly stepId: string }

export interface UserPieceMetadata {
  readonly travelId: string
  readonly pieceId: string
  readonly version: typeof USER_PIECE_RECORD_VERSION
  readonly title: string
  readonly kind: UserPieceKind
  readonly attachment: UserPieceAttachment
  readonly mediaType: UserPieceMediaType
  readonly size: number
  readonly createdAt: string
  readonly updatedAt: string
}

export interface PersistedUserPieceFile {
  readonly travelId: string
  readonly pieceId: string
  readonly mediaType: UserPieceMediaType
  readonly bytes: Uint8Array
}

export interface NewUserPiece {
  readonly title: string
  readonly kind: UserPieceKind
  readonly attachment: UserPieceAttachment
  readonly mediaType: UserPieceMediaType
  readonly bytes: Uint8Array
}

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((byte, index) => bytes[index] === byte)
}

/**
 * Format réel d’un fichier ajouté, lu dans sa signature binaire. Le nom du
 * fichier et le type annoncé par le navigateur ne sont jamais utilisés.
 */
export function detectUserPieceMediaType(bytes: Uint8Array): UserPieceMediaType | undefined {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
    && startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])
  ) return 'image/webp'
  return undefined
}

export function normalizeUserPieceTitle(title: string) {
  return title.replace(/\s+/g, ' ').trim()
}

export function isValidUserPieceTitle(title: string) {
  const normalized = normalizeUserPieceTitle(title)
  return normalized.length > 0 && normalized.length <= MAX_USER_PIECE_TITLE_LENGTH
}
