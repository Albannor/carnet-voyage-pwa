import type { TravelLibraryEntry } from '../../persistence/model'

export type TravelTiming = 'ongoing' | 'upcoming' | 'past'

export interface ArrangedTravel {
  readonly entry: TravelLibraryEntry
  readonly timing: TravelTiming
}

export interface LibraryArrangement {
  readonly featured?: ArrangedTravel
  readonly others: readonly ArrangedTravel[]
}

/** Date civile de l’appareil au format AAAA-MM-JJ. */
export function localIsoDate(now: Date) {
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function travelTiming(entry: TravelLibraryEntry, today: string): TravelTiming {
  if (entry.endDate < today) return 'past'
  if (entry.startDate > today) return 'upcoming'
  return 'ongoing'
}

const timingRank: Record<TravelTiming, number> = {
  ongoing: 0,
  upcoming: 1,
  past: 2,
}

function compareArranged(left: ArrangedTravel, right: ArrangedTravel) {
  const rank = timingRank[left.timing] - timingRank[right.timing]
  if (rank !== 0) return rank
  if (left.timing === 'past') {
    return right.entry.endDate.localeCompare(left.entry.endDate)
  }
  return left.entry.startDate.localeCompare(right.entry.startDate)
}

/**
 * Met en avant le voyage le plus proche dans le temps : un voyage en cours,
 * sinon le prochain départ, sinon le voyage terminé le plus récemment.
 */
export function arrangeLibrary(
  entries: readonly TravelLibraryEntry[],
  today: string,
): LibraryArrangement {
  const [featured, ...others] = entries
    .map((entry) => ({ entry, timing: travelTiming(entry, today) }))
    .sort(compareArranged)
  return { featured, others }
}

function isoDateToUtc(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatTravelDates(startDate: string, endDate: string) {
  const start = isoDateToUtc(startDate)
  const end = isoDateToUtc(endDate)
  return typeof dateFormatter.formatRange === 'function'
    ? dateFormatter.formatRange(start, end)
    : `${dateFormatter.format(start)} – ${dateFormatter.format(end)}`
}

export function travelDurationLabel(startDate: string, endDate: string) {
  const days = Math.round(
    (isoDateToUtc(endDate).getTime() - isoDateToUtc(startDate).getTime()) / 86_400_000,
  ) + 1
  return days > 1 ? `${days} jours` : '1 jour'
}
