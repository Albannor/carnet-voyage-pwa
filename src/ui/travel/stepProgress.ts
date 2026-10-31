import type { TravelStep } from '../../domain/voyage/model'

export type StepProgress = 'done' | 'current' | 'next' | 'upcoming'

/** Heure locale du voyage au format HH:MM, sur 24 heures. */
export function localTimeInTimeZone(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00'
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'
  return `${hour}:${minute}`
}

/**
 * Situe chaque étape de la journée en cours par rapport à l’heure locale.
 * Une étape est passée lorsque sa fin — son heure de fin, sinon le début de
 * l’étape horodatée suivante — est atteinte. Sans aucun horaire, rien n’est
 * déduit et la fonction ne renvoie rien.
 */
export function stepProgress(
  steps: readonly TravelStep[],
  now: string,
): readonly StepProgress[] | undefined {
  if (!steps.some((step) => step.startsAt || step.endsAt)) return undefined

  let lastDone = -1
  steps.forEach((step, index) => {
    const end = step.endsAt
      ?? steps.slice(index + 1).find((candidate) => candidate.startsAt)?.startsAt
    if (end && end <= now) lastDone = index
  })

  const focus = lastDone + 1
  return steps.map((step, index) => {
    if (index <= lastDone) return 'done'
    if (index > focus) return 'upcoming'
    return step.startsAt && step.startsAt <= now ? 'current' : 'next'
  })
}
