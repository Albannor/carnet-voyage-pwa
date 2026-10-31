/** Formats de dates communs à la bibliothèque et à la consultation. */

export function isoDateToUtc(date: string) {
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

export function daysBetween(fromDate: string, toDate: string) {
  return Math.round(
    (isoDateToUtc(toDate).getTime() - isoDateToUtc(fromDate).getTime()) / 86_400_000,
  )
}

export function travelDurationLabel(startDate: string, endDate: string) {
  const days = daysBetween(startDate, endDate) + 1
  return days > 1 ? `${days} jours` : '1 jour'
}

/** Date courte d’une journée, par exemple « mar. 14 juil. ». */
export function formatCompactDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}
