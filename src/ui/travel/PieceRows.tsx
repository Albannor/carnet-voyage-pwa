import { piecesForDay, type TravelPiece } from '../../application/travelPieces'
import type { Travel, TravelDay } from '../../domain/voyage/model'
import { ChevronRightIcon, FileIcon, ImageIcon, PlusIcon, TicketIcon } from '../icons'
import type { TravelView } from './consultationTypes'
import {
  dayAttachmentsText,
  isImagePiece,
  pieceAttachmentsText,
  pieceFormat,
  pieceOrigin,
  pieceRowLabel,
  pieceView,
  type PieceRowProps,
} from './pieceHelpers'

export function PieceIcon({ piece, size = 22 }: { piece: TravelPiece; size?: number }) {
  const className = piece.kind === 'reservation'
    ? 'piece-icon piece-icon-reservation'
    : piece.kind === 'added'
      ? 'piece-icon piece-icon-added'
      : 'piece-icon piece-icon-document'
  return (
    <span className={className} aria-hidden="true">
      {piece.kind === 'reservation'
        ? <TicketIcon size={size} />
        : isImagePiece(piece)
          ? <ImageIcon size={size} />
          : <FileIcon size={size} />}
    </span>
  )
}

export function OriginBadge({ piece }: { piece: TravelPiece }) {
  return (
    <span className={piece.origin === 'user' ? 'piece-badge piece-badge-added' : 'piece-badge'}>
      {pieceOrigin(piece)}
    </span>
  )
}

function PieceRowContent(props: PieceRowProps) {
  const { piece, missingLocally } = props
  return (
    <>
      <PieceIcon piece={piece} />
      <span className="piece-text">
        <span className="piece-title">{piece.label}</span>
        <span className="piece-attachments">{pieceAttachmentsText(props)}</span>
        <span className="piece-badges">
          <span className="piece-badge">{pieceFormat(piece)}</span>
          <OriginBadge piece={piece} />
          {missingLocally && (
            <span className="piece-badge piece-badge-warning">Absent de cet appareil</span>
          )}
        </span>
      </span>
      <ChevronRightIcon size={20} className="piece-chevron" />
    </>
  )
}

export function PieceRowButton({
  onNavigate,
  ...props
}: PieceRowProps & { onNavigate(view: TravelView): void }) {
  return (
    <button
      className="piece-row"
      type="button"
      aria-label={pieceRowLabel(props)}
      onClick={() => onNavigate(pieceView(props.piece))}
    >
      <PieceRowContent {...props} />
    </button>
  )
}

/** Mène depuis une étape à la fiche de son hébergement, dans Pièces. */
export function AccommodationLink({
  accommodationId,
  stepTitle,
  onNavigate,
}: {
  accommodationId: string
  stepTitle: string
  onNavigate(view: TravelView): void
}) {
  return (
    <button
      className="text-button"
      type="button"
      aria-label={`Voir l’hébergement associé à ${stepTitle}`}
      onClick={() => onNavigate({ kind: 'pieces', accommodationId })}
    >
      Voir l’hébergement
    </button>
  )
}

export function AddPieceButton({
  label,
  onClick,
}: {
  label: string
  onClick(): void
}) {
  return (
    <button className="add-piece-button" type="button" onClick={onClick}>
      <PlusIcon size={20} />
      <span>{label}</span>
    </button>
  )
}

/** Bande « Pièces du jour » : accès rapide aux fiches des pièces de la journée. */
export function DayPieces({
  travel,
  day,
  pieces: travelPieces,
  onNavigate,
}: {
  travel: Travel
  day: TravelDay
  pieces: readonly TravelPiece[]
  onNavigate(view: TravelView): void
}) {
  const pieces = piecesForDay(travelPieces, day.id)
  if (pieces.length === 0) return null
  const titleId = `day-pieces-${day.id}`

  return (
    <section className="day-pieces" aria-labelledby={titleId}>
      <div className="day-pieces-heading">
        <h3 id={titleId}>Pièces du jour · {pieces.length}</h3>
        <button
          className="text-button"
          type="button"
          onClick={() => onNavigate({ kind: 'pieces' })}
        >
          Toutes les pièces
        </button>
      </div>
      <ul className="day-pieces-list">
        {pieces.map((piece) => {
          const detail = dayAttachmentsText(piece, day, travel.locale)
          const format = pieceFormat(piece)
          return (
            <li key={`${piece.kind}:${piece.id}`}>
              <button
                className="day-piece-card"
                type="button"
                aria-label={[
                  `Voir la fiche ${piece.label}`,
                  detail,
                  `${format}, ${pieceOrigin(piece)}`,
                ].join(' — ')}
                onClick={() => onNavigate(pieceView(piece))}
              >
                <PieceIcon piece={piece} />
                <span className="piece-text">
                  <span className="piece-title">{piece.label}</span>
                  <span className="piece-attachments">{detail}</span>
                </span>
                <span className="day-piece-footer">
                  <span className="day-piece-format">
                    {format}
                    {piece.origin === 'user' && ' · Ajoutée'}
                  </span>
                  <ChevronRightIcon size={18} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
