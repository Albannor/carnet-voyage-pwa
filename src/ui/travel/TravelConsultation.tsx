import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import {
  findAccommodationForDate,
  findPlace,
  getOverviewAnchorDate,
  getTodayState,
  type Clock,
} from '../../application/travelConsultation'
import {
  allDocumentsStoredLocally,
  documentPiecesForStep,
  findStepWithDay,
  findTravelPiece,
  groupTravelPiecesByDay,
  listTravelPieces,
  piecesForDay,
  type TravelPiece,
  type TravelPieceAttachment,
  type TravelPieceKind,
} from '../../application/travelPieces'
import type {
  Travel,
  TravelAccommodation,
  TravelChecklist,
  TravelDay,
  TravelDocument,
  TravelIllustration,
  TravelLink,
  TravelReservation,
  TravelStep,
  TravelVariant,
  TravelVariantKind,
} from '../../domain/voyage/model'
import {
  MAX_TRAVEL_NOTE_LENGTH,
  checklistItemStateKey,
  type PersistedTravel,
  type PersistedTravelResource,
  type TravelPersonalState,
} from '../../persistence/model'
import { safeExternalHttpsUrl } from '../../services/travelActions'
import {
  CalendarIcon,
  CheckIcon,
  ChecklistIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CompassIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileIcon,
  HomeIcon,
  InfoIcon,
  ListIcon,
  MapPinIcon,
  PaperclipIcon,
  ShieldIcon,
  SwapIcon,
  TicketIcon,
} from '../icons'
import { daysBetween, formatTravelDates, travelDurationLabel } from '../travelDates'
import { localTimeInTimeZone, stepProgress, type StepProgress } from './stepProgress'
import {
  linksNotCarriedByIllustration,
  stepIllustrationLink,
  uniqueContextualLinks,
} from './contextualLinks'

export type TravelView =
  | { readonly kind: 'summary' }
  | { readonly kind: 'today' }
  | { readonly kind: 'day'; readonly dayId: string }
  | { readonly kind: 'step'; readonly stepId: string }
  | { readonly kind: 'pieces' }
  | {
      readonly kind: 'piece'
      readonly pieceKind: TravelPieceKind
      readonly pieceId: string
    }
  | { readonly kind: 'practical' }
  | { readonly kind: 'preparation' }

export interface ContextActionFeedback {
  readonly status: 'success' | 'error'
  readonly message: string
}

export type PersonalSaveResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string }

export type IllustrationResourceLoadResult =
  | { readonly ok: true; readonly resource: PersistedTravelResource }
  | { readonly ok: false; readonly message: string }

interface TravelConsultationProps {
  persistedTravel: PersistedTravel
  view: TravelView
  clock: Clock
  online: boolean
  actionFeedback?: ContextActionFeedback
  personalState: TravelPersonalState
  noteSaveDelayMs?: number
  onNavigate(view: TravelView): void
  onBackToLibrary(): void
  /** Résout à `true` lorsque l’adresse a été copiée. */
  onCopyAddress(address: string, placeLabel: string): Promise<boolean>
  onOpenDocument(document: TravelDocument): void
  onLoadIllustrationResource(
    travelId: string,
    resourceId: string,
  ): Promise<IllustrationResourceLoadResult>
  /** Résout à `undefined` lorsque le stockage local ne peut pas être lu. */
  onListLocalResourceIds(travelId: string): Promise<readonly string[] | undefined>
  onSetChecklistItemChecked(
    checklistId: string,
    itemId: string,
    checked: boolean,
  ): Promise<PersonalSaveResult>
  onSaveNote(text: string): Promise<PersonalSaveResult>
}

interface ActionProps {
  online: boolean
  onCopyAddress(address: string, placeLabel: string): Promise<boolean>
  onOpenDocument(document: TravelDocument): void
  onLoadIllustrationResource(
    travelId: string,
    resourceId: string,
  ): Promise<IllustrationResourceLoadResult>
}

interface PersonalStateProps {
  checkedItemKeys: ReadonlySet<string>
  checklistFeedback: Readonly<Record<string, 'saving' | 'saved' | 'error'>>
  onToggleChecklistItem(
    checklistId: string,
    itemId: string,
    checked: boolean,
  ): void
}

const VARIANT_LABELS: Record<TravelVariantKind, string> = {
  standard: 'Standard',
  'low-walking': 'Économe en marche',
  rain: 'Pluie',
}

function formatDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}

function formatCompactDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}

function illustrationById(travel: Travel, illustrationId: string) {
  return travel.illustrations.find((illustration) => illustration.id === illustrationId)
}

type LocalImageState =
  | { readonly key: string; readonly status: 'ready'; readonly source: string }
  | { readonly key: string; readonly status: 'failed' }

/** Charge une image locale du voyage et révoque son URL d’objet au démontage. */
function useLocalImageSource(
  travelId: string,
  resourceId: string,
  onLoadResource: ActionProps['onLoadIllustrationResource'],
) {
  const resourceKey = `${travelId}/${resourceId}`
  const [resourceState, setResourceState] = useState<LocalImageState>()

  useEffect(() => {
    let active = true
    let objectUrl: string | undefined
    void onLoadResource(travelId, resourceId).then((result) => {
      if (!active) return
      if (!result.ok) {
        setResourceState({ key: resourceKey, status: 'failed' })
        return
      }
      try {
        objectUrl = URL.createObjectURL(new Blob(
          [Uint8Array.from(result.resource.bytes).buffer],
          { type: result.resource.mediaType },
        ))
        if (!active) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        setResourceState({ key: resourceKey, status: 'ready', source: objectUrl })
      } catch {
        setResourceState({ key: resourceKey, status: 'failed' })
      }
    })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [onLoadResource, resourceId, resourceKey, travelId])

  return resourceState?.key === resourceKey ? resourceState : undefined
}

function LocalIllustration({
  travelId,
  illustration,
  loading,
  practicalLink,
  practicalLinkContext,
  online = true,
  onLoadResource,
}: {
  travelId: string
  illustration: TravelIllustration
  loading?: 'lazy'
  practicalLink?: TravelLink
  practicalLinkContext?: string
  online?: boolean
  onLoadResource(
    travelId: string,
    resourceId: string,
  ): Promise<IllustrationResourceLoadResult>
}) {
  const currentState = useLocalImageSource(
    travelId,
    illustration.resourceId,
    onLoadResource,
  )
  const practicalHref = practicalLink
    ? safeExternalHttpsUrl(practicalLink.href)
    : undefined

  if (currentState?.status === 'failed') {
    return (
      <figure className="travel-illustration illustration-fallback">
        <p role="status">Illustration locale indisponible : {illustration.alt}</p>
        {practicalLink && (
          <div className="illustration-fallback-action">
            <ExternalLink
              link={practicalLink}
              online={online}
              context={practicalLinkContext ?? illustration.alt}
            />
          </div>
        )}
        {illustration.caption && <figcaption>{illustration.caption}</figcaption>}
      </figure>
    )
  }

  return (
    <figure className="travel-illustration">
      {practicalHref && online ? (
        <a
          className="illustration-practical-link"
          href={practicalHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${practicalLink!.label} pour ${practicalLinkContext ?? illustration.alt} — service externe, connexion requise`}
        >
          {currentState?.status === 'ready' ? (
            <img
              src={currentState.source}
              alt={illustration.alt}
              loading={loading}
            />
          ) : (
            <span className="illustration-loading" role="status">
              Chargement de l’illustration locale…
            </span>
          )}
          <span className="illustration-link-hint">
            {practicalLink!.label}
            <ExternalLinkIcon size={16} />
          </span>
        </a>
      ) : currentState?.status === 'ready' ? (
        <img
          src={currentState.source}
          alt={illustration.alt}
          loading={loading}
        />
      ) : (
        <div className="illustration-loading" role="status">
          Chargement de l’illustration locale…
        </div>
      )}
      {practicalHref && !online && (
        <span className="illustration-link-unavailable" role="status">
          {practicalLink!.label} · indisponible hors connexion
        </span>
      )}
      {illustration.caption && <figcaption>{illustration.caption}</figcaption>}
    </figure>
  )
}

function IllustrationCollection({
  travel,
  illustrationIds,
  cover = false,
  limit,
  practicalLink,
  practicalLinkContext,
  online,
  onLoadResource,
}: {
  travel: Travel
  illustrationIds: readonly string[]
  cover?: boolean
  limit?: number
  practicalLink?: TravelLink
  practicalLinkContext?: string
  online?: boolean
  onLoadResource(
    travelId: string,
    resourceId: string,
  ): Promise<IllustrationResourceLoadResult>
}) {
  const illustrations = illustrationIds.flatMap((id) => {
    const illustration = illustrationById(travel, id)
    return illustration ? [illustration] : []
  }).slice(0, limit)
  if (illustrations.length === 0) return null

  return (
    <div className={cover ? 'illustration-grid cover-illustration' : 'illustration-grid'}>
      {illustrations.map((illustration, index) => (
        <LocalIllustration
          key={illustration.id}
          travelId={travel.id}
          illustration={illustration}
          loading={cover ? undefined : 'lazy'}
          practicalLink={index === 0 ? practicalLink : undefined}
          practicalLinkContext={practicalLinkContext}
          online={online}
          onLoadResource={onLoadResource}
        />
      ))}
    </div>
  )
}

function referencedIllustrations(travel: Travel) {
  const orderedIds = [
    ...(travel.coverIllustrationId ? [travel.coverIllustrationId] : []),
    ...travel.days.flatMap((day) => [
      ...day.illustrationIds,
      ...day.steps.flatMap((step) => step.illustrationIds),
    ]),
  ]
  const seen = new Set<string>()
  return orderedIds.flatMap((id) => {
    if (seen.has(id)) return []
    seen.add(id)
    const illustration = illustrationById(travel, id)
    return illustration ? [illustration] : []
  })
}

function CreditExternalLink({
  href,
  children,
  online,
}: {
  href: string
  children: ReactNode
  online: boolean
}) {
  const safeHref = safeExternalHttpsUrl(href)
  return safeHref && online ? (
    <a href={safeHref} target="_blank" rel="noopener noreferrer">
      Service externe · {children}
    </a>
  ) : (
    <span aria-disabled="true">
      {safeHref
        ? `${String(children)} · indisponible hors connexion`
        : `${String(children)} · lien refusé`}
    </span>
  )
}

function IllustrationCredits({
  travel,
  online,
}: {
  travel: Travel
  online: boolean
}) {
  const illustrations = referencedIllustrations(travel)
  if (illustrations.length === 0) return null

  return (
    <section className="illustration-credits" aria-labelledby="illustration-credits-title">
      <h3 id="illustration-credits-title">Crédits photographiques</h3>
      <ol>
        {illustrations.map((illustration) => {
          const provenance = illustration.provenance
          return (
            <li key={illustration.id}>
              <strong>{illustration.caption ?? illustration.alt}</strong>
              {provenance.type === 'licensed' && (
                <>
                  <span>Auteur : {provenance.creator}</span>
                  <span>
                    <CreditExternalLink href={provenance.sourceUrl} online={online}>
                      Source de l’image
                    </CreditExternalLink>
                    {' · '}
                    <CreditExternalLink href={provenance.licenseUrl} online={online}>
                      Licence {provenance.licenseCode}
                    </CreditExternalLink>
                  </span>
                  {provenance.modified && <span>Image recadrée ou transformée.</span>}
                </>
              )}
              {provenance.type === 'user-provided' && (
                <span>
                  Photographie personnelle
                  {provenance.credit ? ` · ${provenance.credit}` : ''}
                </span>
              )}
              {provenance.type === 'ai-generated' && (
                <span>
                  Image générée par IA · {provenance.provider}
                  {provenance.generatedAt ? ` · ${provenance.generatedAt}` : ''}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function documentsById(travel: Travel, ids: readonly string[]) {
  return ids.flatMap((id) => {
    const document = travel.documents.find((candidate) => candidate.id === id)
    return document ? [document] : []
  })
}

function reservationsById(travel: Travel, ids: readonly string[]) {
  return ids.flatMap((id) => {
    const reservation = travel.reservations.find((candidate) => candidate.id === id)
    return reservation ? [reservation] : []
  })
}

function ExternalLink({
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

function CopyAddressButton({
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

function ReservationBody({
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

function ReservationDetails({
  compact = false,
  ...props
}: ReservationContentProps & { compact?: boolean }) {
  const { reservation } = props
  const content = <ReservationBody {...props} />

  if (compact) {
    return (
      <details className="reservation-disclosure">
        <summary aria-label={`Voir la réservation ${reservation.label}`}>
          Voir la réservation
        </summary>
        <h5>{reservation.label}</h5>
        {content}
      </details>
    )
  }

  return (
    <article className="reservation-card">
      <p className="card-label">Réservation</p>
      <h4>{reservation.label}</h4>
      {content}
    </article>
  )
}

function ChecklistCollection({
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

function NotesPanel({
  initialNote,
  saveDelayMs,
  onSave,
}: {
  initialNote: string
  saveDelayMs: number
  onSave(text: string): Promise<PersonalSaveResult>
}) {
  const [note, setNote] = useState(initialNote)
  const [status, setStatus] = useState<'idle' | 'editing' | 'saving' | 'saved' | 'error'>('idle')
  const timer = useRef<number | undefined>(undefined)
  const revision = useRef(0)
  const requestedRevision = useRef(0)
  const latestNote = useRef(initialNote)
  const saveRef = useRef(onSave)

  useEffect(() => {
    saveRef.current = onSave
  }, [onSave])

  async function save(value: string, currentRevision: number) {
    window.clearTimeout(timer.current)
    setStatus('saving')
    requestedRevision.current = Math.max(requestedRevision.current, currentRevision)
    const result = await onSave(value)
    if (revision.current !== currentRevision) return
    setStatus(result.ok ? 'saved' : 'error')
  }

  function scheduleSave(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.currentTarget.value
    const currentRevision = revision.current + 1
    revision.current = currentRevision
    latestNote.current = value
    setNote(value)
    setStatus('editing')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      void save(value, currentRevision)
    }, saveDelayMs)
  }

  useEffect(() => () => {
    window.clearTimeout(timer.current)
    if (revision.current > requestedRevision.current) {
      void saveRef.current(latestNote.current)
    }
  }, [])

  return (
    <section className="personal-notes" aria-labelledby="personal-notes-title">
      <p className="card-label">Données personnelles</p>
      <h2 id="personal-notes-title">Notes personnelles</h2>
      <label htmlFor="travel-personal-note">Note générale du voyage</label>
      <textarea
        id="travel-personal-note"
        value={note}
        maxLength={MAX_TRAVEL_NOTE_LENGTH}
        rows={6}
        onChange={scheduleSave}
        onBlur={() => {
          if (status === 'editing') void save(note, revision.current)
        }}
      />
      <div className="note-meta">
        <span>Texte brut · reste uniquement sur cet appareil.</span>
        <span role={status === 'error' ? 'alert' : 'status'} aria-live="polite">
          {status === 'editing' && 'Modification en cours…'}
          {status === 'saving' && 'Enregistrement local…'}
          {status === 'saved' && 'Enregistré localement'}
          {status === 'error' && 'Échec de l’enregistrement. Votre texte reste affiché pour permettre une nouvelle tentative.'}
        </span>
      </div>
    </section>
  )
}

function capitalize(text: string) {
  return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1)
}

function formatDayHeading(date: string, locale: string) {
  return capitalize(new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`)))
}

function formatDayParts(date: string, locale: string) {
  const parts = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(new Date(`${date}T12:00:00Z`))
  return {
    day: parts.find((part) => part.type === 'day')?.value ?? '',
    weekday: parts.find((part) => part.type === 'weekday')?.value ?? '',
  }
}

function TravelHero({
  travel,
  onBackToLibrary,
  onLoadIllustrationResource,
}: {
  travel: Travel
  onBackToLibrary(): void
  onLoadIllustrationResource: ActionProps['onLoadIllustrationResource']
}) {
  const cover = travel.coverIllustrationId
    ? illustrationById(travel, travel.coverIllustrationId)
    : undefined

  return (
    <div className="travel-hero">
      {cover ? (
        <HeroCover
          travelId={travel.id}
          illustration={cover}
          onLoadResource={onLoadIllustrationResource}
        />
      ) : (
        <div className="travel-cover-fallback" aria-hidden="true">
          <span className="travel-cover-sun" />
        </div>
      )}
      <BackToLibraryButton className="travel-hero-back" onBackToLibrary={onBackToLibrary} />
    </div>
  )
}

function HeroCover({
  travelId,
  illustration,
  onLoadResource,
}: {
  travelId: string
  illustration: TravelIllustration
  onLoadResource: ActionProps['onLoadIllustrationResource']
}) {
  const image = useLocalImageSource(travelId, illustration.resourceId, onLoadResource)

  return (
    <figure className="travel-hero-figure">
      {image?.status === 'ready' ? (
        <img src={image.source} alt={illustration.alt} />
      ) : (
        <div className="travel-cover-fallback">
          <span className="travel-cover-sun" aria-hidden="true" />
          <span className="visually-hidden" role="status">
            {image?.status === 'failed'
              ? `Illustration locale indisponible : ${illustration.alt}`
              : 'Chargement de l’illustration locale…'}
          </span>
        </div>
      )}
      {illustration.caption && (
        <figcaption className="travel-hero-caption">{illustration.caption}</figcaption>
      )}
    </figure>
  )
}

function BackToLibraryButton({
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

function TimelinessCard({
  travel,
  clock,
  onNavigate,
}: {
  travel: Travel
  clock: Clock
  onNavigate(view: TravelView): void
}) {
  const today = getTodayState(travel, clock)
  const firstDay = travel.days[0]
  const firstDayView: TravelView | undefined = firstDay
    ? { kind: 'day', dayId: firstDay.id }
    : undefined

  let label: string
  let detail: string | undefined
  let action: { label: string; view: TravelView } | undefined
  if (today.status === 'day') {
    label = 'Aujourd’hui'
    detail = `${formatDayHeading(today.day.date, travel.locale)} · ${today.day.title}`
    action = { label: 'Voir la journée', view: { kind: 'today' } }
  } else if (today.status === 'before') {
    const remaining = daysBetween(today.date, travel.period.start)
    label = remaining === 1 ? 'Départ demain' : `Départ dans ${remaining} jours`
    detail = firstDay
      ? `${formatDayHeading(firstDay.date, travel.locale)} · ${firstDay.title}`
      : undefined
    action = firstDayView && { label: 'Voir le programme', view: firstDayView }
  } else if (today.status === 'after') {
    label = 'Voyage terminé'
    detail = 'Le programme, les documents et vos notes restent disponibles.'
    action = firstDayView && { label: 'Revoir le programme', view: firstDayView }
  } else {
    label = 'Aujourd’hui'
    detail = 'Aucune journée n’est prévue à cette date dans le programme.'
    action = firstDay && { label: 'Voir le programme', view: { kind: 'today' } }
  }

  return (
    <section className="timeliness-card" aria-labelledby="timeliness-title">
      <h2 id="timeliness-title" className="timeliness-label">{label}</h2>
      {detail && <p className="timeliness-detail">{detail}</p>}
      {action && (
        <button
          className="primary-button timeliness-action"
          type="button"
          onClick={() => onNavigate(action.view)}
        >
          {action.label}
          <ChevronRightIcon />
        </button>
      )}
    </section>
  )
}

function OverviewDays({
  travel,
  onNavigate,
}: {
  travel: Travel
  onNavigate(view: TravelView): void
}) {
  if (travel.days.length === 0) return null
  return (
    <section className="overview-days" aria-labelledby="overview-days-title">
      <h2 id="overview-days-title" className="section-label section-label-muted">
        {travel.days.length === 1 ? 'La journée' : `Les ${travel.days.length} journées`}
      </h2>
      <ul className="overview-day-list">
        {travel.days.map((day) => {
          const parts = formatDayParts(day.date, travel.locale)
          return (
            <li key={day.id}>
              <button
                className="overview-day"
                type="button"
                onClick={() => onNavigate({ kind: 'day', dayId: day.id })}
              >
                <span className="overview-day-date" aria-hidden="true">
                  <span>{parts.day}</span>
                  <span>{parts.weekday}</span>
                </span>
                <span className="overview-day-text">
                  <span className="visually-hidden">{formatDate(day.date, travel.locale)} : </span>
                  <span className="overview-day-title">{day.title}</span>
                  {day.summary && <span className="overview-day-summary">{day.summary}</span>}
                </span>
                <ChevronRightIcon className="overview-day-chevron" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function OverviewAccommodation({
  travel,
  clock,
  onCopyAddress,
}: {
  travel: Travel
  clock: Clock
  onCopyAddress(address: string, placeLabel: string): Promise<boolean>
}) {
  const anchor = findAccommodationForDate(travel, getOverviewAnchorDate(travel, clock))
  if (!anchor) return null
  const { accommodation, place } = anchor
  // L’adresse complète reste dans Pratique ; l’aperçu ne garde que le repère.
  const location = place && place.label !== accommodation.label ? place.label : undefined

  return (
    <section className="overview-stay" aria-labelledby="overview-stay-title">
      <span className="overview-stay-icon" aria-hidden="true"><HomeIcon size={22} /></span>
      <div className="overview-stay-text">
        <h2 id="overview-stay-title" className="overview-stay-title">{accommodation.label}</h2>
        {location && <p>{location}</p>}
      </div>
      {place?.address && (
        <CopyAddressButton
          address={place.address}
          placeLabel={place.label}
          targetLabel={accommodation.label}
          iconOnly
          onCopyAddress={onCopyAddress}
        />
      )}
    </section>
  )
}

function Overview({
  travel,
  clock,
  onNavigate,
  onBackToLibrary,
  onCopyAddress,
  onLoadIllustrationResource,
}: {
  travel: Travel
  clock: Clock
  onNavigate(view: TravelView): void
  onBackToLibrary(): void
  onCopyAddress(address: string, placeLabel: string): Promise<boolean>
  onLoadIllustrationResource: ActionProps['onLoadIllustrationResource']
}) {
  const datedReservations = [...travel.reservations]
    .filter((reservation) => reservation.date)
    .sort((left, right) => (
      `${left.date ?? ''}T${left.time ?? ''}`.localeCompare(
        `${right.date ?? ''}T${right.time ?? ''}`,
      )
    ))
    .slice(0, 4)

  return (
    <div className="consultation-view overview-view">
      <TravelHero
        travel={travel}
        onBackToLibrary={onBackToLibrary}
        onLoadIllustrationResource={onLoadIllustrationResource}
      />
      <div className="overview-sheet">
        <header className="overview-header">
          <h1 id="travel-summary-title" className="travel-title">{travel.title}</h1>
          <p className="overview-destination">
            <MapPinIcon size={18} className="icon-accent" />
            {travel.destination.label}
          </p>
          <div className="overview-chips">
            <span className="status-pill status-pill-sage">
              <CalendarIcon size={15} />
              <span className="visually-hidden">Dates : </span>
              <time dateTime={travel.period.start}>
                {formatTravelDates(travel.period.start, travel.period.end)}
              </time>
            </span>
            <span className="status-pill status-pill-neutral">
              <ClockIcon size={15} />
              {travelDurationLabel(travel.period.start, travel.period.end)}
            </span>
          </div>
          <p className="travel-summary">{travel.summary}</p>
        </header>
        <TimelinessCard travel={travel} clock={clock} onNavigate={onNavigate} />
        <OverviewDays travel={travel} onNavigate={onNavigate} />
        <OverviewAccommodation travel={travel} clock={clock} onCopyAddress={onCopyAddress} />
        {datedReservations.length > 0 && (
          <section className="overview-highlights" aria-labelledby="overview-highlights-title">
            <h2 id="overview-highlights-title" className="section-label section-label-muted">
              À retenir
            </h2>
            <ol>
              {datedReservations.map((reservation) => (
                <li key={reservation.id}>
                  <time dateTime={reservation.date}>{formatCompactDate(reservation.date!, travel.locale)}</time>
                  {reservation.time && <span>{reservation.time}</span>}
                  <strong>{reservation.label}</strong>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  )
}

function programTarget(travel: Travel, clock: Clock): TravelView {
  const today = getTodayState(travel, clock)
  if (today.status === 'day') return { kind: 'day', dayId: today.day.id }
  const firstDay = travel.days[0]
  return firstDay ? { kind: 'day', dayId: firstDay.id } : { kind: 'today' }
}

function DaySelector({
  travel,
  selectedDayId,
  todayDayId,
  onNavigate,
}: {
  travel: Travel
  selectedDayId?: string
  todayDayId?: string
  onNavigate(view: TravelView): void
}) {
  function handleArrowNavigation(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const direction = event.key === 'ArrowLeft' ? -1 : 1
    const target = travel.days[index + direction]
    if (!target) return
    event.preventDefault()
    onNavigate({ kind: 'day', dayId: target.id })
  }

  if (travel.days.length === 0) return null
  return (
    <nav className="day-selector" aria-label="Choisir une journée">
      <ol>
        {travel.days.map((day, index) => {
          const selected = day.id === selectedDayId
          const isToday = day.id === todayDayId
          const parts = formatDayParts(day.date, travel.locale)
          return (
            <li key={day.id}>
              <button
                className={selected ? 'day-choice day-choice-active' : 'day-choice'}
                type="button"
                aria-current={selected ? 'page' : undefined}
                aria-label={`${formatDate(day.date, travel.locale)}${isToday ? ' (aujourd’hui)' : ''} — ${day.title}`}
                onClick={() => onNavigate({ kind: 'day', dayId: day.id })}
                onKeyDown={(event) => handleArrowNavigation(event, index)}
              >
                <span className="day-choice-weekday">{parts.weekday}</span>
                <span className="day-choice-number">{parts.day}</span>
                {isToday && <span className="day-choice-today" />}
                {selected && <span className="visually-hidden">Journée active</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function AdjacentDayControls({
  travel,
  selectedDayId,
  onNavigate,
}: {
  travel: Travel
  selectedDayId: string
  onNavigate(view: TravelView): void
}) {
  const selectedIndex = travel.days.findIndex((day) => day.id === selectedDayId)
  const previous = selectedIndex > 0 ? travel.days[selectedIndex - 1] : undefined
  const next = selectedIndex >= 0 && selectedIndex < travel.days.length - 1
    ? travel.days[selectedIndex + 1]
    : undefined

  return (
    <nav className="adjacent-day-controls" aria-label="Journée précédente et suivante">
      <button
        className="secondary-button"
        type="button"
        disabled={!previous}
        aria-label={previous ? `Journée précédente : ${previous.title}` : 'Aucune journée précédente'}
        onClick={() => previous && onNavigate({ kind: 'day', dayId: previous.id })}
      >
        <ChevronLeftIcon />
        Précédent
      </button>
      <button
        className="secondary-button"
        type="button"
        disabled={!next}
        aria-label={next ? `Journée suivante : ${next.title}` : 'Aucune journée suivante'}
        onClick={() => next && onNavigate({ kind: 'day', dayId: next.id })}
      >
        Suivant
        <ChevronRightIcon />
      </button>
    </nav>
  )
}

function StepRelatedContent({
  travel,
  context,
  documents,
  reservations,
  online,
  onOpenDocument,
  excludedDocumentIds,
}: {
  travel: Travel
  context: string
  documents: readonly TravelDocument[]
  reservations: readonly TravelReservation[]
  online: boolean
  onOpenDocument(document: TravelDocument): void
  excludedDocumentIds: ReadonlySet<string>
}) {
  if (documents.length === 0 && reservations.length === 0) {
    return null
  }
  return (
    <div className="step-related-content" aria-label={`Documents et réservations pour ${context}`}>
      {documents.length > 0 && (
        <ul className="compact-action-list">
          {documents.map((document) => (
            <li key={document.id}>
              <DocumentButton
                document={document}
                context={context}
                onOpenDocument={onOpenDocument}
              />
            </li>
          ))}
        </ul>
      )}
      {reservations.map((reservation) => (
        <ReservationDetails
          key={reservation.id}
          travel={travel}
          reservation={reservation}
          online={online}
          onOpenDocument={onOpenDocument}
          compact
          excludedDocumentIds={excludedDocumentIds}
        />
      ))}
    </div>
  )
}

function ContextualLinkList({
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

function dayVariants(travel: Travel, day: TravelDay) {
  const stepIds = new Set(day.steps.map((step) => step.id))
  return travel.variants.filter((variant) => (
    variant.kind !== 'standard'
    && (
      variant.target.type === 'day'
        ? variant.target.dayId === day.id
        : stepIds.has(variant.target.stepId)
    )
  ))
}

function planBElementId(variantId: string) {
  return `plan-b-${variantId}`
}

/** Mène depuis l’étape ou la journée vers l’alternative regroupée dans Plans B. */
function PlanBHint({
  variants,
  context,
}: {
  variants: readonly TravelVariant[]
  context: string
}) {
  const [first] = variants
  if (!first) return null
  return (
    <button
      className="plan-b-hint"
      type="button"
      aria-label={`Voir le plan B prévu pour ${context}`}
      onClick={() => {
        const target = document.getElementById(planBElementId(first.id))
        target?.scrollIntoView?.({ block: 'center' })
        target?.focus()
      }}
    >
      <SwapIcon size={18} />
      <span>
        <strong>Plan B</strong> prévu{variants.length > 1 ? ` · ${variants.length} options` : ''}
      </span>
      <span className="plan-b-hint-action" aria-hidden="true">Voir</span>
    </button>
  )
}

const STEP_PROGRESS_BADGES: Partial<Record<StepProgress, string>> = {
  current: 'En cours',
  next: 'Prochaine étape',
}

function Timeline({
  travel,
  day,
  progress,
  personalState,
  onNavigate,
  ...actions
}: {
  travel: Travel
  day: TravelDay
  progress?: readonly StepProgress[]
  personalState: PersonalStateProps
  onNavigate(view: TravelView): void
} & ActionProps) {
  return (
    <section className="timeline-section" aria-labelledby={`timeline-${day.id}`}>
      <h3 id={`timeline-${day.id}`}>Déroulé</h3>
      {day.steps.length === 0 ? (
        <p className="empty-state">Aucune étape n’est renseignée pour cette journée.</p>
      ) : (
        <ol className="timeline">
          {day.steps.map((step, index) => {
            const place = findPlace(travel, step.placeId)
            const contextualLinks = uniqueContextualLinks(step.links, place?.links)
            const hasLocalIllustration = step.illustrationIds.some(
              (illustrationId) => illustrationById(travel, illustrationId),
            )
            const illustrationLink = hasLocalIllustration
              ? stepIllustrationLink(step.links, place?.links)
              : undefined
            const remainingLinks = linksNotCarriedByIllustration(
              contextualLinks,
              illustrationLink,
            )
            const documents = documentsById(travel, step.documentIds)
            const reservations = reservationsById(travel, step.reservationIds)
            const stepChecklists = travel.checklists.filter(
              (checklist) => checklist.target.type === 'step'
                && checklist.target.stepId === step.id,
            )
            const stepVariants = travel.variants.filter(
              (variant) => variant.kind !== 'standard'
                && variant.target.type === 'step'
                && variant.target.stepId === step.id,
            )
            const stepState = progress?.[index] ?? 'upcoming'
            const badge = STEP_PROGRESS_BADGES[stepState]
            const openStep = () => onNavigate({ kind: 'step', stepId: step.id })
            return (
              <li key={step.id} className={`timeline-step timeline-step-${stepState}`}>
                <span className="timeline-dot" aria-hidden="true">
                  {stepState === 'done' && <CheckIcon size={14} />}
                </span>
                <article className="step-content" aria-labelledby={`step-${step.id}`}>
                  {badge && <p className="step-badge">{badge}</p>}
                  {stepState === 'done' && <p className="visually-hidden">Étape passée</p>}
                  <div className="step-heading">
                    <p className="step-time">
                      {step.startsAt ? (
                        <>
                          <time dateTime={step.startsAt}>{step.startsAt}</time>
                          {step.endsAt && (
                            <>
                              <span aria-hidden="true">–</span>
                              <time dateTime={step.endsAt}>{step.endsAt}</time>
                            </>
                          )}
                        </>
                      ) : (
                        'Sans horaire'
                      )}
                    </p>
                    <h4 id={`step-${step.id}`}>{step.title}</h4>
                    {place && (
                      <p className="step-place">
                        <MapPinIcon size={16} />
                        <span className="visually-hidden">Lieu : </span>
                        <span>{place.label}</span>
                      </p>
                    )}
                    <button
                      className="step-open-button"
                      type="button"
                      aria-label={`Ouvrir l’étape ${step.title}`}
                      onClick={openStep}
                    >
                      <ChevronRightIcon size={20} />
                    </button>
                  </div>
                  {step.description && <p className="step-description">{step.description}</p>}
                  <IllustrationCollection
                    travel={travel}
                    illustrationIds={step.illustrationIds}
                    practicalLink={illustrationLink}
                    practicalLinkContext={step.title}
                    online={actions.online}
                    onLoadResource={actions.onLoadIllustrationResource}
                  />
                  <ContextualLinkList
                    links={remainingLinks}
                    online={actions.online}
                    context={step.title}
                  />
                  {step.accommodationId && (
                    <button
                      className="text-button"
                      type="button"
                      aria-label={`Voir l’hébergement associé à ${step.title}`}
                      onClick={() => onNavigate({ kind: 'practical' })}
                    >
                      Voir l’hébergement
                    </button>
                  )}
                  <PlanBHint variants={stepVariants} context={step.title} />
                  <ChecklistCollection
                    checklists={stepChecklists}
                    {...personalState}
                  />
                  <StepRelatedContent
                    travel={travel}
                    context={step.title}
                    documents={documents}
                    reservations={reservations}
                    online={actions.online}
                    onOpenDocument={actions.onOpenDocument}
                    excludedDocumentIds={new Set(step.documentIds)}
                  />
                </article>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function PlansB({
  travel,
  day,
}: {
  travel: Travel
  day: TravelDay
}) {
  const variants = dayVariants(travel, day)
  if (variants.length === 0) return null

  return (
    <section className="plans-b" aria-labelledby={`plans-b-${day.id}`}>
      <h3 id={`plans-b-${day.id}`}>Plans B</h3>
      <ul>
        {variants.map((variant) => {
          const { target } = variant
          const targetStep = target.type === 'step'
            ? day.steps.find((step) => step.id === target.stepId)
            : undefined
          return (
            <li key={variant.id} id={planBElementId(variant.id)} tabIndex={-1}>
              <p className="plan-b-kind">
                <SwapIcon size={16} />
                {VARIANT_LABELS[variant.kind]}
              </p>
              <strong>{variant.label}</strong>
              <p>{variant.description}</p>
              <p className="plan-b-target">
                {targetStep ? `Remplace ou complète : ${targetStep.title}` : 'Pour toute la journée'}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function DayComplements({
  travel,
  day,
  personalState,
}: {
  travel: Travel
  day: TravelDay
  personalState: PersonalStateProps
}) {
  const dayChecklists = travel.checklists.filter(
    (checklist) => checklist.target.type === 'day'
      && checklist.target.dayId === day.id,
  )
  const hasVariants = dayVariants(travel, day).length > 0

  // Les documents et réservations de la journée sont présentés une seule fois,
  // dans la bande « Pièces du jour ».
  if (dayChecklists.length === 0 && !hasVariants) return null

  return (
    <aside className="day-sidebar" aria-label="Compléments de la journée">
      <PlansB travel={travel} day={day} />
      {dayChecklists.length > 0 && (
        <section aria-labelledby={`day-checklists-${day.id}`}>
          <h3 id={`day-checklists-${day.id}`}>Checklist de la journée</h3>
          <ChecklistCollection checklists={dayChecklists} {...personalState} />
        </section>
      )}
    </aside>
  )
}

/** Hébergement de la date, rappelé comme repère sans répéter sa fiche. */
function DayAnchor({
  travel,
  day,
  onCopyAddress,
}: {
  travel: Travel
  day: TravelDay
  onCopyAddress(address: string, placeLabel: string): Promise<boolean>
}) {
  const anchor = findAccommodationForDate(travel, day.date)
  if (!anchor) return null
  const { accommodation, place } = anchor
  const arrival = accommodation.period.start === day.date

  return (
    <div className="day-anchor">
      <HomeIcon size={20} className="day-anchor-icon" />
      <p className="day-anchor-text">
        {arrival ? 'Hébergement' : 'Départ'} : <strong>{accommodation.label}</strong>
      </p>
      {place?.address && (
        <CopyAddressButton
          address={place.address}
          placeLabel={place.label}
          targetLabel={accommodation.label}
          iconOnly
          onCopyAddress={onCopyAddress}
        />
      )}
    </div>
  )
}

function DayDetail({
  travel,
  day,
  isToday,
  progress,
  personalState,
  onNavigate,
  ...actions
}: {
  travel: Travel
  day: TravelDay
  isToday: boolean
  progress?: readonly StepProgress[]
  personalState: PersonalStateProps
  onNavigate(view: TravelView): void
} & ActionProps) {
  const dayLevelVariants = travel.variants.filter(
    (variant) => variant.kind !== 'standard'
      && variant.target.type === 'day'
      && variant.target.dayId === day.id,
  )

  return (
    <div className="program-layout">
      <div className="program-main">
        <header className="day-header">
          <div className="day-heading-meta">
            {isToday && (
              <span className="status-pill status-pill-terracotta">
                <ClockIcon size={15} />
                Aujourd’hui sur place
              </span>
            )}
            <p className="day-heading-date">
              <time dateTime={day.date}>{capitalize(formatDate(day.date, travel.locale))}</time>
            </p>
          </div>
          <h2 id="day-title" className="day-title">{day.title}</h2>
          {day.summary && <p className="day-summary">{day.summary}</p>}
          <DayAnchor travel={travel} day={day} onCopyAddress={actions.onCopyAddress} />
          <PlanBHint variants={dayLevelVariants} context="cette journée" />
          <IllustrationCollection
            travel={travel}
            illustrationIds={day.illustrationIds}
            limit={1}
            cover
            onLoadResource={actions.onLoadIllustrationResource}
          />
        </header>
        <DayPieces travel={travel} day={day} onNavigate={onNavigate} />
        <Timeline
          travel={travel}
          day={day}
          progress={progress}
          personalState={personalState}
          onNavigate={onNavigate}
          {...actions}
        />
        <AdjacentDayControls travel={travel} selectedDayId={day.id} onNavigate={onNavigate} />
      </div>
      <DayComplements
        travel={travel}
        day={day}
        personalState={personalState}
      />
    </div>
  )
}

function ProgramView({
  travel,
  view,
  clock,
  personalState,
  onNavigate,
  ...actions
}: {
  travel: Travel
  view: Extract<TravelView, { kind: 'day' | 'today' }>
  clock: Clock
  personalState: PersonalStateProps
  onNavigate(view: TravelView): void
} & ActionProps) {
  const today = getTodayState(travel, clock)
  const todayDayId = today.status === 'day' ? today.day.id : undefined
  const day = view.kind === 'day'
    ? travel.days.find((candidate) => candidate.id === view.dayId)
    : today.status === 'day'
      ? today.day
      : undefined
  const isToday = Boolean(day && day.id === todayDayId)
  const [, setMinuteTick] = useState(0)

  // La progression du jour suit l’heure tant que la journée reste affichée.
  useEffect(() => {
    if (!isToday) return
    const timer = window.setInterval(() => setMinuteTick((tick) => tick + 1), 60_000)
    return () => window.clearInterval(timer)
  }, [isToday])

  const progress = day && isToday
    ? stepProgress(day.steps, localTimeInTimeZone(clock.now(), travel.timeZone))
    : undefined

  let statusMessage: string | undefined
  if (view.kind === 'today' && today.status !== 'day') {
    statusMessage = today.status === 'before'
      ? `Ce voyage n’a pas encore commencé. Il débute le ${formatDate(travel.period.start, travel.locale)}.`
      : today.status === 'after'
        ? `Ce voyage est terminé depuis le ${formatDate(travel.period.end, travel.locale)}.`
        : `Aucune journée n’est prévue pour le ${formatDate(today.date, travel.locale)}, bien que cette date soit comprise dans le séjour.`
  }

  return (
    <div className="consultation-view program-view" aria-labelledby="program-title">
      <h2 id="program-title" className="visually-hidden">Programme</h2>
      {travel.days.length === 0 ? (
        <p className="empty-state">Ce voyage ne contient aucune journée.</p>
      ) : (
        <>
          <DaySelector
            travel={travel}
            selectedDayId={day?.id}
            todayDayId={todayDayId}
            onNavigate={onNavigate}
          />
          {statusMessage && (
            <p className="empty-state today-status" role="status">{statusMessage}</p>
          )}
          {day && (
            <DayDetail
              travel={travel}
              day={day}
              isToday={isToday}
              progress={progress}
              personalState={personalState}
              onNavigate={onNavigate}
              {...actions}
            />
          )}
        </>
      )}
    </div>
  )
}

function accommodationAssociations(travel: Travel, accommodationId: string) {
  const reservationIds = new Set<string>()
  const documentIds = new Set<string>()
  for (const day of travel.days) {
    for (const step of day.steps) {
      if (step.accommodationId !== accommodationId) continue
      step.reservationIds.forEach((id) => reservationIds.add(id))
      step.documentIds.forEach((id) => documentIds.add(id))
    }
  }
  return { reservationIds, documentIds }
}

function AccommodationDetails({
  travel,
  accommodation,
  online,
  onCopyAddress,
  onOpenDocument,
}: {
  travel: Travel
  accommodation: TravelAccommodation
  online: boolean
  onCopyAddress(address: string, placeLabel: string): Promise<boolean>
  onOpenDocument(document: TravelDocument): void
}) {
  const place = findPlace(travel, accommodation.placeId)
  const associations = accommodationAssociations(travel, accommodation.id)
  const reservations = reservationsById(travel, [...associations.reservationIds])
  const reservationDocumentIds = new Set(
    reservations.flatMap((reservation) => reservation.documentIds),
  )
  const documents = documentsById(
    travel,
    [...associations.documentIds].filter((id) => !reservationDocumentIds.has(id)),
  )

  return (
    <article className="practical-card accommodation-details" id={`accommodation-${accommodation.id}`}>
      <p className="card-label">Hébergement</p>
      <h3>{accommodation.label}</h3>
      <p>
        <time dateTime={accommodation.period.start}>
          {formatCompactDate(accommodation.period.start, travel.locale)}
        </time>
        {' '}–{' '}
        <time dateTime={accommodation.period.end}>
          {formatCompactDate(accommodation.period.end, travel.locale)}
        </time>
      </p>
      {place?.address && (
        <>
          <address>{place.address}</address>
          <CopyAddressButton
            address={place.address}
            placeLabel={place.label}
            targetLabel={accommodation.label}
            onCopyAddress={onCopyAddress}
          />
        </>
      )}
      {place && place.links.length > 0 && (
        <ul className="practical-link-list">
          {uniqueContextualLinks(place.links).map((link) => (
            <li key={link.id}>
              <ExternalLink
                link={link}
                online={online}
                context={accommodation.label}
              />
            </li>
          ))}
        </ul>
      )}
      {reservations.map((reservation) => (
        <ReservationDetails
          key={reservation.id}
          travel={travel}
          reservation={reservation}
          online={online}
          onOpenDocument={onOpenDocument}
        />
      ))}
      {documents.length > 0 && (
        <section aria-label={`Documents de ${accommodation.label}`}>
          <h4>Documents</h4>
          <ul className="compact-action-list">
            {documents.map((document) => (
              <li key={document.id}>
                <DocumentButton
                  document={document}
                  context={accommodation.label}
                  onOpenDocument={onOpenDocument}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}

function pieceAttachmentText(
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

interface PieceRowProps {
  piece: TravelPiece
  groupDayId?: string
  locale: string
  missingLocally: boolean
  /** Remplace la liste des rattachements lorsque le contexte la rend redondante. */
  detail?: string
}

function pieceAttachmentsText({ piece, groupDayId, locale, detail }: PieceRowProps) {
  if (detail) return detail
  return piece.attachments.length === 0
    ? 'Tout le voyage'
    : piece.attachments
      .map((attachment) => pieceAttachmentText(attachment, groupDayId, locale))
      .join(' ; ')
}

function pieceView(piece: TravelPiece): TravelView {
  return { kind: 'piece', pieceKind: piece.kind, pieceId: piece.id }
}

/** Nom accessible ponctué : les fragments visuels ne sont pas collés entre eux. */
function pieceRowLabel(props: PieceRowProps) {
  const { piece, missingLocally } = props
  const format = piece.kind === 'document' ? 'PDF' : 'Réservation'
  return [
    `Voir la fiche ${piece.label}`,
    pieceAttachmentsText(props),
    `${format}, Dossier${missingLocally ? ', absent de cet appareil' : ''}`,
  ].join(' — ')
}

function PieceRowContent(props: PieceRowProps) {
  const { piece, missingLocally } = props
  const isDocument = piece.kind === 'document'
  return (
    <>
      <span
        className={isDocument ? 'piece-icon piece-icon-document' : 'piece-icon piece-icon-reservation'}
        aria-hidden="true"
      >
        {isDocument ? <FileIcon size={22} /> : <TicketIcon size={22} />}
      </span>
      <span className="piece-text">
        <span className="piece-title">{piece.label}</span>
        <span className="piece-attachments">{pieceAttachmentsText(props)}</span>
        <span className="piece-badges">
          <span className="piece-badge">{isDocument ? 'PDF' : 'Réservation'}</span>
          <span className="piece-badge">Dossier</span>
          {missingLocally && (
            <span className="piece-badge piece-badge-warning">Absent de cet appareil</span>
          )}
        </span>
      </span>
      <ChevronRightIcon size={20} className="piece-chevron" />
    </>
  )
}

/** Ressources réellement présentes sur l’appareil ; `undefined` tant qu’elles sont inconnues. */
function useLocalResourceIds(
  travelId: string,
  onListLocalResourceIds: (travelId: string) => Promise<readonly string[] | undefined>,
) {
  const [localResourceIds, setLocalResourceIds] = useState<ReadonlySet<string>>()

  useEffect(() => {
    let active = true
    void onListLocalResourceIds(travelId).then((ids) => {
      if (active) setLocalResourceIds(ids ? new Set(ids) : undefined)
    })
    return () => {
      active = false
    }
  }, [onListLocalResourceIds, travelId])

  return localResourceIds
}

function PiecesView({
  travel,
  onNavigate,
  onListLocalResourceIds,
}: {
  travel: Travel
  onNavigate(view: TravelView): void
  onListLocalResourceIds(travelId: string): Promise<readonly string[] | undefined>
}) {
  const localResourceIds = useLocalResourceIds(travel.id, onListLocalResourceIds)
  const pieces = listTravelPieces(travel)
  const groups = groupTravelPiecesByDay(travel, pieces)

  const allStoredLocally = localResourceIds !== undefined
    && allDocumentsStoredLocally(travel, localResourceIds)

  return (
    <div className="consultation-view pieces-view" aria-labelledby="pieces-title">
      <header className="section-heading">
        <p className="section-label">Pièces</p>
        <h2 id="pieces-title">Pièces du voyage</h2>
        <p>
          {pieces.length === 0
            ? 'Aucune pièce'
            : `${pieces.length} ${pieces.length > 1 ? 'pièces' : 'pièce'}`}
        </p>
      </header>
      {pieces.length === 0 && (
        <p className="empty-state">
          Ce voyage ne contient aucun document ni aucune réservation. Les billets,
          confirmations et autres pièces du dossier apparaîtront ici.
        </p>
      )}
      {allStoredLocally && (
        <p className="pieces-offline-badge">
          <DownloadIcon size={16} />
          <span>Toutes disponibles hors connexion</span>
        </p>
      )}
      {groups.map((group) => {
        const groupDayId = group.type === 'day' ? group.day.id : undefined
        const titleId = group.type === 'day'
          ? `pieces-group-${group.day.id}`
          : 'pieces-group-travel'
        return (
          <section className="pieces-group" key={titleId} aria-labelledby={titleId}>
            <h3 className="pieces-group-title" id={titleId}>
              {group.type === 'travel'
                ? 'Tout le voyage'
                : (
                    <>
                      <time dateTime={group.day.date}>
                        {formatCompactDate(group.day.date, travel.locale)}
                      </time>{' '}
                      <span className="pieces-group-day">{group.day.title}</span>
                    </>
                  )}
            </h3>
            <ul className="pieces-list">
              {group.pieces.map((piece) => {
                const missingLocally = piece.kind === 'document'
                  && localResourceIds !== undefined
                  && !localResourceIds.has(piece.document.resourceId)
                const rowProps = {
                  piece,
                  groupDayId,
                  locale: travel.locale,
                  missingLocally,
                }
                return (
                  <li key={`${piece.kind}:${piece.id}`}>
                    <button
                      className="piece-row"
                      type="button"
                      aria-label={pieceRowLabel(rowProps)}
                      onClick={() => onNavigate(pieceView(piece))}
                    >
                      <PieceRowContent {...rowProps} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/** Rattachements d’une pièce limités à la journée affichée. */
function dayAttachmentsText(piece: TravelPiece, day: TravelDay, locale: string) {
  return piece.attachments
    .filter((attachment) => attachment.day.id === day.id)
    .map((attachment) => pieceAttachmentText(attachment, day.id, locale))
    .join(' ; ')
}

/** Bande « Pièces du jour » : accès rapide aux fiches des pièces de la journée. */
function DayPieces({
  travel,
  day,
  onNavigate,
}: {
  travel: Travel
  day: TravelDay
  onNavigate(view: TravelView): void
}) {
  const pieces = piecesForDay(listTravelPieces(travel), day.id)
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
          const isDocument = piece.kind === 'document'
          const detail = dayAttachmentsText(piece, day, travel.locale)
          const format = isDocument ? 'PDF' : 'Réservation'
          return (
            <li key={`${piece.kind}:${piece.id}`}>
              <button
                className="day-piece-card"
                type="button"
                aria-label={[`Voir la fiche ${piece.label}`, detail, format].join(' — ')}
                onClick={() => onNavigate(pieceView(piece))}
              >
                <span
                  className={isDocument ? 'piece-icon piece-icon-document' : 'piece-icon piece-icon-reservation'}
                  aria-hidden="true"
                >
                  {isDocument ? <FileIcon size={22} /> : <TicketIcon size={22} />}
                </span>
                <span className="piece-text">
                  <span className="piece-title">{piece.label}</span>
                  <span className="piece-attachments">{detail}</span>
                </span>
                <span className="day-piece-footer">
                  <span className="day-piece-format">{format}</span>
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

/** Espace d’une étape : son horaire, ses réservations, ses pièces et ses liens. */
function StepView({
  travel,
  day,
  step,
  online,
  onNavigate,
  onOpenDocument,
}: {
  travel: Travel
  day: TravelDay
  step: TravelStep
  online: boolean
  onNavigate(view: TravelView): void
  onOpenDocument(document: TravelDocument): void
}) {
  const place = findPlace(travel, step.placeId)
  const links = uniqueContextualLinks(step.links, place?.links)
  const reservations = reservationsById(travel, step.reservationIds)
  const documentPieces = documentPiecesForStep(listTravelPieces(travel), step.id)
  // Les documents de l’étape sont listés une fois, dans « Pièces de cette étape ».
  const listedDocumentIds = new Set(documentPieces.map((piece) => piece.id))

  return (
    <div className="consultation-view step-view" aria-labelledby="step-view-title">
      <button
        className="back-button"
        type="button"
        aria-label={`Retour à la journée : ${day.title}`}
        onClick={() => onNavigate({ kind: 'day', dayId: day.id })}
      >
        <ChevronLeftIcon size={20} />
        <span>
          <time dateTime={day.date}>{formatCompactDate(day.date, travel.locale)}</time>
          {' · '}
          {day.title}
        </span>
      </button>
      <header className="step-view-header">
        <p className="step-time">
          {step.startsAt ? (
            <>
              <time dateTime={step.startsAt}>{step.startsAt}</time>
              {step.endsAt && (
                <>
                  <span aria-hidden="true">–</span>
                  <time dateTime={step.endsAt}>{step.endsAt}</time>
                </>
              )}
            </>
          ) : (
            'Sans horaire'
          )}
        </p>
        <h2 id="step-view-title" className="step-view-title">{step.title}</h2>
        {place && (
          <p className="step-place">
            <MapPinIcon size={18} />
            <span className="visually-hidden">Lieu : </span>
            <span>{place.label}</span>
          </p>
        )}
        {step.description && <p className="step-description">{step.description}</p>}
      </header>
      {reservations.map((reservation) => (
        <ReservationDetails
          key={reservation.id}
          travel={travel}
          reservation={reservation}
          online={online}
          onOpenDocument={onOpenDocument}
          excludedDocumentIds={listedDocumentIds}
        />
      ))}
      {documentPieces.length > 0 && (
        <section className="pieces-group" aria-labelledby="step-pieces-title">
          <h3 className="pieces-group-title" id="step-pieces-title">
            Pièces de cette étape · {documentPieces.length}
          </h3>
          <ul className="pieces-list">
            {documentPieces.map((piece) => {
              const rowProps = {
                piece,
                locale: travel.locale,
                missingLocally: false,
                detail: 'Document du dossier',
              }
              return (
                <li key={piece.id}>
                  <button
                    className="piece-row"
                    type="button"
                    aria-label={pieceRowLabel(rowProps)}
                    onClick={() => onNavigate(pieceView(piece))}
                  >
                    <PieceRowContent {...rowProps} />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {links.length > 0 && (
        <section className="step-view-links" aria-labelledby="step-links-title">
          <h3 className="pieces-group-title" id="step-links-title">Liens utiles</h3>
          <ContextualLinkList links={links} online={online} context={step.title} />
        </section>
      )}
      {step.accommodationId && (
        <button
          className="text-button"
          type="button"
          aria-label={`Voir l’hébergement associé à ${step.title}`}
          onClick={() => onNavigate({ kind: 'practical' })}
        >
          Voir l’hébergement
        </button>
      )}
    </div>
  )
}

function attachmentTarget(attachment: TravelPieceAttachment): TravelView {
  return attachment.type === 'day'
    ? { kind: 'day', dayId: attachment.day.id }
    : { kind: 'step', stepId: attachment.step.id }
}

function documentStorageText(present: boolean | undefined) {
  if (present === undefined) return 'Stockage local du voyage, non vérifié'
  return present
    ? 'Sur cet appareil, disponible hors connexion'
    : 'Absent de cet appareil'
}

/**
 * Fiche d’une pièce du dossier, en lecture seule. Aucun aperçu n’est rendu :
 * l’application n’embarque pas de lecteur PDF et n’affiche pas d’aperçu factice.
 */
function PieceSheetView({
  travel,
  piece,
  online,
  onNavigate,
  onOpenDocument,
  onListLocalResourceIds,
}: {
  travel: Travel
  piece: TravelPiece
  online: boolean
  onNavigate(view: TravelView): void
  onOpenDocument(document: TravelDocument): void
  onListLocalResourceIds(travelId: string): Promise<readonly string[] | undefined>
}) {
  const localResourceIds = useLocalResourceIds(travel.id, onListLocalResourceIds)
  const isDocument = piece.kind === 'document'
  const present = piece.kind === 'document' && localResourceIds
    ? localResourceIds.has(piece.document.resourceId)
    : undefined

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
        <span
          className={isDocument ? 'piece-icon piece-icon-document' : 'piece-icon piece-icon-reservation'}
          aria-hidden="true"
        >
          {isDocument ? <FileIcon size={24} /> : <TicketIcon size={24} />}
        </span>
        <div className="piece-sheet-heading">
          <h2 id="piece-sheet-title" className="piece-sheet-title">{piece.label}</h2>
          <p className="piece-badges">
            <span className="piece-badge">{isDocument ? 'PDF' : 'Réservation'}</span>
            <span className="piece-badge">Dossier</span>
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
      <dl className="piece-sheet-metadata">
        <div>
          <dt>Format</dt>
          <dd>{isDocument ? 'PDF' : 'Réservation'}</dd>
        </div>
        <div>
          <dt>Stockage</dt>
          <dd>
            {isDocument
              ? documentStorageText(present)
              : 'Enregistrée avec le voyage sur cet appareil'}
          </dd>
        </div>
        <div>
          <dt>Origine</dt>
          <dd>Fournie avec le dossier du voyage</dd>
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
      <p className="piece-sheet-note">
        <ShieldIcon size={18} />
        <span>Pièce du dossier : en lecture seule.</span>
      </p>
    </div>
  )
}

function PracticalView({
  travel,
  online,
  onCopyAddress,
  onOpenDocument,
}: {
  travel: Travel
  online: boolean
  onCopyAddress(address: string, placeLabel: string): Promise<boolean>
  onOpenDocument(document: TravelDocument): void
}) {
  const accommodationPlaceIds = new Set(
    travel.accommodations.map((accommodation) => accommodation.placeId),
  )
  const accommodationReservationIds = new Set<string>()
  const accommodationDocumentIds = new Set<string>()
  travel.accommodations.forEach((accommodation) => {
    const associations = accommodationAssociations(travel, accommodation.id)
    associations.reservationIds.forEach((id) => accommodationReservationIds.add(id))
    associations.documentIds.forEach((id) => accommodationDocumentIds.add(id))
  })
  travel.reservations
    .filter((reservation) => accommodationReservationIds.has(reservation.id))
    .forEach((reservation) => {
      reservation.documentIds.forEach((id) => accommodationDocumentIds.add(id))
    })
  const otherPlaces = travel.places.filter((place) => !accommodationPlaceIds.has(place.id))
  const otherReservations = travel.reservations.filter(
    (reservation) => !accommodationReservationIds.has(reservation.id),
  )
  const otherDocuments = travel.documents.filter(
    (document) => !accommodationDocumentIds.has(document.id),
  )
  const hasCredits = referencedIllustrations(travel).length > 0
  const hasPracticalContent = travel.accommodations.length > 0
    || otherPlaces.length > 0
    || otherReservations.length > 0
    || otherDocuments.length > 0
    || hasCredits

  return (
    <div className="consultation-view practical-view" aria-labelledby="practical-title">
      <header className="section-heading">
        <p className="section-label">Pratique</p>
        <h2 id="practical-title">Repères et documents utiles</h2>
        <p>Les informations stables du voyage sont regroupées ici pour éviter leur répétition dans le programme.</p>
      </header>
      {!hasPracticalContent && (
        <p className="empty-state">Aucune information pratique structurée n’est associée à ce voyage.</p>
      )}
      {travel.accommodations.length > 0 && (
        <section className="practical-group" aria-labelledby="accommodations-title">
          <h3 id="accommodations-title">Hébergements</h3>
          <div className="practical-card-grid">
            {travel.accommodations.map((accommodation) => (
              <AccommodationDetails
                key={accommodation.id}
                travel={travel}
                accommodation={accommodation}
                online={online}
                onCopyAddress={onCopyAddress}
                onOpenDocument={onOpenDocument}
              />
            ))}
          </div>
        </section>
      )}
      {otherPlaces.length > 0 && (
        <section className="practical-group" aria-labelledby="places-title">
          <h3 id="places-title">Lieux et transports utiles</h3>
          <div className="practical-card-grid">
            {otherPlaces.map((place) => (
              <article className="practical-card" key={place.id}>
                <h4>{place.label}</h4>
                {place.address && <address>{place.address}</address>}
                {place.links.length > 0 && (
                  <ul className="practical-link-list">
                    {uniqueContextualLinks(place.links).map((link) => (
                      <li key={link.id}>
                        <ExternalLink
                          link={link}
                          online={online}
                          context={place.label}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      {otherReservations.length > 0 && (
        <section className="practical-group" aria-labelledby="reservations-title">
          <h3 id="reservations-title">Réservations</h3>
          <div className="practical-card-grid">
            {otherReservations.map((reservation) => (
              <ReservationDetails
                key={reservation.id}
                travel={travel}
                reservation={reservation}
                online={online}
                onOpenDocument={onOpenDocument}
              />
            ))}
          </div>
        </section>
      )}
      {otherDocuments.length > 0 && (
        <section className="practical-group" aria-labelledby="documents-title">
          <h3 id="documents-title">Documents</h3>
          <ul className="document-index">
            {otherDocuments.map((document) => (
              <li key={document.id}>
                <div>
                  <strong>{document.label}</strong>
                  {document.description && <p>{document.description}</p>}
                </div>
                <DocumentButton
                  document={document}
                  context={travel.title}
                  onOpenDocument={onOpenDocument}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      <IllustrationCredits travel={travel} online={online} />
    </div>
  )
}

function pendingReservation(reservation: TravelReservation) {
  return Boolean(reservation.status && (
    /à confirmer|a confirmer|en attente|pending|provisoire|tentative/i
      .test(reservation.status)
  ))
}

function PreparationView({
  travel,
  personalState,
  online,
  onOpenDocument,
  initialNote,
  noteSaveDelayMs,
  onSaveNote,
}: {
  travel: Travel
  personalState: PersonalStateProps
  online: boolean
  onOpenDocument(document: TravelDocument): void
  initialNote: string
  noteSaveDelayMs: number
  onSaveNote(text: string): Promise<PersonalSaveResult>
}) {
  const travelChecklists = travel.checklists.filter(
    (checklist) => checklist.target.type === 'travel',
  )
  const dayGroups = travel.days.flatMap((day) => {
    const dayChecklists = travel.checklists.filter(
      (checklist) => checklist.target.type === 'day'
        && checklist.target.dayId === day.id,
    )
    const steps = day.steps.flatMap((step) => {
      const checklists = travel.checklists.filter(
        (checklist) => checklist.target.type === 'step'
          && checklist.target.stepId === step.id,
      )
      return checklists.length > 0 ? [{ step, checklists }] : []
    })
    return dayChecklists.length > 0 || steps.length > 0
      ? [{ day, dayChecklists, steps }]
      : []
  })
  const pendingReservations = travel.reservations.filter(pendingReservation)

  return (
    <div className="consultation-view preparation-view" aria-labelledby="preparation-title">
      <header className="section-heading">
        <p className="section-label">Préparation</p>
        <h2 id="preparation-title">À préparer et à confirmer</h2>
      </header>
      {travelChecklists.length > 0 && (
        <section className="preparation-group" aria-labelledby="travel-checklists-title">
          <h3 id="travel-checklists-title">Pour le voyage</h3>
          <ChecklistCollection checklists={travelChecklists} {...personalState} />
        </section>
      )}
      {dayGroups.length > 0 && (
        <section className="preparation-group" aria-labelledby="targeted-checklists-title">
          <h3 id="targeted-checklists-title">Par journée et étape</h3>
          <div className="preparation-day-list">
            {dayGroups.map(({ day, dayChecklists, steps }) => (
              <article className="preparation-day" key={day.id}>
                <header>
                  <time dateTime={day.date}>{formatCompactDate(day.date, travel.locale)}</time>
                  <h4>{day.title}</h4>
                </header>
                <ChecklistCollection checklists={dayChecklists} {...personalState} />
                {steps.map(({ step, checklists }) => (
                  <section className="preparation-step" key={step.id}>
                    <h5>{step.title}</h5>
                    <ChecklistCollection checklists={checklists} {...personalState} />
                  </section>
                ))}
              </article>
            ))}
          </div>
        </section>
      )}
      {pendingReservations.length > 0 && (
        <section className="preparation-group" aria-labelledby="pending-reservations-title">
          <h3 id="pending-reservations-title">À confirmer</h3>
          <div className="practical-card-grid">
            {pendingReservations.map((reservation) => (
              <ReservationDetails
                key={reservation.id}
                travel={travel}
                reservation={reservation}
                online={online}
                onOpenDocument={onOpenDocument}
              />
            ))}
          </div>
        </section>
      )}
      {travel.checklists.length === 0 && pendingReservations.length === 0 && (
        <p className="empty-state">Aucune préparation structurée n’est associée à ce voyage.</p>
      )}
      <NotesPanel
        initialNote={initialNote}
        saveDelayMs={noteSaveDelayMs}
        onSave={onSaveNote}
      />
    </div>
  )
}

function viewLabel(view: TravelView, travel: Travel) {
  if (view.kind === 'summary') return 'Aperçu'
  if (view.kind === 'pieces') return 'Pièces'
  if (view.kind === 'piece') {
    const label = findTravelPiece(travel, view.pieceKind, view.pieceId)?.label
    return label ? `Pièce — ${label}` : 'Pièce'
  }
  if (view.kind === 'step') {
    const stepTitle = findStepWithDay(travel, view.stepId)?.step.title
    return stepTitle ? `Étape — ${stepTitle}` : 'Étape'
  }
  if (view.kind === 'practical') return 'Pratique'
  if (view.kind === 'preparation') return 'Préparation'
  if (view.kind === 'today') return 'Programme d’aujourd’hui'
  const dayTitle = travel.days.find((day) => day.id === view.dayId)?.title
  return dayTitle ? `Programme — ${dayTitle}` : 'Programme'
}

export function TravelConsultation({
  persistedTravel,
  view,
  clock,
  online,
  actionFeedback,
  personalState,
  noteSaveDelayMs = 500,
  onNavigate,
  onBackToLibrary,
  onCopyAddress,
  onOpenDocument,
  onLoadIllustrationResource,
  onListLocalResourceIds,
  onSetChecklistItemChecked,
  onSaveNote,
}: TravelConsultationProps) {
  const { travel } = persistedTravel
  const [checkedItemKeys, setCheckedItemKeys] = useState(
    () => new Set(personalState.checkedItemKeys),
  )
  const [checklistFeedback, setChecklistFeedback] = useState<
    Record<string, 'saving' | 'saved' | 'error'>
  >({})
  const selectedDay = view.kind === 'day'
    ? travel.days.find((day) => day.id === view.dayId)
    : undefined
  const selectedStep = view.kind === 'step'
    ? findStepWithDay(travel, view.stepId)
    : undefined
  const selectedPiece = view.kind === 'piece'
    ? findTravelPiece(travel, view.pieceKind, view.pieceId)
    : undefined
  const safeView = (view.kind === 'day' && !selectedDay)
    || (view.kind === 'step' && !selectedStep)
    || (view.kind === 'piece' && !selectedPiece)
    ? { kind: 'summary' } as const
    : view
  const programActive = safeView.kind === 'day'
    || safeView.kind === 'today'
    || safeView.kind === 'step'
  const workspaceRef = useRef<HTMLElement>(null)
  const todayState = getTodayState(travel, clock)
  const programDay = safeView.kind === 'day'
    ? selectedDay
    : safeView.kind === 'step'
      ? selectedStep?.day
      : safeView.kind === 'today' && todayState.status === 'day'
        ? todayState.day
        : undefined
  const programDayIndex = programDay ? travel.days.indexOf(programDay) : -1
  const viewKey = safeView.kind === 'day'
    ? `day:${safeView.dayId}`
    : safeView.kind === 'step'
      ? `step:${safeView.stepId}`
      : safeView.kind === 'piece'
        ? `piece:${safeView.pieceKind}:${safeView.pieceId}`
        : safeView.kind
  const previousViewKey = useRef(viewKey)

  useEffect(() => {
    if (previousViewKey.current === viewKey) return
    previousViewKey.current = viewKey
    workspaceRef.current?.scrollIntoView?.({ block: 'start' })
  }, [viewKey])
  const actions = {
    online,
    onCopyAddress,
    onOpenDocument,
    onLoadIllustrationResource,
  }

  async function toggleChecklistItem(
    checklistId: string,
    itemId: string,
    checked: boolean,
  ) {
    const key = checklistItemStateKey(checklistId, itemId)
    const previous = checkedItemKeys.has(key)
    setCheckedItemKeys((current) => {
      const next = new Set(current)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
    setChecklistFeedback((current) => ({ ...current, [key]: 'saving' }))
    const result = await onSetChecklistItemChecked(checklistId, itemId, checked)
    if (!result.ok) {
      setCheckedItemKeys((current) => {
        const next = new Set(current)
        if (previous) next.add(key)
        else next.delete(key)
        return next
      })
    }
    setChecklistFeedback((current) => ({
      ...current,
      [key]: result.ok ? 'saved' : 'error',
    }))
  }

  const checklistState = {
    checkedItemKeys,
    checklistFeedback,
    onToggleChecklistItem: (
      checklistId: string,
      itemId: string,
      checked: boolean,
    ) => {
      void toggleChecklistItem(checklistId, itemId, checked)
    },
  }

  const sections: readonly {
    readonly label: string
    readonly icon: typeof CompassIcon
    readonly active: boolean
    readonly target: () => TravelView
  }[] = [
    { label: 'Aperçu', icon: CompassIcon, active: safeView.kind === 'summary', target: () => ({ kind: 'summary' }) },
    { label: 'Programme', icon: ListIcon, active: programActive, target: () => programTarget(travel, clock) },
    { label: 'Pièces', icon: PaperclipIcon, active: safeView.kind === 'pieces' || safeView.kind === 'piece', target: () => ({ kind: 'pieces' }) },
    { label: 'Pratique', icon: InfoIcon, active: safeView.kind === 'practical', target: () => ({ kind: 'practical' }) },
    { label: 'Préparation', icon: ChecklistIcon, active: safeView.kind === 'preparation', target: () => ({ kind: 'preparation' }) },
  ]

  return (
    <section ref={workspaceRef} className="travel-workspace" aria-label={`Voyage ${travel.title}`}>
      {safeView.kind !== 'summary' && (
        <header className="travel-topbar">
          <BackToLibraryButton onBackToLibrary={onBackToLibrary} />
          <div className="travel-topbar-text">
            <h1 className="travel-topbar-title">{travel.title}</h1>
            {programDayIndex >= 0 && (
              <p className="travel-topbar-subtitle">
                Jour {programDayIndex + 1} sur {travel.days.length}
              </p>
            )}
          </div>
        </header>
      )}
      <p className="visually-hidden" role="status" aria-live="polite">
        Section active : {viewLabel(safeView, travel)}
      </p>
      {actionFeedback && (
        <p
          className={`action-message travel-feedback ${actionFeedback.status === 'error'
            ? 'action-error'
            : 'action-success'}`}
          role={actionFeedback.status === 'error' ? 'alert' : 'status'}
        >
          {actionFeedback.message}
        </p>
      )}
      {safeView.kind === 'summary' && (
        <Overview
          travel={travel}
          clock={clock}
          onNavigate={onNavigate}
          onBackToLibrary={onBackToLibrary}
          onCopyAddress={onCopyAddress}
          onLoadIllustrationResource={onLoadIllustrationResource}
        />
      )}
      {(safeView.kind === 'day' || safeView.kind === 'today') && (
        <ProgramView
          travel={travel}
          view={safeView}
          clock={clock}
          personalState={checklistState}
          onNavigate={onNavigate}
          {...actions}
        />
      )}
      {safeView.kind === 'step' && selectedStep && (
        <StepView
          travel={travel}
          day={selectedStep.day}
          step={selectedStep.step}
          online={online}
          onNavigate={onNavigate}
          onOpenDocument={onOpenDocument}
        />
      )}
      {safeView.kind === 'pieces' && (
        <PiecesView
          travel={travel}
          onNavigate={onNavigate}
          onListLocalResourceIds={onListLocalResourceIds}
        />
      )}
      {safeView.kind === 'piece' && selectedPiece && (
        <PieceSheetView
          travel={travel}
          piece={selectedPiece}
          online={online}
          onNavigate={onNavigate}
          onOpenDocument={onOpenDocument}
          onListLocalResourceIds={onListLocalResourceIds}
        />
      )}
      {safeView.kind === 'practical' && (
        <PracticalView
          travel={travel}
          online={online}
          onCopyAddress={onCopyAddress}
          onOpenDocument={onOpenDocument}
        />
      )}
      {safeView.kind === 'preparation' && (
        <PreparationView
          travel={travel}
          personalState={checklistState}
          online={online}
          onOpenDocument={onOpenDocument}
          initialNote={personalState.note}
          noteSaveDelayMs={noteSaveDelayMs}
          onSaveNote={onSaveNote}
        />
      )}
      <nav className="travel-bottom-nav" aria-label="Sections du voyage">
        <ul>
          {sections.map(({ label, icon: SectionIcon, active, target }) => (
            <li key={label}>
              <button
                className="travel-nav-button"
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(target())}
              >
                <span className="travel-nav-icon" aria-hidden="true">
                  <SectionIcon size={22} />
                </span>
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  )
}
