import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import {
  findPlace,
  getTodayState,
  type Clock,
} from '../../application/travelConsultation'
import type {
  Travel,
  TravelAccommodation,
  TravelChecklist,
  TravelDay,
  TravelDocument,
  TravelIllustration,
  TravelLink,
  TravelReservation,
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
  linksNotCarriedByIllustration,
  stepIllustrationLink,
  uniqueContextualLinks,
} from './contextualLinks'

export type TravelView =
  | { readonly kind: 'summary' }
  | { readonly kind: 'today' }
  | { readonly kind: 'day'; readonly dayId: string }
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
  onCopyAddress(address: string, placeLabel: string): void
  onOpenDocument(document: TravelDocument): void
  onLoadIllustrationResource(
    travelId: string,
    resourceId: string,
  ): Promise<IllustrationResourceLoadResult>
  onSetChecklistItemChecked(
    checklistId: string,
    itemId: string,
    checked: boolean,
  ): Promise<PersonalSaveResult>
  onSaveNote(text: string): Promise<PersonalSaveResult>
}

interface ActionProps {
  online: boolean
  onCopyAddress(address: string, placeLabel: string): void
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

function dateRange(travel: Travel) {
  return (
    <>
      <time dateTime={travel.period.start}>
        {formatDate(travel.period.start, travel.locale)}
      </time>
      {' '}au{' '}
      <time dateTime={travel.period.end}>
        {formatDate(travel.period.end, travel.locale)}
      </time>
    </>
  )
}

function illustrationById(travel: Travel, illustrationId: string) {
  return travel.illustrations.find((illustration) => illustration.id === illustrationId)
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
  const resourceKey = `${travelId}/${illustration.resourceId}`
  const [resourceState, setResourceState] = useState<
    | { readonly key: string; readonly status: 'ready'; readonly source: string }
    | { readonly key: string; readonly status: 'failed' }
  >()

  useEffect(() => {
    let active = true
    let objectUrl: string | undefined
    void onLoadResource(travelId, illustration.resourceId).then((result) => {
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
  }, [illustration.resourceId, onLoadResource, resourceKey, travelId])

  const currentState = resourceState?.key === resourceKey
    ? resourceState
    : undefined
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
            <span aria-hidden="true"> ↗</span>
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
        <span className="external-link-indicator" aria-hidden="true">↗</span>
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
      className="document-button local-action"
      type="button"
      aria-label={`Ouvrir le document ${document.label} pour ${context}`}
      onClick={() => onOpenDocument(document)}
    >
      Ouvrir · {document.label}
    </button>
  )
}

function ReservationDetails({
  travel,
  reservation,
  online,
  onOpenDocument,
  compact = false,
  excludedDocumentIds = new Set<string>(),
}: {
  travel: Travel
  reservation: TravelReservation
  online: boolean
  onOpenDocument(document: TravelDocument): void
  compact?: boolean
  excludedDocumentIds?: ReadonlySet<string>
}) {
  const reservationDocuments = documentsById(
    travel,
    reservation.documentIds.filter((id) => !excludedDocumentIds.has(id)),
  )
  const content = (
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

function Overview({
  travel,
  onNavigate,
  onLoadIllustrationResource,
}: {
  travel: Travel
  onNavigate(view: TravelView): void
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
  const coverIds = travel.coverIllustrationId ? [travel.coverIllustrationId] : []

  return (
    <div className="consultation-view overview-view" aria-labelledby="travel-summary-title">
      <IllustrationCollection
        travel={travel}
        illustrationIds={coverIds}
        cover
        onLoadResource={onLoadIllustrationResource}
      />
      <header className="overview-header">
        <p className="section-label">Vue d’ensemble</p>
        <h2 id="travel-summary-title">{travel.title}</h2>
        <p className="travel-context">
          <strong>{travel.destination.label}</strong>
          <span>{dateRange(travel)}</span>
        </p>
        <p className="travel-summary">{travel.summary}</p>
      </header>
      <div className="overview-actions">
        <button
          className="primary-button"
          type="button"
          onClick={() => onNavigate({ kind: 'today' })}
        >
          Voir le programme d’aujourd’hui
        </button>
      </div>
      {datedReservations.length > 0 && (
        <section className="overview-highlights" aria-labelledby="overview-highlights-title">
          <h3 id="overview-highlights-title">À retenir</h3>
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
  onNavigate,
}: {
  travel: Travel
  selectedDayId?: string
  onNavigate(view: TravelView): void
}) {
  const selectedIndex = travel.days.findIndex((day) => day.id === selectedDayId)
  const previous = selectedIndex > 0 ? travel.days[selectedIndex - 1] : undefined
  const next = selectedIndex >= 0 && selectedIndex < travel.days.length - 1
    ? travel.days[selectedIndex + 1]
    : undefined

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
    <div className="program-navigation">
      <nav className="day-selector" aria-label="Choisir une journée">
        <ol>
          {travel.days.map((day, index) => {
            const selected = day.id === selectedDayId
            return (
              <li key={day.id}>
                <button
                  className={selected ? 'day-choice day-choice-active' : 'day-choice'}
                  type="button"
                  aria-current={selected ? 'page' : undefined}
                  aria-label={`${formatDate(day.date, travel.locale)} — ${day.title}`}
                  onClick={() => onNavigate({ kind: 'day', dayId: day.id })}
                  onKeyDown={(event) => handleArrowNavigation(event, index)}
                >
                  <span>{formatCompactDate(day.date, travel.locale)}</span>
                  <strong>{day.title}</strong>
                  {selected && <em>Journée active</em>}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
      <nav className="adjacent-day-controls" aria-label="Journée précédente et suivante">
        <button
          className="secondary-button"
          type="button"
          disabled={!previous}
          aria-label={previous ? `Journée précédente : ${previous.title}` : 'Aucune journée précédente'}
          onClick={() => previous && onNavigate({ kind: 'day', dayId: previous.id })}
        >
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
        </button>
      </nav>
    </div>
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

function Timeline({
  travel,
  day,
  personalState,
  onNavigate,
  ...actions
}: {
  travel: Travel
  day: TravelDay
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
          {day.steps.map((step) => {
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
            return (
              <li key={step.id}>
                <article aria-labelledby={`step-${step.id}`}>
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
                  <div className="step-content">
                    <h4 id={`step-${step.id}`}>{step.title}</h4>
                    {step.description && <p>{step.description}</p>}
                    {place && (
                      <p className="step-place">
                        <strong>Lieu</strong>
                        <span>{place.label}</span>
                      </p>
                    )}
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
                  </div>
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
  const stepIds = new Set(day.steps.map((step) => step.id))
  const variants = travel.variants.filter((variant) => (
    variant.kind !== 'standard'
    && (
      variant.target.type === 'day'
        ? variant.target.dayId === day.id
        : stepIds.has(variant.target.stepId)
    )
  ))
  if (variants.length === 0) return null

  return (
    <details className="day-complement plans-b">
      <summary>Plans B</summary>
      <ul>
        {variants.map((variant) => (
          <li key={variant.id}>
            <p className="card-label">{VARIANT_LABELS[variant.kind]}</p>
            <strong>{variant.label}</strong>
            <p>{variant.description}</p>
          </li>
        ))}
      </ul>
    </details>
  )
}

function DayComplements({
  travel,
  day,
  personalState,
  ...actions
}: {
  travel: Travel
  day: TravelDay
  personalState: PersonalStateProps
} & ActionProps) {
  const dayChecklists = travel.checklists.filter(
    (checklist) => checklist.target.type === 'day'
      && checklist.target.dayId === day.id,
  )
  const documents = documentsById(travel, day.documentIds)
  const reservations = reservationsById(travel, day.reservationIds)
  const stepIds = new Set(day.steps.map((step) => step.id))
  const hasVariants = travel.variants.some((variant) => (
    variant.kind !== 'standard'
    && (
      variant.target.type === 'day'
        ? variant.target.dayId === day.id
        : stepIds.has(variant.target.stepId)
    )
  ))
  const hasDirectDetails = documents.length > 0 || reservations.length > 0

  if (
    dayChecklists.length === 0
    && !hasVariants
    && !hasDirectDetails
  ) return null

  return (
    <aside className="day-sidebar" aria-label="Compléments de la journée">
      <PlansB travel={travel} day={day} />
      {dayChecklists.length > 0 && (
        <section aria-labelledby={`day-checklists-${day.id}`}>
          <h3 id={`day-checklists-${day.id}`}>Checklist de la journée</h3>
          <ChecklistCollection checklists={dayChecklists} {...personalState} />
        </section>
      )}
      {hasDirectDetails && (
        <details className="day-complement">
          <summary>Informations associées à la journée</summary>
          <ul className="compact-action-list">
            {documents.map((document) => (
              <li key={document.id}>
                <DocumentButton
                  document={document}
                  context={day.title}
                  onOpenDocument={actions.onOpenDocument}
                />
              </li>
            ))}
          </ul>
          {reservations.map((reservation) => (
            <ReservationDetails
              key={reservation.id}
              travel={travel}
              reservation={reservation}
              online={actions.online}
              onOpenDocument={actions.onOpenDocument}
              compact
              excludedDocumentIds={new Set(day.documentIds)}
            />
          ))}
        </details>
      )}
    </aside>
  )
}

function DayDetail({
  travel,
  day,
  personalState,
  onNavigate,
  headingPrefix,
  ...actions
}: {
  travel: Travel
  day: TravelDay
  personalState: PersonalStateProps
  onNavigate(view: TravelView): void
  headingPrefix?: string
} & ActionProps) {
  return (
    <div className="program-layout">
      <div className="program-main">
        <header className="day-header">
          <p className="section-label">{headingPrefix ?? 'Programme'}</p>
          <p className="day-heading-date">
            <time dateTime={day.date}>{formatDate(day.date, travel.locale)}</time>
          </p>
          <h2 id="day-title">{day.title}</h2>
          {day.summary && <p className="travel-summary">{day.summary}</p>}
          <IllustrationCollection
            travel={travel}
            illustrationIds={day.illustrationIds}
            limit={1}
            cover
            onLoadResource={actions.onLoadIllustrationResource}
          />
        </header>
        <Timeline
          travel={travel}
          day={day}
          personalState={personalState}
          onNavigate={onNavigate}
          {...actions}
        />
      </div>
      <DayComplements
        travel={travel}
        day={day}
        personalState={personalState}
        {...actions}
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
  const day = view.kind === 'day'
    ? travel.days.find((candidate) => candidate.id === view.dayId)
    : today.status === 'day'
      ? today.day
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
      <header className="section-heading">
        <p className="section-label">Programme</p>
        <h2 id="program-title">Journées du voyage</h2>
      </header>
      {travel.days.length === 0 ? (
        <p className="empty-state">Ce voyage ne contient aucune journée.</p>
      ) : (
        <>
          <DaySelector
            travel={travel}
            selectedDayId={day?.id}
            onNavigate={onNavigate}
          />
          {statusMessage && (
            <p className="empty-state today-status" role="status">{statusMessage}</p>
          )}
          {day && (
            <DayDetail
              travel={travel}
              day={day}
              personalState={personalState}
              headingPrefix={view.kind === 'today' ? 'Aujourd’hui' : undefined}
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
  onCopyAddress(address: string, placeLabel: string): void
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
          <button
            className="text-button"
            type="button"
            aria-label={`Copier l’adresse de ${accommodation.label}`}
            onClick={() => onCopyAddress(place.address!, place.label)}
          >
            Copier l’adresse
          </button>
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

function PracticalView({
  travel,
  online,
  onCopyAddress,
  onOpenDocument,
}: {
  travel: Travel
  online: boolean
  onCopyAddress(address: string, placeLabel: string): void
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
        <p className="section-label">Infos pratiques</p>
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
  if (view.kind === 'summary') return 'Vue d’ensemble'
  if (view.kind === 'practical') return 'Infos pratiques'
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
  const safeView = view.kind === 'day' && !selectedDay
    ? { kind: 'summary' } as const
    : view
  const programActive = safeView.kind === 'day' || safeView.kind === 'today'
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

  return (
    <section className="foundation travel-workspace" aria-label={`Voyage ${travel.title}`}>
      <div className="travel-toolbar">
        <button
          className="secondary-button back-to-library"
          type="button"
          onClick={onBackToLibrary}
        >
          Retour à la bibliothèque
        </button>
        <nav className="travel-section-navigation" aria-label="Sections du voyage">
          <button
            type="button"
            aria-current={safeView.kind === 'summary' ? 'page' : undefined}
            onClick={() => onNavigate({ kind: 'summary' })}
          >
            Vue d’ensemble
          </button>
          <button
            type="button"
            aria-current={programActive ? 'page' : undefined}
            onClick={() => onNavigate(programTarget(travel, clock))}
          >
            Programme
          </button>
          <button
            type="button"
            aria-current={safeView.kind === 'practical' ? 'page' : undefined}
            onClick={() => onNavigate({ kind: 'practical' })}
          >
            Infos pratiques
          </button>
          <button
            type="button"
            aria-current={safeView.kind === 'preparation' ? 'page' : undefined}
            onClick={() => onNavigate({ kind: 'preparation' })}
          >
            Préparation
          </button>
        </nav>
      </div>
      <p className="active-view" role="status" aria-live="polite">
        Section active : {viewLabel(safeView, travel)}
      </p>
      {actionFeedback && (
        <p
          className={`action-message ${actionFeedback.status === 'error'
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
          onNavigate={onNavigate}
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
    </section>
  )
}
