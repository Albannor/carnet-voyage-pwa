import type {
  Travel,
  TravelAccommodation,
  TravelDay,
  TravelPlace,
} from '../domain/voyage/model'

export interface Clock {
  now(): Date
}

export const systemClock: Clock = {
  now: () => new Date(),
}

export type TodayState =
  | { readonly status: 'day'; readonly date: string; readonly day: TravelDay }
  | { readonly status: 'before'; readonly date: string }
  | { readonly status: 'after'; readonly date: string }
  | { readonly status: 'missing-day'; readonly date: string }

export interface AccommodationAnchor {
  readonly accommodation: TravelAccommodation
  readonly place?: TravelPlace
}

function datePart(
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) {
  return parts.find((part) => part.type === type)?.value ?? ''
}

export function localDateInTimeZone(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  return `${datePart(parts, 'year')}-${datePart(parts, 'month')}-${datePart(parts, 'day')}`
}

export function getTodayState(travel: Travel, clock: Clock): TodayState {
  const date = localDateInTimeZone(clock.now(), travel.timeZone)

  if (date < travel.period.start) return { status: 'before', date }
  if (date > travel.period.end) return { status: 'after', date }

  const day = travel.days.find((candidate) => candidate.date === date)
  return day
    ? { status: 'day', date, day }
    : { status: 'missing-day', date }
}

export function findAccommodationForDate(
  travel: Travel,
  date: string,
): AccommodationAnchor | undefined {
  const accommodation = travel.accommodations.find(
    (candidate) =>
      candidate.period.start <= date && candidate.period.end >= date,
  )
  if (!accommodation) return undefined

  return {
    accommodation,
    place: travel.places.find((place) => place.id === accommodation.placeId),
  }
}

export function getOverviewAnchorDate(travel: Travel, clock: Clock) {
  const currentDate = localDateInTimeZone(clock.now(), travel.timeZone)
  if (currentDate < travel.period.start) return travel.period.start
  if (currentDate > travel.period.end) return travel.period.end
  return currentDate
}

export function findPlace(travel: Travel, placeId?: string) {
  return placeId
    ? travel.places.find((place) => place.id === placeId)
    : undefined
}
