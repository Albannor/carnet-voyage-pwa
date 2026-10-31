import { getTodayState, type Clock } from '../../application/travelConsultation'
import type {
  Travel,
  TravelChecklist,
  TravelDay,
  TravelReservation,
  TravelVariantKind,
} from '../../domain/voyage/model'
import { checklistItemStateKey } from '../../persistence/model'
import type { TravelView } from './consultationTypes'

export const VARIANT_LABELS: Record<TravelVariantKind, string> = {
  standard: 'Standard',
  'low-walking': 'Économe en marche',
  rain: 'Pluie',
}

export function formatDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}

export function illustrationById(travel: Travel, illustrationId: string) {
  return travel.illustrations.find((illustration) => illustration.id === illustrationId)
}

export function referencedIllustrations(travel: Travel) {
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

export function documentsById(travel: Travel, ids: readonly string[]) {
  return ids.flatMap((id) => {
    const document = travel.documents.find((candidate) => candidate.id === id)
    return document ? [document] : []
  })
}

export function reservationsById(travel: Travel, ids: readonly string[]) {
  return ids.flatMap((id) => {
    const reservation = travel.reservations.find((candidate) => candidate.id === id)
    return reservation ? [reservation] : []
  })
}

export function capitalize(text: string) {
  return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1)
}

export function formatDayHeading(date: string, locale: string) {
  return capitalize(new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`)))
}

export function formatDayParts(date: string, locale: string) {
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

export function programTarget(travel: Travel, clock: Clock): TravelView {
  const today = getTodayState(travel, clock)
  if (today.status === 'day') return { kind: 'day', dayId: today.day.id }
  const firstDay = travel.days[0]
  return firstDay ? { kind: 'day', dayId: firstDay.id } : { kind: 'today' }
}

export function dayVariants(travel: Travel, day: TravelDay) {
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

export function planBElementId(variantId: string) {
  return `plan-b-${variantId}`
}

export function checklistProgress(
  checklists: readonly TravelChecklist[],
  checkedItemKeys: ReadonlySet<string>,
) {
  const keys = checklists.flatMap((checklist) => (
    checklist.items.map((item) => checklistItemStateKey(checklist.id, item.id))
  ))
  if (keys.length === 0) return undefined
  return {
    checked: keys.filter((key) => checkedItemKeys.has(key)).length,
    total: keys.length,
  }
}

export function stepChecklists(travel: Travel, stepId: string) {
  return travel.checklists.filter(
    (checklist) => checklist.target.type === 'step'
      && checklist.target.stepId === stepId,
  )
}

export function pendingReservation(reservation: TravelReservation) {
  return Boolean(reservation.status && (
    /à confirmer|a confirmer|en attente|pending|provisoire|tentative/i
      .test(reservation.status)
  ))
}
