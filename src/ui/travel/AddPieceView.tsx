import { useId, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  MAX_USER_PIECE_SIZE_LABEL,
  USER_PIECE_KIND_LABELS,
  readUserPieceFile,
  userPieceFormatLabel,
} from '../../application/userPieces'
import type { Travel } from '../../domain/voyage/model'
import {
  MAX_USER_PIECE_TITLE_LENGTH,
  USER_PIECE_KINDS,
  isValidUserPieceTitle,
  type NewUserPiece,
  type UserPieceAttachment,
  type UserPieceKind,
  type UserPieceMediaType,
  type UserPieceMetadata,
} from '../../persistence/model'
import { CheckIcon, FileIcon, ShieldIcon, UploadIcon } from '../icons'
import { formatCompactDate } from '../travelDates'

export type UserPieceSaveResult =
  | { readonly ok: true; readonly piece: UserPieceMetadata }
  | { readonly ok: false; readonly message: string }

type FileState =
  | { readonly status: 'empty' }
  | { readonly status: 'reading' }
  | {
      readonly status: 'ready'
      readonly name: string
      readonly mediaType: UserPieceMediaType
      readonly bytes: Uint8Array
    }
  | { readonly status: 'error'; readonly message: string }

function attachmentValue(attachment: UserPieceAttachment) {
  if (attachment.type === 'day') return `day:${attachment.dayId}`
  if (attachment.type === 'step') return `step:${attachment.stepId}`
  return 'travel'
}

/** Les identifiants du contrat ne contiennent pas « : », ce qui rend la valeur non ambiguë. */
function parseAttachmentValue(value: string): UserPieceAttachment {
  const separator = value.indexOf(':')
  const type = value.slice(0, separator)
  const id = value.slice(separator + 1)
  if (separator > 0 && type === 'day') return { type: 'day', dayId: id }
  if (separator > 0 && type === 'step') return { type: 'step', stepId: id }
  return { type: 'travel' }
}

function CameraIcon() {
  return (
    <svg
      className="icon"
      width={26}
      height={26}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1zM12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
    </svg>
  )
}

/**
 * Ajout d’une pièce sur l’appareil. Le fichier, le titre, le type et le
 * rattachement sont choisis explicitement ; rien n’est déduit du nom du fichier.
 */
export function AddPieceView({
  travel,
  initialAttachment = { type: 'travel' },
  onSave,
  onSaved,
  onCancel,
}: {
  travel: Travel
  initialAttachment?: UserPieceAttachment
  onSave(piece: NewUserPiece): Promise<UserPieceSaveResult>
  onSaved(piece: UserPieceMetadata): void
  onCancel(): void
}) {
  const fieldId = useId()
  const [fileState, setFileState] = useState<FileState>({ status: 'empty' })
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<UserPieceKind>('other')
  const [attachment, setAttachment] = useState(() => attachmentValue(initialAttachment))
  const [titleError, setTitleError] = useState<string>()
  const [submitError, setSubmitError] = useState<string>()
  const [saving, setSaving] = useState(false)

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setSubmitError(undefined)
    setFileState({ status: 'reading' })
    const read = await readUserPieceFile(file)
    setFileState(read.ok
      ? { status: 'ready', name: file.name, mediaType: read.mediaType, bytes: read.bytes }
      : { status: 'error', message: read.message })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validTitle = isValidUserPieceTitle(title)
    setTitleError(validTitle ? undefined : 'Donnez un titre à cette pièce.')
    if (fileState.status !== 'ready') {
      setSubmitError('Choisissez un fichier ou prenez une photo avant d’enregistrer.')
      return
    }
    if (!validTitle) {
      setSubmitError(undefined)
      return
    }
    setSaving(true)
    setSubmitError(undefined)
    const result = await onSave({
      title,
      kind,
      attachment: parseAttachmentValue(attachment),
      mediaType: fileState.mediaType,
      bytes: fileState.bytes,
    })
    setSaving(false)
    if (result.ok) onSaved(result.piece)
    else setSubmitError(result.message)
  }

  const titleErrorId = `${fieldId}-title-error`
  const fileStatusId = `${fieldId}-file-status`

  return (
    <div className="consultation-view add-piece-view" aria-labelledby="add-piece-title">
      <header className="section-heading">
        <p className="section-label">Pièces</p>
        <h2 id="add-piece-title">Ajouter une pièce</h2>
      </header>
      <form className="add-piece-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
        <fieldset className="add-piece-sources">
          <legend>Fichier</legend>
          <input
            id={`${fieldId}-file`}
            className="file-input"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            aria-describedby={fileStatusId}
            onChange={(event) => void handleFile(event)}
          />
          <label className="add-piece-source" htmlFor={`${fieldId}-file`}>
            <UploadIcon size={26} />
            <span>
              <span className="add-piece-source-title">Choisir un fichier</span>
              <span className="add-piece-source-hint">
                PDF, JPEG, PNG ou WebP · {MAX_USER_PIECE_SIZE_LABEL} au plus
              </span>
            </span>
          </label>
          <input
            id={`${fieldId}-photo`}
            className="file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            aria-describedby={fileStatusId}
            onChange={(event) => void handleFile(event)}
          />
          <label className="add-piece-source" htmlFor={`${fieldId}-photo`}>
            <CameraIcon />
            <span>
              <span className="add-piece-source-title">Prendre une photo</span>
              <span className="add-piece-source-hint">Billet papier, QR code</span>
            </span>
          </label>
        </fieldset>
        <div id={fileStatusId} className="add-piece-file-status" aria-live="polite">
          {fileState.status === 'reading' && <p>Lecture du fichier…</p>}
          {fileState.status === 'ready' && (
            <p className="add-piece-file-ready">
              <FileIcon size={22} />
              <span>
                <span className="add-piece-file-name">{fileState.name}</span>
                <span className="add-piece-source-hint">
                  {userPieceFormatLabel(fileState.mediaType)} · prêt à être enregistré
                </span>
              </span>
              <CheckIcon size={22} />
            </p>
          )}
          {fileState.status === 'error' && (
            <p className="notice notice-error" role="alert">{fileState.message}</p>
          )}
        </div>
        <div className="form-field">
          <label htmlFor={`${fieldId}-title`}>Titre</label>
          <input
            id={`${fieldId}-title`}
            type="text"
            value={title}
            maxLength={MAX_USER_PIECE_TITLE_LENGTH}
            required
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? titleErrorId : undefined}
            onChange={(event) => setTitle(event.currentTarget.value)}
          />
          {titleError && <p id={titleErrorId} className="field-error">{titleError}</p>}
        </div>
        <div className="form-field">
          <label htmlFor={`${fieldId}-kind`}>Type</label>
          <select
            id={`${fieldId}-kind`}
            value={kind}
            onChange={(event) => setKind(event.currentTarget.value as UserPieceKind)}
          >
            {USER_PIECE_KINDS.map((value) => (
              <option key={value} value={value}>{USER_PIECE_KIND_LABELS[value]}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor={`${fieldId}-attachment`}>Rattacher à</label>
          <select
            id={`${fieldId}-attachment`}
            value={attachment}
            onChange={(event) => setAttachment(event.currentTarget.value)}
          >
            <option value="travel">Tout le voyage</option>
            {travel.days.map((day) => (
              <optgroup
                key={day.id}
                label={`${formatCompactDate(day.date, travel.locale)} · ${day.title}`}
              >
                <option value={`day:${day.id}`}>Toute la journée · {day.title}</option>
                {day.steps.map((step) => (
                  <option key={step.id} value={`step:${step.id}`}>
                    Étape {step.startsAt ? `${step.startsAt} · ` : ''}{step.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <p className="piece-sheet-note">
          <ShieldIcon size={18} />
          <span>Cette pièce reste sur cet appareil, comme vos notes et vos checklists.</span>
        </p>
        {submitError && <p className="notice notice-error" role="alert">{submitError}</p>}
        <div className="add-piece-actions">
          <button className="primary-button" type="submit" disabled={saving}>
            <CheckIcon size={20} />
            {saving ? 'Enregistrement…' : 'Enregistrer la pièce'}
          </button>
          <button className="secondary-button" type="button" onClick={onCancel}>
            Annuler
          </button>
        </div>
      </form>
    </div>
  )
}
