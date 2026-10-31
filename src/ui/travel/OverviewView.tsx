import {
  findAccommodationForDate,
  getOverviewAnchorDate,
  getTodayState,
  type Clock,
} from '../../application/travelConsultation'
import type { Travel, TravelIllustration } from '../../domain/voyage/model'
import { CalendarIcon, ChevronRightIcon, ClockIcon, HomeIcon, MapPinIcon } from '../icons'
import {
  daysBetween,
  formatCompactDate,
  formatTravelDates,
  travelDurationLabel,
} from '../travelDates'
import { BackToLibraryButton, CopyAddressButton } from './ConsultationActions'
import {
  formatDate,
  formatDayHeading,
  formatDayParts,
  illustrationById,
} from './consultationHelpers'
import { useLocalImageSource } from './consultationHooks'
import type { ActionProps, TravelView } from './consultationTypes'

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
    action = { label: 'Voir la journée', view: { kind: 'day', dayId: today.day.id } }
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
  // L’adresse complète reste dans Pièces ; l’aperçu ne garde que le repère.
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

export function Overview({
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
