import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  findAccommodationForDate,
  findPlace,
  getOverviewAnchorDate,
  getTodayState,
  type Clock,
} from '../../application/travelConsultation'
import type {
  Travel,
  TravelAccommodation,
  TravelChecklist,
  TravelDay,
  TravelDocument,
  TravelLink,
  TravelIllustration,
  TravelPlace,
  TravelReservation,
  TravelStep,
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

export type TravelView =
  | { readonly kind: 'summary' }
  | { readonly kind: 'today' }
  | { readonly kind: 'day'; readonly dayId: string }

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

function illustrationById(travel: Travel, illustrationId: string) {
  return travel.illustrations.find((illustration) => illustration.id === illustrationId)
}

function LocalIllustration({
  travelId,
  illustration,
  loading,
  onLoadResource,
}: {
  travelId: string
  illustration: TravelIllustration
  loading?: 'lazy'
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

  if (currentState?.status === 'failed') {
    return (
      <figure className="travel-illustration illustration-fallback">
        <p role="status">Illustration locale indisponible : {illustration.alt}</p>
        {illustration.caption && <figcaption>{illustration.caption}</figcaption>}
      </figure>
    )
  }

  return (
    <figure className="travel-illustration">
      {currentState?.status === 'ready' ? (
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
      {illustration.caption && <figcaption>{illustration.caption}</figcaption>}
    </figure>
  )
}

function IllustrationCollection({
  travel,
  illustrationIds,
  cover = false,
  onLoadResource,
}: {
  travel: Travel
  illustrationIds: readonly string[]
  cover?: boolean
  onLoadResource(
    travelId: string,
    resourceId: string,
  ): Promise<IllustrationResourceLoadResult>
}) {
  const illustrations = illustrationIds.flatMap((id) => {
    const illustration = illustrationById(travel, id)
    return illustration ? [illustration] : []
  })
  if (illustrations.length === 0) return null

  return (
    <div className={cover ? 'illustration-grid cover-illustration' : 'illustration-grid'}>
      {illustrations.map((illustration) => (
        <LocalIllustration
          key={illustration.id}
          travelId={travel.id}
          illustration={illustration}
          loading={cover ? undefined : 'lazy'}
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
      {safeHref ? `${String(children)} · indisponible hors connexion` : `${String(children)} · lien refusé`}
    </span>
  )
}

function IllustrationCredits({ travel, online }: { travel: Travel; online: boolean }) {
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

const VARIANT_LABELS: Record<TravelVariantKind, string> = {
  standard: 'Standard',
  'low-walking': 'Économe en marche',
  rain: 'Pluie',
}

function formatDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}

function dateRange(travel: Travel) {
  return <><time dateTime={travel.period.start}>{formatDate(travel.period.start, travel.locale)}</time>{' '}au{' '}<time dateTime={travel.period.end}>{formatDate(travel.period.end, travel.locale)}</time></>
}

function ExternalLinks({ links, online }: { links: readonly TravelLink[]; online: boolean }) {
  if (links.length === 0) return null
  return (
    <ul className="context-action-list external-action-list">
      {links.map((link) => {
        const href = safeExternalHttpsUrl(link.href)
        return (
          <li key={link.id}>
            {href && online ? (
              <a className="context-action external-action" href={href} target="_blank" rel="noopener noreferrer">
                <strong>Service externe · {link.label}</strong>
                <span>Connexion requise · s’ouvre dans un nouvel onglet</span>
              </a>
            ) : (
              <span className="context-action context-action-disabled" aria-disabled="true">
                <strong>{href ? `Service externe · ${link.label}` : `Lien refusé · ${link.label}`}</strong>
                <span>{href ? 'Indisponible hors connexion' : 'Adresse externe non sécurisée'}</span>
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function DocumentActions({
  travel, documentIds, onOpenDocument,
}: {
  travel: Travel
  documentIds: readonly string[]
  onOpenDocument(document: TravelDocument): void
}) {
  const documents = documentIds.flatMap((id) => {
    const document = travel.documents.find((candidate) => candidate.id === id)
    return document ? [document] : []
  })
  if (documents.length === 0) return null
  return (
    <ul className="context-action-list">
      {documents.map((document) => (
        <li key={document.id}>
          <button className="context-action local-action" type="button" onClick={() => onOpenDocument(document)}>
            <strong>Document local · Ouvrir {document.label}</strong>
            <span>{document.description ?? 'PDF disponible sur cet appareil, même hors connexion'}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function ReservationActions({
  travel, reservationIds, online, onOpenDocument,
}: {
  travel: Travel
  reservationIds: readonly string[]
  online: boolean
  onOpenDocument(document: TravelDocument): void
}) {
  const reservations = reservationIds.flatMap((id) => {
    const reservation = travel.reservations.find((candidate) => candidate.id === id)
    return reservation ? [reservation] : []
  })
  if (reservations.length === 0) return null
  return (
    <section className="reservations" aria-label="Réservations associées">
      {reservations.map((reservation: TravelReservation) => (
        <article className="reservation-card" key={reservation.id}>
          <p className="card-label">Réservation</p>
          <h5>{reservation.label}</h5>
          <dl className="reservation-metadata">
            {reservation.reference && <><dt>Référence</dt><dd>{reservation.reference}</dd></>}
            {reservation.date && <><dt>Date</dt><dd><time dateTime={reservation.date}>{reservation.date}</time></dd></>}
            {reservation.time && <><dt>Heure</dt><dd><time dateTime={reservation.time}>{reservation.time}</time></dd></>}
            {reservation.status && <><dt>Statut</dt><dd>{reservation.status}</dd></>}
          </dl>
          <DocumentActions travel={travel} documentIds={reservation.documentIds} onOpenDocument={onOpenDocument} />
          <ExternalLinks links={reservation.links} online={online} />
        </article>
      ))}
    </section>
  )
}

function ContextActions({
  travel, place, links = [], documentIds = [], reservationIds = [], online,
  onCopyAddress, onOpenDocument,
}: {
  travel: Travel
  place?: TravelPlace
  links?: readonly TravelLink[]
  documentIds?: readonly string[]
  reservationIds?: readonly string[]
  online: boolean
  onCopyAddress(address: string, placeLabel: string): void
  onOpenDocument(document: TravelDocument): void
}) {
  const externalLinks = [...(place?.links ?? []), ...links]
  const hasActions = Boolean(place?.address || externalLinks.length || documentIds.length || reservationIds.length)
  if (!hasActions) return null
  return (
    <div className="context-actions">
      {place?.address && (
        <button className="context-action local-action" type="button" onClick={() => onCopyAddress(place.address!, place.label)}>
          <strong>Action locale · Copier l’adresse de {place.label}</strong>
          <span>Disponible hors connexion</span>
        </button>
      )}
      <ExternalLinks links={externalLinks} online={online} />
      <DocumentActions travel={travel} documentIds={documentIds} onOpenDocument={onOpenDocument} />
      <ReservationActions travel={travel} reservationIds={reservationIds} online={online} onOpenDocument={onOpenDocument} />
    </div>
  )
}

function AccommodationCard({ accommodation, place, date, locale, travel, online, onCopyAddress, onOpenDocument }: {
  accommodation?: TravelAccommodation; place?: TravelPlace; date: string; locale: string; travel: Travel; online: boolean
  onCopyAddress(address: string, placeLabel: string): void; onOpenDocument(document: TravelDocument): void
}) {
  return (
    <section className="anchor-card" aria-labelledby={`anchor-${date}`}>
      <p className="card-label">Point d’ancrage</p><h3 id={`anchor-${date}`}>Hébergement</h3>
      {accommodation ? <div className="anchor-details"><strong>{accommodation.label}</strong>{place && place.label !== accommodation.label && <span>{place.label}</span>}{place?.address && <address>{place.address}</address>}<span className="anchor-period">Pour le {formatDate(date, locale)}</span><ContextActions travel={travel} place={place} online={online} onCopyAddress={onCopyAddress} onOpenDocument={onOpenDocument} /></div> : <p className="empty-inline">Aucun hébergement n’est indiqué pour cette date.</p>}
    </section>
  )
}

function VariantSelector({ travel, selected, onSelect }: { travel: Travel; selected: TravelVariantKind; onSelect(kind: TravelVariantKind): void }) {
  const kinds: TravelVariantKind[] = ['standard', 'low-walking', 'rain'].filter(
    (kind) => kind === 'standard' || travel.variants.some((variant) => variant.kind === kind),
  ) as TravelVariantKind[]
  if (kinds.length === 1) return <p className="variant-empty">Aucune variante n’est proposée pour ce voyage. Le programme standard est affiché.</p>
  return (
    <section className="variant-selector" aria-labelledby="variant-title">
      <div><p className="card-label">Mode de consultation</p><h2 id="variant-title">Variante du programme</h2></div>
      <div className="variant-options" role="group" aria-label="Choisir une variante">
        {kinds.map((kind) => <button key={kind} className="secondary-button" type="button" aria-pressed={selected === kind} onClick={() => onSelect(kind)}>{VARIANT_LABELS[kind]}</button>)}
      </div>
    </section>
  )
}

function DayNavigation({ travel, view, onNavigate }: { travel: Travel; view: TravelView; onNavigate(view: TravelView): void }) {
  if (travel.days.length === 0) return null
  return <nav className="day-navigation" aria-label="Journées du voyage"><ul>{travel.days.map((day) => { const selected = view.kind === 'day' && view.dayId === day.id; return <li key={day.id}><button className={selected ? 'day-tab day-tab-active' : 'day-tab'} type="button" aria-current={selected ? 'page' : undefined} onClick={() => onNavigate({ kind: 'day', dayId: day.id })}><span>{formatDate(day.date, travel.locale)}</span><strong>{day.title}</strong>{selected && <em>Journée sélectionnée</em>}</button></li> })}</ul></nav>
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
  onToggleChecklistItem(checklistId: string, itemId: string, checked: boolean): void
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
    <section className="checklists" aria-label="Checklists associées">
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
                    <span><strong>{item.label}</strong>{item.description && <small>{item.description}</small>}</span>
                  </label>
                  {feedback && (
                    <span
                      className={feedback === 'error' ? 'personal-feedback personal-error' : 'personal-feedback'}
                      role={feedback === 'error' ? 'alert' : 'status'}
                    >
                      {feedback === 'saving' ? 'Enregistrement local…' : feedback === 'saved' ? 'Enregistré localement' : 'Échec de l’enregistrement. La valeur précédente est conservée.'}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </fieldset>
      ))}
    </section>
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

function Overview({ travel, clock, onNavigate, personalState, ...actions }: { travel: Travel; clock: Clock; onNavigate(view: TravelView): void; personalState: PersonalStateProps } & ActionProps) {
  const anchorDate = getOverviewAnchorDate(travel, clock); const anchor = findAccommodationForDate(travel, anchorDate)
  const checklists = travel.checklists.filter((checklist) => checklist.target.type === 'travel')
  const coverIds = travel.coverIllustrationId ? [travel.coverIllustrationId] : []
  return <div className="consultation-view" aria-labelledby="travel-summary-title"><p className="section-label">Synthèse opérationnelle</p><h2 id="travel-summary-title">{travel.title}</h2><IllustrationCollection travel={travel} illustrationIds={coverIds} cover onLoadResource={actions.onLoadIllustrationResource} /><p className="travel-context"><strong>{travel.destination.label}</strong><span>{dateRange(travel)}</span><span>Fuseau horaire : {travel.timeZone}</span></p><p className="travel-summary">{travel.summary}</p><div className="overview-actions"><button className="primary-button" type="button" onClick={() => onNavigate({ kind: 'today' })}>Ouvrir la vue Aujourd’hui</button></div><ChecklistCollection checklists={checklists} {...personalState} /><AccommodationCard accommodation={anchor?.accommodation} place={anchor?.place} date={anchorDate} locale={travel.locale} travel={travel} {...actions} /><section className="days-overview" aria-labelledby="days-overview-title"><h3 id="days-overview-title">Journées du voyage</h3>{travel.days.length === 0 ? <p className="empty-state">Ce voyage ne contient aucune journée. Sa synthèse reste disponible.</p> : <ol>{travel.days.map((day) => <li key={day.id}><article><p className="day-date"><time dateTime={day.date}>{formatDate(day.date, travel.locale)}</time></p><h4>{day.title}</h4>{day.summary && <p>{day.summary}</p>}<button className="secondary-button" type="button" onClick={() => onNavigate({ kind: 'day', dayId: day.id })}>Ouvrir la journée {day.title}</button></article></li>)}</ol>}</section><IllustrationCredits travel={travel} online={actions.online} /></div>
}

function variantsFor(travel: Travel, kind: TravelVariantKind, day: TravelDay, step?: TravelStep) {
  if (kind === 'standard') return []
  return travel.variants.filter((variant) => {
    if (variant.kind !== kind) return false
    if (step) {
      return variant.target.type === 'step' && variant.target.stepId === step.id
    }
    return variant.target.type === 'day' && variant.target.dayId === day.id
  })
}

function VariantNotices({ travel, day, step, kind }: { travel: Travel; day: TravelDay; step?: TravelStep; kind: TravelVariantKind }) {
  const variants = variantsFor(travel, kind, day, step)
  if (variants.length === 0) return null
  return <aside className="variant-notice" aria-label={`Adaptation ${VARIANT_LABELS[kind]}`}>{variants.map((variant) => <div key={variant.id}><strong>{variant.label}</strong><p>{variant.description}</p></div>)}</aside>
}

function Timeline({ travel, day, selectedVariant, personalState, ...actions }: { travel: Travel; day: TravelDay; selectedVariant: TravelVariantKind; personalState: PersonalStateProps } & ActionProps) {
  return <section className="timeline-section" aria-labelledby={`timeline-${day.id}`}><h3 id={`timeline-${day.id}`}>Déroulement chronologique</h3>{day.steps.length === 0 ? <p className="empty-state">Aucune étape n’est renseignée pour cette journée.</p> : <ol className="timeline">{day.steps.map((step, index) => { const place = findPlace(travel, step.placeId); const checklists = travel.checklists.filter((checklist) => checklist.target.type === 'step' && checklist.target.stepId === step.id); return <li key={step.id}><article aria-labelledby={`step-${step.id}`}><div className="step-order" aria-hidden="true">{index + 1}</div><div className="step-content"><p className="step-time">{step.startsAt ? <><time dateTime={step.startsAt}>{step.startsAt}</time>{step.endsAt && <>{' '}– <time dateTime={step.endsAt}>{step.endsAt}</time></>}</> : 'Sans horaire indiqué'}</p><h4 id={`step-${step.id}`}>{step.title}</h4>{step.description && <p>{step.description}</p>}{place && <div className="step-place"><strong>Lieu : {place.label}</strong>{place.address && <address>{place.address}</address>}</div>}<IllustrationCollection travel={travel} illustrationIds={step.illustrationIds} onLoadResource={actions.onLoadIllustrationResource} /><ChecklistCollection checklists={checklists} {...personalState} /><VariantNotices travel={travel} day={day} step={step} kind={selectedVariant} /><ContextActions travel={travel} place={place} links={step.links} documentIds={step.documentIds} reservationIds={step.reservationIds} {...actions} /></div></article></li> })}</ol>}</section>
}

function DayDetail({ travel, day, selectedVariant, headingPrefix, onNavigate, personalState, ...actions }: { travel: Travel; day: TravelDay; selectedVariant: TravelVariantKind; headingPrefix?: ReactNode; onNavigate(view: TravelView): void; personalState: PersonalStateProps } & ActionProps) {
  const dayIndex = travel.days.findIndex((candidate) => candidate.id === day.id); const previous = dayIndex > 0 ? travel.days[dayIndex - 1] : undefined; const next = dayIndex < travel.days.length - 1 ? travel.days[dayIndex + 1] : undefined; const anchor = findAccommodationForDate(travel, day.date)
  const relevantVariants = selectedVariant === 'standard' ? [] : travel.variants.filter((variant) => {
    if (variant.kind !== selectedVariant) return false
    if (variant.target.type === 'day') return variant.target.dayId === day.id
    const targetStepId = variant.target.stepId
    return day.steps.some((step) => step.id === targetStepId)
  })
  const checklists = travel.checklists.filter((checklist) => checklist.target.type === 'day' && checklist.target.dayId === day.id)
  return <div className="consultation-view" aria-labelledby="day-title"><p className="section-label">{headingPrefix ?? 'Programme de la journée'}</p><h2 id="day-title">{day.title}</h2><p className="day-heading-date"><time dateTime={day.date}>{formatDate(day.date, travel.locale)}</time></p>{day.summary && <p className="travel-summary">{day.summary}</p>}<IllustrationCollection travel={travel} illustrationIds={day.illustrationIds} onLoadResource={actions.onLoadIllustrationResource} /><ChecklistCollection checklists={checklists} {...personalState} /><VariantNotices travel={travel} day={day} kind={selectedVariant} />{selectedVariant !== 'standard' && relevantVariants.length === 0 && <p className="variant-empty" role="status">Aucune adaptation « {VARIANT_LABELS[selectedVariant]} » n’est prévue pour cette journée. Le programme standard reste affiché.</p>}<ContextActions travel={travel} documentIds={day.documentIds} reservationIds={day.reservationIds} {...actions} /><AccommodationCard accommodation={anchor?.accommodation} place={anchor?.place} date={day.date} locale={travel.locale} travel={travel} {...actions} /><Timeline travel={travel} day={day} selectedVariant={selectedVariant} personalState={personalState} {...actions} /><nav className="adjacent-days" aria-label="Journées précédente et suivante">{previous ? <button className="secondary-button" type="button" onClick={() => onNavigate({ kind: 'day', dayId: previous.id })}>Journée précédente : {previous.title}</button> : <span />}{next && <button className="secondary-button" type="button" onClick={() => onNavigate({ kind: 'day', dayId: next.id })}>Journée suivante : {next.title}</button>}</nav></div>
}

function TodayView({ travel, clock, selectedVariant, onNavigate, personalState, ...actions }: { travel: Travel; clock: Clock; selectedVariant: TravelVariantKind; onNavigate(view: TravelView): void; personalState: PersonalStateProps } & ActionProps) {
  const today = getTodayState(travel, clock)
  if (today.status === 'day') return <DayDetail travel={travel} day={today.day} selectedVariant={selectedVariant} headingPrefix="Aujourd’hui" onNavigate={onNavigate} personalState={personalState} {...actions} />
  const message = today.status === 'before' ? `Ce voyage n’a pas encore commencé. Il débute le ${formatDate(travel.period.start, travel.locale)}.` : today.status === 'after' ? `Ce voyage est terminé depuis le ${formatDate(travel.period.end, travel.locale)}.` : `Aucune journée n’est prévue pour le ${formatDate(today.date, travel.locale)}, bien que cette date soit comprise dans le séjour.`
  return <div className="consultation-view" aria-labelledby="today-title"><p className="section-label">Repère temporel</p><h2 id="today-title">Aujourd’hui</h2><p className="today-date">Date locale du voyage : <time dateTime={today.date}>{formatDate(today.date, travel.locale)}</time></p><p className="empty-state" role="status">{message}</p><p className="today-help">Toutes les journées du voyage restent accessibles ci-dessus.</p></div>
}

function viewLabel(view: TravelView, travel: Travel) { if (view.kind === 'summary') return 'Synthèse du voyage'; if (view.kind === 'today') return 'Aujourd’hui'; return travel.days.find((day) => day.id === view.dayId)?.title ?? 'Synthèse du voyage' }

export function TravelConsultation({ persistedTravel, view, clock, online, actionFeedback, personalState, noteSaveDelayMs = 500, onNavigate, onBackToLibrary, onCopyAddress, onOpenDocument, onLoadIllustrationResource, onSetChecklistItemChecked, onSaveNote }: TravelConsultationProps) {
  const { travel } = persistedTravel; const [selectedVariant, setSelectedVariant] = useState<TravelVariantKind>('standard'); const [checkedItemKeys, setCheckedItemKeys] = useState(() => new Set(personalState.checkedItemKeys)); const [checklistFeedback, setChecklistFeedback] = useState<Record<string, 'saving' | 'saved' | 'error'>>({}); const selectedDay = view.kind === 'day' ? travel.days.find((day) => day.id === view.dayId) : undefined; const safeView = view.kind === 'day' && !selectedDay ? { kind: 'summary' } as const : view; const actions = { online, onCopyAddress, onOpenDocument, onLoadIllustrationResource }
  async function toggleChecklistItem(checklistId: string, itemId: string, checked: boolean) { const key = checklistItemStateKey(checklistId, itemId); const previous = checkedItemKeys.has(key); setCheckedItemKeys((current) => { const next = new Set(current); if (checked) next.add(key); else next.delete(key); return next }); setChecklistFeedback((current) => ({ ...current, [key]: 'saving' })); const result = await onSetChecklistItemChecked(checklistId, itemId, checked); if (!result.ok) { setCheckedItemKeys((current) => { const next = new Set(current); if (previous) next.add(key); else next.delete(key); return next }) } setChecklistFeedback((current) => ({ ...current, [key]: result.ok ? 'saved' : 'error' })) }
  const checklistState = { checkedItemKeys, checklistFeedback, onToggleChecklistItem: (checklistId: string, itemId: string, checked: boolean) => void toggleChecklistItem(checklistId, itemId, checked) }
  return <section className="foundation travel-workspace" aria-label={`Voyage ${travel.title}`}><div className="travel-toolbar"><button className="secondary-button" type="button" onClick={onBackToLibrary}>Retour à la bibliothèque</button><nav aria-label="Vues du voyage"><button className="secondary-button" type="button" aria-current={safeView.kind === 'summary' ? 'page' : undefined} onClick={() => onNavigate({ kind: 'summary' })}>Synthèse</button><button className="secondary-button" type="button" aria-current={safeView.kind === 'today' ? 'page' : undefined} onClick={() => onNavigate({ kind: 'today' })}>Aujourd’hui</button></nav></div><p className="active-view" role="status" aria-live="polite">Vue active : {viewLabel(safeView, travel)}</p>{actionFeedback && <p className={`action-message ${actionFeedback.status === 'error' ? 'action-error' : 'action-success'}`} role={actionFeedback.status === 'error' ? 'alert' : 'status'}>{actionFeedback.message}</p>}<VariantSelector travel={travel} selected={selectedVariant} onSelect={setSelectedVariant} /><DayNavigation travel={travel} view={safeView} onNavigate={onNavigate} />{safeView.kind === 'summary' && <Overview travel={travel} clock={clock} onNavigate={onNavigate} personalState={checklistState} {...actions} />}{safeView.kind === 'today' && <TodayView travel={travel} clock={clock} selectedVariant={selectedVariant} onNavigate={onNavigate} personalState={checklistState} {...actions} />}{safeView.kind === 'day' && selectedDay && <DayDetail travel={travel} day={selectedDay} selectedVariant={selectedVariant} onNavigate={onNavigate} personalState={checklistState} {...actions} />}<NotesPanel initialNote={personalState.note} saveDelayMs={noteSaveDelayMs} onSave={onSaveNote} /></section>
}
