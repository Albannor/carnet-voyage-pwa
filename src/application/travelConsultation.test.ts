import { describe, expect, it } from 'vitest'
import {
  findAccommodationForDate,
  getOverviewAnchorDate,
  getTodayState,
  localDateInTimeZone,
} from './travelConsultation'
import {
  consultationTravel,
  fixedClock,
} from '../ui/travel/testFixtures'

describe('règles temporelles de consultation', () => {
  it('retrouve la journée correspondant à la date locale du voyage', () => {
    const result = getTodayState(
      consultationTravel,
      fixedClock('2026-07-15T08:00:00.000Z'),
    )

    expect(result).toMatchObject({ status: 'day', date: '2026-07-15' })
    expect(result.status === 'day' && result.day.id).toBe('day-harbour')
  })

  it('distingue un voyage qui n’a pas encore commencé', () => {
    expect(
      getTodayState(consultationTravel, fixedClock('2026-07-12T12:00:00Z')),
    ).toEqual({ status: 'before', date: '2026-07-12' })
  })

  it('distingue un voyage terminé', () => {
    expect(
      getTodayState(consultationTravel, fixedClock('2026-07-19T12:00:00Z')),
    ).toEqual({ status: 'after', date: '2026-07-19' })
  })

  it('signale une date du séjour sans journée correspondante', () => {
    expect(
      getTodayState(consultationTravel, fixedClock('2026-07-17T12:00:00Z')),
    ).toEqual({ status: 'missing-day', date: '2026-07-17' })
  })

  it('calcule des dates distinctes au même instant selon le fuseau', () => {
    const instant = new Date('2026-07-15T01:00:00Z')

    expect(localDateInTimeZone(instant, 'Europe/Paris')).toBe('2026-07-15')
    expect(localDateInTimeZone(instant, 'America/Los_Angeles')).toBe('2026-07-14')
  })

  it('sélectionne des journées différentes pour deux voyages dans des fuseaux distincts', () => {
    const clock = fixedClock('2026-07-15T01:00:00Z')
    const paris = getTodayState(consultationTravel, clock)
    const losAngeles = getTodayState(
      { ...consultationTravel, timeZone: 'America/Los_Angeles' },
      clock,
    )

    expect(paris.status === 'day' && paris.day.id).toBe('day-harbour')
    expect(losAngeles.status === 'day' && losAngeles.day.id).toBe('day-arrival')
  })

  it('bascule de journée à minuit dans le fuseau du voyage', () => {
    expect(
      localDateInTimeZone(new Date('2026-07-14T21:59:59Z'), 'Europe/Paris'),
    ).toBe('2026-07-14')
    expect(
      localDateInTimeZone(new Date('2026-07-14T22:00:00Z'), 'Europe/Paris'),
    ).toBe('2026-07-15')
  })

  it('retient le début du séjour comme ancre avant le départ', () => {
    expect(
      getOverviewAnchorDate(consultationTravel, fixedClock('2026-07-01T12:00:00Z')),
    ).toBe('2026-07-14')
  })

  it('retient la fin du séjour comme ancre après le retour', () => {
    expect(
      getOverviewAnchorDate(consultationTravel, fixedClock('2026-07-30T12:00:00Z')),
    ).toBe('2026-07-17')
  })
})

describe('sélection de l’hébergement', () => {
  it('retourne l’hébergement dont la période contient la journée', () => {
    expect(
      findAccommodationForDate(consultationTravel, '2026-07-15')?.accommodation.id,
    ).toBe('stay-port')
  })

  it('sélectionne un second hébergement après le changement d’étape', () => {
    expect(
      findAccommodationForDate(consultationTravel, '2026-07-16')?.accommodation.id,
    ).toBe('stay-island')
  })

  it('ne prolonge pas un hébergement hors de sa période', () => {
    expect(findAccommodationForDate(consultationTravel, '2026-07-13')).toBeUndefined()
  })
})
