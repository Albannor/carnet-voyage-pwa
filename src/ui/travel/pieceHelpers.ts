import type { TravelPiece, TravelPieceAttachment } from '../../application/travelPieces'
import { userPieceFormatLabel } from '../../application/userPieces'
import type { TravelDay } from '../../domain/voyage/model'
import { formatCompactDate } from '../travelDates'
import type { TravelView } from './consultationTypes'

export function pieceAttachmentText(
  attachment: TravelPieceAttachment,
  groupDayId: string | undefined,
  locale: string,
) {
  const date = attachment.day.id === groupDayId
    ? ''
    : ` · ${formatCompactDate(attachment.day.date, locale)}`
  if (attachment.type === 'day') return `Toute la journée${date}`
  const time = attachment.step.startsAt ? `${attachment.step.startsAt} · ` : ''
  return `Étape ${time}${attachment.step.title}${date}`
}

export function pieceFormat(piece: TravelPiece) {
  if (piece.kind === 'document') return 'PDF'
  if (piece.kind === 'reservation') return 'Réservation'
  return userPieceFormatLabel(piece.added.mediaType)
}

export function pieceOrigin(piece: TravelPiece) {
  return piece.origin === 'user' ? 'Ajoutée' : 'Dossier'
}

export function isImagePiece(piece: TravelPiece) {
  return piece.kind === 'added' && piece.added.mediaType !== 'application/pdf'
}

export interface PieceRowProps {
  piece: TravelPiece
  groupDayId?: string
  locale: string
  missingLocally: boolean
  /** Remplace la liste des rattachements lorsque le contexte la rend redondante. */
  detail?: string
}

export function pieceAttachmentsText({ piece, groupDayId, locale, detail }: PieceRowProps) {
  if (detail) return detail
  return piece.attachments.length === 0
    ? 'Tout le voyage'
    : piece.attachments
      .map((attachment) => pieceAttachmentText(attachment, groupDayId, locale))
      .join(' ; ')
}

export function pieceView(piece: TravelPiece): TravelView {
  return { kind: 'piece', pieceKind: piece.kind, pieceId: piece.id }
}

/** Nom accessible ponctué : les fragments visuels ne sont pas collés entre eux. */
export function pieceRowLabel(props: PieceRowProps) {
  const { piece, missingLocally } = props
  return [
    `Voir la fiche ${piece.label}`,
    pieceAttachmentsText(props),
    `${pieceFormat(piece)}, ${pieceOrigin(piece)}${missingLocally ? ', absent de cet appareil' : ''}`,
  ].join(' — ')
}

export function missingLocally(piece: TravelPiece, localResourceIds: ReadonlySet<string> | undefined) {
  return piece.kind === 'document'
    && localResourceIds !== undefined
    && !localResourceIds.has(piece.document.resourceId)
}

export function accommodationElementId(accommodationId: string) {
  return `accommodation-${accommodationId}`
}

/** Rattachements d’une pièce limités à la journée affichée. */
export function dayAttachmentsText(piece: TravelPiece, day: TravelDay, locale: string) {
  return piece.attachments
    .filter((attachment) => attachment.day.id === day.id)
    .map((attachment) => pieceAttachmentText(attachment, day.id, locale))
    .join(' ; ')
}

export function attachmentTarget(attachment: TravelPieceAttachment): TravelView {
  return attachment.type === 'day'
    ? { kind: 'day', dayId: attachment.day.id }
    : { kind: 'step', stepId: attachment.step.id }
}

export function documentStorageText(present: boolean | undefined) {
  if (present === undefined) return 'Stockage local du voyage, non vérifié'
  return present
    ? 'Sur cet appareil, disponible hors connexion'
    : 'Absent de cet appareil'
}

export function formatAddedDate(timestamp: string, locale: string) {
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime())
    ? undefined
    : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' })
      .format(date)
}
