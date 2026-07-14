import type { ReactNode } from 'react'
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
  TravelPlace,
} from '../../domain/voyage/model'
import type { PersistedTravel } from '../../persistence/model'

export type TravelView =
  | { readonly kind: 'summary' }
  | { readonly kind: 'today' }
  | { readonly kind: 'day'; readonly dayId: string }

interface TravelConsultationProps {
  persistedTravel: PersistedTravel
  view: TravelView
  clock: Clock
  onNavigate(view: TravelView): void
  onBackToLibrary(): void
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

function dateRange(travel: Travel) {
  return (
    <>
      <time dateTime={travel.period.start}>
        {formatDate(travel.period.start, travel.locale)}
      </time>{' '}
      au{' '}
      <time dateTime={travel.period.end}>
        {formatDate(travel.period.end, travel.locale)}
      </time>
    </>
  )
}

function AccommodationCard({
  accommodation,
  place,
  date,
  locale,
}: {
  accommodation?: TravelAccommodation
  place?: TravelPlace
  date: string
  locale: string
}) {
  return (
    <section className="anchor-card" aria-labelledby={`anchor-${date}`}>
      <p className="card-label">Point d’ancrage</p>
      <h3 id={`anchor-${date}`}>Hébergement</h3>
      {accommodation ? (
        <div className="anchor-details">
          <strong>{accommodation.label}</strong>
          {place && place.label !== accommodation.label && <span>{place.label}</span>}
          {place?.address && <address>{place.address}</address>}
          <span className="anchor-period">
            Pour le {formatDate(date, locale)}
          </span>
        </div>
      ) : (
        <p className="empty-inline">
          Aucun hébergement n’est indiqué pour cette date.
        </p>
      )}
    </section>
  )
}

function DayNavigation({
  travel,
  view,
  onNavigate,
}: {
  travel: Travel
  view: TravelView
  onNavigate(view: TravelView): void
}) {
  if (travel.days.length === 0) return null

  return (
    <nav className="day-navigation" aria-label="Journées du voyage">
      <ul>
        {travel.days.map((day) => {
          const selected = view.kind === 'day' && view.dayId === day.id
          return (
            <li key={day.id}>
              <button
                className={selected ? 'day-tab day-tab-active' : 'day-tab'}
                type="button"
                aria-current={selected ? 'page' : undefined}
                onClick={() => onNavigate({ kind: 'day', dayId: day.id })}
              >
                <span>{formatDate(day.date, travel.locale)}</span>
                <strong>{day.title}</strong>
                {selected && <em>Journée sélectionnée</em>}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function Overview({
  travel,
  clock,
  onNavigate,
}: {
  travel: Travel
  clock: Clock
  onNavigate(view: TravelView): void
}) {
  const anchorDate = getOverviewAnchorDate(travel, clock)
  const anchor = findAccommodationForDate(travel, anchorDate)

  return (
    <div className="consultation-view" aria-labelledby="travel-summary-title">
      <p className="section-label">Synthèse opérationnelle</p>
      <h2 id="travel-summary-title">{travel.title}</h2>
      <p className="travel-context">
        <strong>{travel.destination.label}</strong>
        <span>{dateRange(travel)}</span>
        <span>Fuseau horaire : {travel.timeZone}</span>
      </p>
      <p className="travel-summary">{travel.summary}</p>

      <div className="overview-actions">
        <button
          className="primary-button"
          type="button"
          onClick={() => onNavigate({ kind: 'today' })}
        >
          Ouvrir la vue Aujourd’hui
        </button>
      </div>

      <AccommodationCard
        accommodation={anchor?.accommodation}
        place={anchor?.place}
        date={anchorDate}
        locale={travel.locale}
      />

      <section className="days-overview" aria-labelledby="days-overview-title">
        <h3 id="days-overview-title">Journées du voyage</h3>
        {travel.days.length === 0 ? (
          <p className="empty-state">
            Ce voyage ne contient aucune journée. Sa synthèse reste disponible.
          </p>
        ) : (
          <ol>
            {travel.days.map((day) => (
              <li key={day.id}>
                <article>
                  <p className="day-date">
                    <time dateTime={day.date}>
                      {formatDate(day.date, travel.locale)}
                    </time>
                  </p>
                  <h4>{day.title}</h4>
                  {day.summary && <p>{day.summary}</p>}
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => onNavigate({ kind: 'day', dayId: day.id })}
                  >
                    Ouvrir la journée {day.title}
                  </button>
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function Timeline({ travel, day }: { travel: Travel; day: TravelDay }) {
  return (
    <section className="timeline-section" aria-labelledby={`timeline-${day.id}`}>
      <h3 id={`timeline-${day.id}`}>Déroulement chronologique</h3>
      {day.steps.length === 0 ? (
        <p className="empty-state">
          Aucune étape n’est renseignée pour cette journée.
        </p>
      ) : (
        <ol className="timeline">
          {day.steps.map((step, index) => {
            const place = findPlace(travel, step.placeId)
            return (
              <li key={step.id}>
                <article aria-labelledby={`step-${step.id}`}>
                  <div className="step-order" aria-hidden="true">
                    {index + 1}
                  </div>
                  <div className="step-content">
                    <p className="step-time">
                      {step.startsAt ? (
                        <>
                          <time dateTime={step.startsAt}>{step.startsAt}</time>
                          {step.endsAt && (
                            <>
                              {' '}– <time dateTime={step.endsAt}>{step.endsAt}</time>
                            </>
                          )}
                        </>
                      ) : (
                        'Sans horaire indiqué'
                      )}
                    </p>
                    <h4 id={`step-${step.id}`}>{step.title}</h4>
                    {step.description && <p>{step.description}</p>}
                    {place && (
                      <div className="step-place">
                        <strong>Lieu : {place.label}</strong>
                        {place.address && <address>{place.address}</address>}
                      </div>
                    )}
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

function DayDetail({
  travel,
  day,
  headingPrefix,
  onNavigate,
}: {
  travel: Travel
  day: TravelDay
  headingPrefix?: ReactNode
  onNavigate(view: TravelView): void
}) {
  const dayIndex = travel.days.findIndex((candidate) => candidate.id === day.id)
  const previous = dayIndex > 0 ? travel.days[dayIndex - 1] : undefined
  const next = dayIndex < travel.days.length - 1 ? travel.days[dayIndex + 1] : undefined
  const anchor = findAccommodationForDate(travel, day.date)

  return (
    <div className="consultation-view" aria-labelledby="day-title">
      <p className="section-label">{headingPrefix ?? 'Programme de la journée'}</p>
      <h2 id="day-title">{day.title}</h2>
      <p className="day-heading-date">
        <time dateTime={day.date}>{formatDate(day.date, travel.locale)}</time>
      </p>
      {day.summary && <p className="travel-summary">{day.summary}</p>}

      <AccommodationCard
        accommodation={anchor?.accommodation}
        place={anchor?.place}
        date={day.date}
        locale={travel.locale}
      />
      <Timeline travel={travel} day={day} />

      <nav className="adjacent-days" aria-label="Journées précédente et suivante">
        {previous ? (
          <button
            className="secondary-button"
            type="button"
            onClick={() => onNavigate({ kind: 'day', dayId: previous.id })}
          >
            Journée précédente : {previous.title}
          </button>
        ) : <span />}
        {next && (
          <button
            className="secondary-button"
            type="button"
            onClick={() => onNavigate({ kind: 'day', dayId: next.id })}
          >
            Journée suivante : {next.title}
          </button>
        )}
      </nav>
    </div>
  )
}

function TodayView({
  travel,
  clock,
  onNavigate,
}: {
  travel: Travel
  clock: Clock
  onNavigate(view: TravelView): void
}) {
  const today = getTodayState(travel, clock)
  if (today.status === 'day') {
    return (
      <DayDetail
        travel={travel}
        day={today.day}
        headingPrefix="Aujourd’hui"
        onNavigate={onNavigate}
      />
    )
  }

  const message =
    today.status === 'before'
      ? `Ce voyage n’a pas encore commencé. Il débute le ${formatDate(travel.period.start, travel.locale)}.`
      : today.status === 'after'
        ? `Ce voyage est terminé depuis le ${formatDate(travel.period.end, travel.locale)}.`
        : `Aucune journée n’est prévue pour le ${formatDate(today.date, travel.locale)}, bien que cette date soit comprise dans le séjour.`

  return (
    <div className="consultation-view" aria-labelledby="today-title">
      <p className="section-label">Repère temporel</p>
      <h2 id="today-title">Aujourd’hui</h2>
      <p className="today-date">
        Date locale du voyage :{' '}
        <time dateTime={today.date}>{formatDate(today.date, travel.locale)}</time>
      </p>
      <p className="empty-state" role="status">{message}</p>
      <p className="today-help">
        Toutes les journées du voyage restent accessibles ci-dessus.
      </p>
    </div>
  )
}

function viewLabel(view: TravelView, travel: Travel) {
  if (view.kind === 'summary') return 'Synthèse du voyage'
  if (view.kind === 'today') return 'Aujourd’hui'
  return travel.days.find((day) => day.id === view.dayId)?.title ?? 'Synthèse du voyage'
}

export function TravelConsultation({
  persistedTravel,
  view,
  clock,
  onNavigate,
  onBackToLibrary,
}: TravelConsultationProps) {
  const { travel } = persistedTravel
  const selectedDay = view.kind === 'day'
    ? travel.days.find((day) => day.id === view.dayId)
    : undefined
  const safeView = view.kind === 'day' && !selectedDay
    ? { kind: 'summary' } as const
    : view

  return (
    <section className="foundation travel-workspace" aria-label={`Voyage ${travel.title}`}>
      <div className="travel-toolbar">
        <button
          className="secondary-button"
          type="button"
          onClick={onBackToLibrary}
        >
          Retour à la bibliothèque
        </button>
        <nav aria-label="Vues du voyage">
          <button
            className="secondary-button"
            type="button"
            aria-current={safeView.kind === 'summary' ? 'page' : undefined}
            onClick={() => onNavigate({ kind: 'summary' })}
          >
            Synthèse
          </button>
          <button
            className="secondary-button"
            type="button"
            aria-current={safeView.kind === 'today' ? 'page' : undefined}
            onClick={() => onNavigate({ kind: 'today' })}
          >
            Aujourd’hui
          </button>
        </nav>
      </div>

      <p className="active-view" role="status" aria-live="polite">
        Vue active : {viewLabel(safeView, travel)}
      </p>
      <DayNavigation travel={travel} view={safeView} onNavigate={onNavigate} />

      {safeView.kind === 'summary' && (
        <Overview travel={travel} clock={clock} onNavigate={onNavigate} />
      )}
      {safeView.kind === 'today' && (
        <TodayView travel={travel} clock={clock} onNavigate={onNavigate} />
      )}
      {safeView.kind === 'day' && selectedDay && (
        <DayDetail travel={travel} day={selectedDay} onNavigate={onNavigate} />
      )}
    </section>
  )
}
