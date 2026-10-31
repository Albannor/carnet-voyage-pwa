import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { TravelPiece } from '../../application/travelPieces'
import { USER_PIECE_KIND_LABELS } from '../../application/userPieces'
import type { Travel, TravelDocument } from '../../domain/voyage/model'
import {
  MAX_USER_PIECE_TITLE_LENGTH,
  isValidUserPieceTitle,
  type UserPieceMetadata,
} from '../../persistence/model'
import type { RequestScreenWakeLock } from '../../services/screenWakeLock'
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  FileIcon,
  ImageIcon,
  PaperclipIcon,
  ShieldIcon,
  TrashIcon,
} from '../icons'
import { formatCompactDate } from '../travelDates'
import { ReservationBody } from './ConsultationActions'
import { PiecePresentation } from './PiecePresentation'
import { OriginBadge, PieceIcon } from './PieceRows'
import { capitalize } from './consultationHelpers'
import { useLocalResourceIds, useUserPieceImage } from './consultationHooks'
import type {
  PersonalSaveResult,
  TravelView,
  UserPieceFileLoadResult,
} from './consultationTypes'
import {
  attachmentTarget,
  documentStorageText,
  formatAddedDate,
  pieceAttachmentText,
  pieceFormat,
} from './pieceHelpers'

function RenameUserPieceForm({
  piece,
  onRename,
  onDone,
}: {
  piece: UserPieceMetadata
  onRename(title: string): Promise<PersonalSaveResult>
  onDone(message?: string): void
}) {
  const fieldId = useId()
  const [title, setTitle] = useState(piece.title)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isValidUserPieceTitle(title)) {
      setError('Donnez un titre à cette pièce.')
      return
    }
    setSaving(true)
    const result = await onRename(title)
    setSaving(false)
    if (result.ok) onDone('Pièce renommée.')
    else setError(result.message)
  }

  return (
    <form className="piece-rename-form" noValidate onSubmit={(event) => void submit(event)}>
      <div className="form-field">
        <label htmlFor={`${fieldId}-title`}>Nouveau titre</label>
        <input
          id={`${fieldId}-title`}
          type="text"
          value={title}
          maxLength={MAX_USER_PIECE_TITLE_LENGTH}
          required
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          onChange={(event) => setTitle(event.currentTarget.value)}
        />
        {error && <p id={`${fieldId}-error`} className="field-error" role="alert">{error}</p>}
      </div>
      <div className="add-piece-actions">
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer le titre'}
        </button>
        <button className="secondary-button" type="button" onClick={() => onDone()}>
          Annuler
        </button>
      </div>
    </form>
  )
}

/** Actions propres aux pièces ajoutées : jamais proposées pour une pièce du dossier. */
function UserPieceActions({
  piece,
  onRename,
  onDelete,
}: {
  piece: UserPieceMetadata
  onRename(title: string): Promise<PersonalSaveResult>
  onDelete(): Promise<PersonalSaveResult>
}) {
  const [mode, setMode] = useState<'idle' | 'rename' | 'confirm'>('idle')
  const [message, setMessage] = useState<string>()
  const [error, setError] = useState<string>()
  const confirmationRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (mode === 'confirm') confirmationRef.current?.focus()
  }, [mode])

  async function confirmDelete() {
    const result = await onDelete()
    if (!result.ok) {
      setError(result.message)
      setMode('idle')
    }
  }

  return (
    <section className="piece-sheet-actions" aria-label="Gérer cette pièce ajoutée">
      {mode === 'idle' && (
        <div className="add-piece-actions">
          <button className="secondary-button" type="button" onClick={() => {
            setMessage(undefined)
            setError(undefined)
            setMode('rename')
          }}
          >
            Renommer
          </button>
          <button className="secondary-button piece-delete-button" type="button" onClick={() => {
            setMessage(undefined)
            setError(undefined)
            setMode('confirm')
          }}
          >
            <TrashIcon size={18} />
            Supprimer
          </button>
        </div>
      )}
      {mode === 'rename' && (
        <RenameUserPieceForm
          piece={piece}
          onRename={onRename}
          onDone={(done) => {
            setMessage(done)
            setMode('idle')
          }}
        />
      )}
      {mode === 'confirm' && (
        <div
          ref={confirmationRef}
          className="delete-confirmation"
          role="group"
          tabIndex={-1}
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
        >
          <TrashIcon className="delete-confirmation-icon" />
          <div className="delete-confirmation-content">
            <p id={titleId} className="delete-confirmation-title">
              Supprimer « {piece.title} » ?
            </p>
            <p id={descriptionId}>
              Cette pièce sera supprimée de cet appareil. Cette action est définitive.
            </p>
            <div className="delete-confirmation-actions">
              <button className="danger-button" type="button" onClick={() => void confirmDelete()}>
                Supprimer définitivement
              </button>
              <button className="secondary-button" type="button" onClick={() => setMode('idle')}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
      <p className="visually-hidden" role="status">{message}</p>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
    </section>
  )
}

/**
 * Fiche d’une pièce. Une pièce du dossier est en lecture seule et n’a pas
 * d’aperçu : l’application n’embarque pas de lecteur PDF et n’affiche pas
 * d’aperçu factice. Une image ajoutée est affichée et peut être présentée.
 */
export function PieceSheetView({
  travel,
  piece,
  online,
  onNavigate,
  onOpenDocument,
  onListLocalResourceIds,
  onOpenUserPiece,
  onLoadUserPieceFile,
  onRenameUserPiece,
  onDeleteUserPiece,
  requestWakeLock,
}: {
  travel: Travel
  piece: TravelPiece
  online: boolean
  onNavigate(view: TravelView): void
  onOpenDocument(document: TravelDocument): void
  onListLocalResourceIds(travelId: string): Promise<readonly string[] | undefined>
  onOpenUserPiece(piece: UserPieceMetadata): void
  onLoadUserPieceFile: (travelId: string, pieceId: string) => Promise<UserPieceFileLoadResult>
  onRenameUserPiece(pieceId: string, title: string): Promise<PersonalSaveResult>
  onDeleteUserPiece(pieceId: string): Promise<PersonalSaveResult>
  requestWakeLock?: RequestScreenWakeLock
}) {
  const localResourceIds = useLocalResourceIds(travel.id, onListLocalResourceIds)
  const added = piece.kind === 'added' ? piece.added : undefined
  const image = useUserPieceImage(travel.id, added, onLoadUserPieceFile)
  const [presenting, setPresenting] = useState(false)
  const presentButtonRef = useRef<HTMLButtonElement>(null)
  const present = piece.kind === 'document' && localResourceIds
    ? localResourceIds.has(piece.document.resourceId)
    : undefined
  const attachmentsDetail = piece.attachments.length === 0
    ? 'Tout le voyage'
    : piece.attachments
      .map((attachment) => pieceAttachmentText(attachment, undefined, travel.locale))
      .join(' ; ')

  function closePresentation() {
    setPresenting(false)
    window.requestAnimationFrame(() => presentButtonRef.current?.focus())
  }

  return (
    <div className="consultation-view piece-sheet" aria-labelledby="piece-sheet-title">
      <button
        className="back-button"
        type="button"
        aria-label="Retour aux pièces du voyage"
        onClick={() => onNavigate({ kind: 'pieces' })}
      >
        <ChevronLeftIcon size={20} />
        <span>Pièces du voyage</span>
      </button>
      <header className="piece-sheet-header">
        <PieceIcon piece={piece} size={24} />
        <div className="piece-sheet-heading">
          <h2 id="piece-sheet-title" className="piece-sheet-title">{piece.label}</h2>
          <p className="piece-badges">
            <span className="piece-badge">{pieceFormat(piece)}</span>
            <OriginBadge piece={piece} />
          </p>
        </div>
      </header>
      {piece.kind === 'document' && (
        <>
          {piece.document.description && (
            <p className="piece-sheet-description">{piece.document.description}</p>
          )}
          <button
            className="document-button piece-sheet-open"
            type="button"
            aria-label={`Ouvrir le PDF ${piece.label}`}
            onClick={() => onOpenDocument(piece.document)}
          >
            <FileIcon size={20} />
            <span>Ouvrir le PDF</span>
          </button>
        </>
      )}
      {piece.kind === 'reservation' && (
        <div className="piece-reservation">
          <ReservationBody
            travel={travel}
            reservation={piece.reservation}
            online={online}
            onOpenDocument={onOpenDocument}
          />
        </div>
      )}
      {added && added.mediaType === 'application/pdf' && (
        <button
          className="document-button piece-sheet-open"
          type="button"
          aria-label={`Ouvrir le PDF ${piece.label}`}
          onClick={() => onOpenUserPiece(added)}
        >
          <FileIcon size={20} />
          <span>Ouvrir le PDF</span>
        </button>
      )}
      {added && added.mediaType !== 'application/pdf' && (
        <>
          {image?.status === 'ready' && (
            <figure className="piece-sheet-preview">
              <img src={image.source} alt={piece.label} />
            </figure>
          )}
          {image?.status === 'failed' && (
            <p className="notice notice-error" role="alert">
              Cette image n’a pas pu être relue sur cet appareil.
            </p>
          )}
          <button
            ref={presentButtonRef}
            className="document-button piece-sheet-open"
            type="button"
            aria-label={`Présenter ${piece.label} en plein écran`}
            disabled={image?.status !== 'ready'}
            onClick={() => setPresenting(true)}
          >
            <ImageIcon size={20} />
            <span>Présenter</span>
          </button>
          {presenting && image?.status === 'ready' && (
            <PiecePresentation
              title={piece.label}
              detail={attachmentsDetail}
              source={image.source}
              onClose={closePresentation}
              requestWakeLock={requestWakeLock}
            />
          )}
        </>
      )}
      <dl className="piece-sheet-metadata">
        <div>
          <dt>Format</dt>
          <dd>{pieceFormat(piece)}</dd>
        </div>
        {added && (
          <div>
            <dt>Type</dt>
            <dd>{USER_PIECE_KIND_LABELS[added.kind]}</dd>
          </div>
        )}
        <div>
          <dt>Stockage</dt>
          <dd>
            {piece.kind === 'document' && documentStorageText(present)}
            {piece.kind === 'reservation' && 'Enregistrée avec le voyage sur cet appareil'}
            {piece.kind === 'added' && 'Sur cet appareil, disponible hors connexion'}
          </dd>
        </div>
        <div>
          <dt>Origine</dt>
          <dd>
            {added
              ? `Ajoutée sur cet appareil${formatAddedDate(added.createdAt, travel.locale)
                ? ` le ${formatAddedDate(added.createdAt, travel.locale)}`
                : ''}`
              : 'Fournie avec le dossier du voyage'}
          </dd>
        </div>
      </dl>
      <section className="pieces-group" aria-labelledby="piece-attachments-title">
        <h3 className="pieces-group-title" id="piece-attachments-title">Rattachée à</h3>
        <ul className="pieces-list piece-sheet-links">
          {piece.attachments.length === 0 && (
            <li className="piece-sheet-link piece-sheet-link-static">
              <PaperclipIcon size={22} />
              <span className="piece-text">
                <span className="piece-title">Tout le voyage</span>
                <span className="piece-attachments">Aucune journée ni étape associée</span>
              </span>
            </li>
          )}
          {piece.attachments.map((attachment) => {
            const date = formatCompactDate(attachment.day.date, travel.locale)
            const title = attachment.type === 'day'
              ? capitalize(date)
              : `Étape ${attachment.step.startsAt ? `${attachment.step.startsAt} · ` : ''}${attachment.step.title}`
            const detail = attachment.type === 'day'
              ? attachment.day.title
              : `${capitalize(date)} · ${attachment.day.title}`
            return (
              <li
                key={attachment.type === 'day' ? `day:${attachment.day.id}` : `step:${attachment.step.id}`}
              >
                <button
                  className="piece-sheet-link"
                  type="button"
                  aria-label={`${attachment.type === 'day' ? 'Voir la journée' : 'Voir l’étape'} ${title} — ${detail}`}
                  onClick={() => onNavigate(attachmentTarget(attachment))}
                >
                  {attachment.type === 'day'
                    ? <CalendarIcon size={22} />
                    : <ClockIcon size={22} />}
                  <span className="piece-text">
                    <span className="piece-title">{title}</span>
                    <span className="piece-attachments">{detail}</span>
                  </span>
                  <ChevronRightIcon size={20} className="piece-chevron" />
                </button>
              </li>
            )
          })}
          <li>
            <button
              className="piece-sheet-link"
              type="button"
              onClick={() => onNavigate({ kind: 'pieces' })}
            >
              <PaperclipIcon size={22} />
              <span className="piece-text">
                <span className="piece-title">Toutes les pièces du voyage</span>
              </span>
              <ChevronRightIcon size={20} className="piece-chevron" />
            </button>
          </li>
        </ul>
      </section>
      {added && (
        <UserPieceActions
          key={added.pieceId}
          piece={added}
          onRename={(title) => onRenameUserPiece(added.pieceId, title)}
          onDelete={() => onDeleteUserPiece(added.pieceId)}
        />
      )}
      <p className="piece-sheet-note">
        <ShieldIcon size={18} />
        <span>
          {added
            ? 'Pièce ajoutée : elle reste sur cet appareil, comme vos notes et vos checklists.'
            : 'Pièce du dossier : en lecture seule. Les pièces que vous ajoutez vous-même peuvent être renommées ou supprimées.'}
        </span>
      </p>
    </div>
  )
}
