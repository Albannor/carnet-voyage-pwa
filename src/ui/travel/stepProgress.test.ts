import { describe, expect, it } from 'vitest'
import type { TravelStep } from '../../domain/voyage/model'
import { localTimeInTimeZone, stepProgress } from './stepProgress'

function step(id: string, startsAt?: string, endsAt?: string): TravelStep {
  return {
    id,
    title: id,
    startsAt,
    endsAt,
    links: [],
    documentIds: [],
    reservationIds: [],
    illustrationIds: [],
  }
}

const steps = [
  step('marche', '09:00', '10:00'),
  step('installation', '14:00'),
  step('pause'),
  step('diner', '19:30', '21:00'),
]

describe('progression de la journée', () => {
  it('lit l’heure dans le fuseau du voyage', () => {
    expect(localTimeInTimeZone(new Date('2026-07-14T08:05:00Z'), 'Europe/Paris')).toBe('10:05')
    expect(localTimeInTimeZone(new Date('2026-07-14T23:30:00Z'), 'Europe/Paris')).toBe('01:30')
  })

  it('désigne la première étape comme prochaine avant le début', () => {
    expect(stepProgress(steps, '08:00')).toEqual(['next', 'upcoming', 'upcoming', 'upcoming'])
  })

  it('distingue une étape en cours d’une prochaine étape', () => {
    expect(stepProgress(steps, '09:30')).toEqual(['current', 'upcoming', 'upcoming', 'upcoming'])
    expect(stepProgress(steps, '10:00')).toEqual(['done', 'next', 'upcoming', 'upcoming'])
  })

  it('termine une étape sans fin au début de l’étape horodatée suivante', () => {
    expect(stepProgress(steps, '15:00')).toEqual(['done', 'current', 'upcoming', 'upcoming'])
    expect(stepProgress(steps, '19:30')).toEqual(['done', 'done', 'done', 'current'])
  })

  it('ne met rien en avant une fois la journée terminée', () => {
    expect(stepProgress(steps, '22:00')).toEqual(['done', 'done', 'done', 'done'])
  })

  it('n’invente rien pour une journée sans horaire', () => {
    expect(stepProgress([step('a'), step('b')], '12:00')).toBeUndefined()
  })
})
