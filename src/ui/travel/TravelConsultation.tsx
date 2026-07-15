import { useState, type ReactNode } from 'react'
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
  TravelDay,
  TravelDocument,
  TravelLink,
  TravelPlace,
  TravelReservation,
  TravelStep,
  TravelVariantKind,
} from '../../domain/voyage/model'
import type { PersistedTravel } from '../../persistence/model'
import { safeExternalHttpsUrl } from '../../services/travelActions'

export type TravelView =
  | { readonly kind: 'summary' }
  | { readonly kind: 'today' }
  | { readonly kind: 'day'; readonly dayId: string }

export interface ContextActionFeedback {
  readonly status: 'success' | 'error'
  readonly message: string
}

interface TravelConsultationProps {
  persistedTravel: PersistedTravel
  view: TravelView
  clock: Clock
  online: boolean
  actionFeedback?: ContextActionFeedback
  onNavigate(view: TravelView): void
  onBackToLibrary(): void
  onCopyAddress(address: string, placeLabel: string): void
  onOpenDocument(document: TravelDocument): void
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

interface ActionProps { online: boolean; onCopyAddress(address: string, placeLabel: string): void; onOpenDocument(document: TravelDocument): void }

function Overview({ travel, clock, onNavigate, ...actions }: { travel: Travel; clock: Clock; onNavigate(view: TravelView): void } & ActionProps) {
  const anchorDate = getOverviewAnchorDate(travel, clock); const anchor = findAccommodationForDate(travel, anchorDate)
  return <div className="consultation-view" aria-labelledby="travel-summary-title"><p className="section-label">Synthèse opérationnelle</p><h2 id="travel-summary-title">{travel.title}</h2><p className="travel-context"><strong>{travel.destination.label}</strong><span>{dateRange(travel)}</span><span>Fuseau horaire : {travel.timeZone}</span></p><p className="travel-summary">{travel.summary}</p><div className="overview-actions"><button className="primary-button" type="button" onClick={() => onNavigate({ kind: 'today' })}>Ouvrir la vue Aujourd’hui</button></div><AccommodationCard accommodation={anchor?.accommodation} place={anchor?.place} date={anchorDate} locale={travel.locale} travel={travel} {...actions} /><section className="days-overview" aria-labelledby="days-overview-title"><h3 id="days-overview-title">Journées du voyage</h3>{travel.days.length === 0 ? <p className="empty-state">Ce voyage ne contient aucune journée. Sa synthèse reste disponible.</p> : <ol>{travel.days.map((day) => <li key={day.id}><article><p className="day-date"><time dateTime={day.date}>{formatDate(day.date, travel.locale)}</time></p><h4>{day.title}</h4>{day.summary && <p>{day.summary}</p>}<button className="secondary-button" type="button" onClick={() => onNavigate({ kind: 'day', dayId: day.id })}>Ouvrir la journée {day.title}</button></article></li>)}</ol>}</section></div>
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

function Timeline({ travel, day, selectedVariant, ...actions }: { travel: Travel; day: TravelDay; selectedVariant: TravelVariantKind } & ActionProps) {
  return <section className="timeline-section" aria-labelledby={`timeline-${day.id}`}><h3 id={`timeline-${day.id}`}>Déroulement chronologique</h3>{day.steps.length === 0 ? <p className="empty-state">Aucune étape n’est renseignée pour cette journée.</p> : <ol className="timeline">{day.steps.map((step, index) => { const place = findPlace(travel, step.placeId); return <li key={step.id}><article aria-labelledby={`step-${step.id}`}><div className="step-order" aria-hidden="true">{index + 1}</div><div className="step-content"><p className="step-time">{step.startsAt ? <><time dateTime={step.startsAt}>{step.startsAt}</time>{step.endsAt && <>{' '}– <time dateTime={step.endsAt}>{step.endsAt}</time></>}</> : 'Sans horaire indiqué'}</p><h4 id={`step-${step.id}`}>{step.title}</h4>{step.description && <p>{step.description}</p>}{place && <div className="step-place"><strong>Lieu : {place.label}</strong>{place.address && <address>{place.address}</address>}</div>}<VariantNotices travel={travel} day={day} step={step} kind={selectedVariant} /><ContextActions travel={travel} place={place} links={step.links} documentIds={step.documentIds} reservationIds={step.reservationIds} {...actions} /></div></article></li> })}</ol>}</section>
}

function DayDetail({ travel, day, selectedVariant, headingPrefix, onNavigate, ...actions }: { travel: Travel; day: TravelDay; selectedVariant: TravelVariantKind; headingPrefix?: ReactNode; onNavigate(view: TravelView): void } & ActionProps) {
  const dayIndex = travel.days.findIndex((candidate) => candidate.id === day.id); const previous = dayIndex > 0 ? travel.days[dayIndex - 1] : undefined; const next = dayIndex < travel.days.length - 1 ? travel.days[dayIndex + 1] : undefined; const anchor = findAccommodationForDate(travel, day.date)
  const relevantVariants = selectedVariant === 'standard' ? [] : travel.variants.filter((variant) => {
    if (variant.kind !== selectedVariant) return false
    if (variant.target.type === 'day') return variant.target.dayId === day.id
    const targetStepId = variant.target.stepId
    return day.steps.some((step) => step.id === targetStepId)
  })
  return <div className="consultation-view" aria-labelledby="day-title"><p className="section-label">{headingPrefix ?? 'Programme de la journée'}</p><h2 id="day-title">{day.title}</h2><p className="day-heading-date"><time dateTime={day.date}>{formatDate(day.date, travel.locale)}</time></p>{day.summary && <p className="travel-summary">{day.summary}</p>}<VariantNotices travel={travel} day={day} kind={selectedVariant} />{selectedVariant !== 'standard' && relevantVariants.length === 0 && <p className="variant-empty" role="status">Aucune adaptation « {VARIANT_LABELS[selectedVariant]} » n’est prévue pour cette journée. Le programme standard reste affiché.</p>}<ContextActions travel={travel} documentIds={day.documentIds} reservationIds={day.reservationIds} {...actions} /><AccommodationCard accommodation={anchor?.accommodation} place={anchor?.place} date={day.date} locale={travel.locale} travel={travel} {...actions} /><Timeline travel={travel} day={day} selectedVariant={selectedVariant} {...actions} /><nav className="adjacent-days" aria-label="Journées précédente et suivante">{previous ? <button className="secondary-button" type="button" onClick={() => onNavigate({ kind: 'day', dayId: previous.id })}>Journée précédente : {previous.title}</button> : <span />}{next && <button className="secondary-button" type="button" onClick={() => onNavigate({ kind: 'day', dayId: next.id })}>Journée suivante : {next.title}</button>}</nav></div>
}

function TodayView({ travel, clock, selectedVariant, onNavigate, ...actions }: { travel: Travel; clock: Clock; selectedVariant: TravelVariantKind; onNavigate(view: TravelView): void } & ActionProps) {
  const today = getTodayState(travel, clock)
  if (today.status === 'day') return <DayDetail travel={travel} day={today.day} selectedVariant={selectedVariant} headingPrefix="Aujourd’hui" onNavigate={onNavigate} {...actions} />
  const message = today.status === 'before' ? `Ce voyage n’a pas encore commencé. Il débute le ${formatDate(travel.period.start, travel.locale)}.` : today.status === 'after' ? `Ce voyage est terminé depuis le ${formatDate(travel.period.end, travel.locale)}.` : `Aucune journée n’est prévue pour le ${formatDate(today.date, travel.locale)}, bien que cette date soit comprise dans le séjour.`
  return <div className="consultation-view" aria-labelledby="today-title"><p className="section-label">Repère temporel</p><h2 id="today-title">Aujourd’hui</h2><p className="today-date">Date locale du voyage : <time dateTime={today.date}>{formatDate(today.date, travel.locale)}</time></p><p className="empty-state" role="status">{message}</p><p className="today-help">Toutes les journées du voyage restent accessibles ci-dessus.</p></div>
}

function viewLabel(view: TravelView, travel: Travel) { if (view.kind === 'summary') return 'Synthèse du voyage'; if (view.kind === 'today') return 'Aujourd’hui'; return travel.days.find((day) => day.id === view.dayId)?.title ?? 'Synthèse du voyage' }

export function TravelConsultation({ persistedTravel, view, clock, online, actionFeedback, onNavigate, onBackToLibrary, onCopyAddress, onOpenDocument }: TravelConsultationProps) {
  const { travel } = persistedTravel; const [selectedVariant, setSelectedVariant] = useState<TravelVariantKind>('standard'); const selectedDay = view.kind === 'day' ? travel.days.find((day) => day.id === view.dayId) : undefined; const safeView = view.kind === 'day' && !selectedDay ? { kind: 'summary' } as const : view; const actions = { online, onCopyAddress, onOpenDocument }
  return <section className="foundation travel-workspace" aria-label={`Voyage ${travel.title}`}><div className="travel-toolbar"><button className="secondary-button" type="button" onClick={onBackToLibrary}>Retour à la bibliothèque</button><nav aria-label="Vues du voyage"><button className="secondary-button" type="button" aria-current={safeView.kind === 'summary' ? 'page' : undefined} onClick={() => onNavigate({ kind: 'summary' })}>Synthèse</button><button className="secondary-button" type="button" aria-current={safeView.kind === 'today' ? 'page' : undefined} onClick={() => onNavigate({ kind: 'today' })}>Aujourd’hui</button></nav></div><p className="active-view" role="status" aria-live="polite">Vue active : {viewLabel(safeView, travel)}</p>{actionFeedback && <p className={`action-message ${actionFeedback.status === 'error' ? 'action-error' : 'action-success'}`} role={actionFeedback.status === 'error' ? 'alert' : 'status'}>{actionFeedback.message}</p>}<VariantSelector travel={travel} selected={selectedVariant} onSelect={setSelectedVariant} /><DayNavigation travel={travel} view={safeView} onNavigate={onNavigate} />{safeView.kind === 'summary' && <Overview travel={travel} clock={clock} onNavigate={onNavigate} {...actions} />}{safeView.kind === 'today' && <TodayView travel={travel} clock={clock} selectedVariant={selectedVariant} onNavigate={onNavigate} {...actions} />}{safeView.kind === 'day' && selectedDay && <DayDetail travel={travel} day={selectedDay} selectedVariant={selectedVariant} onNavigate={onNavigate} {...actions} />}</section>
}
