import type { TravelPieceKind } from '../../application/travelPieces'
import type { TravelDocument } from '../../domain/voyage/model'
import type {
  PersistedTravelResource,
  PersistedUserPieceFile,
  UserPieceAttachment,
} from '../../persistence/model'

export type TravelView =
  | { readonly kind: 'summary' }
  | { readonly kind: 'today' }
  | { readonly kind: 'day'; readonly dayId: string }
  | { readonly kind: 'step'; readonly stepId: string }
  /** `accommodationId` amène la fiche de cet hébergement à l’écran. */
  | { readonly kind: 'pieces'; readonly accommodationId?: string }
  | { readonly kind: 'add-piece'; readonly attachment?: UserPieceAttachment }
  | {
      readonly kind: 'piece'
      readonly pieceKind: TravelPieceKind
      readonly pieceId: string
    }
  | { readonly kind: 'preparation' }

export interface ContextActionFeedback {
  readonly status: 'success' | 'error'
  readonly message: string
}

export type PersonalSaveResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string }

export type UserPieceFileLoadResult =
  | { readonly ok: true; readonly file: PersistedUserPieceFile }
  | { readonly ok: false; readonly message: string }

export type IllustrationResourceLoadResult =
  | { readonly ok: true; readonly resource: PersistedTravelResource }
  | { readonly ok: false; readonly message: string }

export interface ActionProps {
  online: boolean
  onCopyAddress(address: string, placeLabel: string): Promise<boolean>
  onOpenDocument(document: TravelDocument): void
  onLoadIllustrationResource(
    travelId: string,
    resourceId: string,
  ): Promise<IllustrationResourceLoadResult>
}

export interface PersonalStateProps {
  checkedItemKeys: ReadonlySet<string>
  checklistFeedback: Readonly<Record<string, 'saving' | 'saved' | 'error'>>
  onToggleChecklistItem(
    checklistId: string,
    itemId: string,
    checked: boolean,
  ): void
}
