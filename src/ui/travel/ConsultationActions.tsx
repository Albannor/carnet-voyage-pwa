import { useEffect, useState } from 'react'
import type {
  Travel,
  TravelChecklist,
  TravelDocument,
  TravelLink,
  TravelReservation,
} from '../../domain/voyage/model'
import { checklistItemStateKey } from '../../persistence/model'
import { safeExternalHttpsUrl } from '../../services/travelActions'
import {
  CheckIcon,
  ChevronLeftIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileIcon,
} from '../icons'
import { documentsById } from './consultationHelpers'
import type { PersonalStateProps } from './consultationTypes'
import { uniqueContextualLinks } from './contextualLinks'

export function ExternalLink({
  link,
  online,
  context,
}: {
  link: TravelLink
  online: boolean
  context: string
}) {
  const href = safeExternalHttpsUrl(link.href)
  if (href && online) {
    return (
      <a
        className="contextual-link"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${link.label} pour ${context} — service externe, connexion requise`}
      >
        <span>{link.label}</span>
        <ExternalLinkIcon size={16} className="external-link-indicator" />
      </a>
    )
  }
  return (
    <span
      className="contextual-link contextual-link-disabled"
      aria-disabled="true"
      aria-label={`${link.label} pour ${context}${href ? ' — indisponible hors connexion' : ' — lien externe refusé'}`}
    >
      <span>{link.label}</span>
      <small>{href ? 'Hors connexion' : 'Lien refusé'}</small>
    </span>
  )
}

function DocumentButton({
  document,
  context,
  onOpenDocument,
}: {
  document: TravelDocument
  context: string
  onOpenDocument(document: TravelDocument): void
}) {
  return (
    <button
      className="document-button"
      type="button"
      aria-label={`Ouvrir le document ${document.label} pour ${context}`}
      onClick={() => onOpenDocument(document)}
    >
      <FileIcon size={18} />
      <span>{document.label}</span>
    </button>
  )
}

export function CopyAddressButton({
  address,
  placeLabel,
  targetLabel,
  iconOnly = false,
  onCopyAddress,
}: {
  address: string
  placeLabel: string
  targetLabel: string
  iconOnly?: boolean
  onCopyAddress(address: string, placeLabel: string): Promise<boolean>
}) {
  const [result, setResult] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (result !== 'copied') return
    const timer = window.setTimeout(() => setResult('idle'), 2500)
    return () => window.clearTimeout(timer)
  }, [result])

  async function copy() {
    setResult(await onCopyAddress(address, placeLabel) ? 'copied' : 'failed')
  }

  const copied = result === 'copied'
  return (
    <span className="copy-action">
      <button
        className={iconOnly ? 'copy-button copy-button-icon' : 'copy-button'}
        type="button"
        aria-label={`Copier l’adresse de ${targetLabel}`}
        onClick={() => void copy()}
      >
        {copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
        {!iconOnly && <span>{copied ? 'Adresse copiée' : 'Copier l’adresse'}</span>}
      </button>
      <span
        className={result === 'failed' ? 'copy-feedback copy-feedback-error' : 'copy-feedback'}
        role="status"
      >
        {copied && (iconOnly ? 'Adresse copiée' : <span className="visually-hidden">Adresse copiée</span>)}
        {result === 'failed' && 'Copie impossible sur cet appareil'}
      </span>
    </span>
  )
}

interface ReservationContentProps {
  travel: Travel
  reservation: TravelReservation
  online: boolean
  onOpenDocument(document: TravelDocument): void
  excludedDocumentIds?: ReadonlySet<string>
}

export function ReservationBody({
  travel,
  reservation,
  online,
  onOpenDocument,
  excludedDocumentIds = new Set<string>(),
}: ReservationContentProps) {
  const reservationDocuments = documentsById(
    travel,
    reservation.documentIds.filter((id) => !excludedDocumentIds.has(id)),
  )
  return (
    <>
      <dl className="reservation-metadata">
        {reservation.reference && <><dt>Référence</dt><dd>{reservation.reference}</dd></>}
        {reservation.date && <><dt>Date</dt><dd><time dateTime={reservation.date}>{reservation.date}</time></dd></>}
        {reservation.time && <><dt>Heure</dt><dd><time dateTime={reservation.time}>{reservation.time}</time></dd></>}
        {reservation.status && <><dt>Statut</dt><dd>{reservation.status}</dd></>}
      </dl>
      {reservationDocuments.length > 0 && (
        <ul className="compact-action-list">
          {reservationDocuments.map((document) => (
            <li key={document.id}>
              <DocumentButton
                document={document}
                context={reservation.label}
                onOpenDocument={onOpenDocument}
              />
            </li>
          ))}
        </ul>
      )}
      {reservation.links.length > 0 && (
        <ul className="contextual-link-list">
          {uniqueContextualLinks(reservation.links).map((link) => (
            <li key={link.id}>
              <ExternalLink
                link={link}
                online={online}
                context={reservation.label}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export function ReservationDetails(props: ReservationContentProps) {
  const { reservation } = props
  return (
    <article className="reservation-card">
      <p className="card-label">Réservation</p>
      <h4>{reservation.label}</h4>
      <ReservationBody {...props} />
    </article>
  )
}

export function ChecklistCollection({
  checklists,
  checkedItemKeys,
  checklistFeedback,
  onToggleChecklistItem,
}: {
  checklists: readonly TravelChecklist[]
} & PersonalStateProps) {
  if (checklists.length === 0) return null
  return (
    <div className="checklists">
      {checklists.map((checklist) => (
        <fieldset className="checklist-card" key={checklist.id}>
          <legend>{checklist.title}</legend>
          {checklist.description && <p>{checklist.description}</p>}
          <ul>
            {checklist.items.map((item) => {
              const key = checklistItemStateKey(checklist.id, item.id)
              const feedback = checklistFeedback[key]
              return (
                <li key={item.id}>
                  <label className="checklist-item">
                    <input
                      type="checkbox"
                      checked={checkedItemKeys.has(key)}
                      disabled={feedback === 'saving'}
                      onChange={(event) => onToggleChecklistItem(
                        checklist.id,
                        item.id,
                        event.currentTarget.checked,
                      )}
                    />
                    <span>
                      <strong>{item.label}</strong>
                      {item.description && <small>{item.description}</small>}
                    </span>
                  </label>
                  {feedback && (
                    <span
                      className={feedback === 'error'
                        ? 'personal-feedback personal-error'
                        : 'personal-feedback'}
                      role={feedback === 'error' ? 'alert' : 'status'}
                    >
                      {feedback === 'saving'
                        ? 'Enregistrement local…'
                        : feedback === 'saved'
                          ? 'Enregistré localement'
                          : 'Échec de l’enregistrement. La valeur précédente est conservée.'}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </fieldset>
      ))}
    </div>
  )
}

export function BackToLibraryButton({
  className,
  onBackToLibrary,
}: {
  className?: string
  onBackToLibrary(): void
}) {
  return (
    <button
      className={`round-button round-button-paper${className ? ` ${className}` : ''}`}
      type="button"
      aria-label="Retour à la bibliothèque"
      onClick={onBackToLibrary}
    >
      <ChevronLeftIcon size={22} />
    </button>
  )
}

export function ContextualLinkList({
  links,
  online,
  context,
}: {
  links: readonly TravelLink[]
  online: boolean
  context: string
}) {
  if (links.length === 0) return null

  return (
    <ul className="contextual-link-list" aria-label={`Liens pratiques pour ${context}`}>
      {links.map((link) => (
        <li key={link.id}>
          <ExternalLink link={link} online={online} context={context} />
        </li>
      ))}
    </ul>
  )
}
