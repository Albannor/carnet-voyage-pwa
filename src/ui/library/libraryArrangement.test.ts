import { describe, expect, it } from 'vitest'
import type { TravelLibraryEntry } from '../../persistence/model'
import {
  arrangeLibrary,
  formatTravelDates,
  localIsoDate,
  travelDurationLabel,
  travelTiming,
} from './libraryArrangement'

function entry(travelId: string, startDate: string, endDate: string): TravelLibraryEntry {
  return {
    travelId,
    packageId: travelId,
    title: travelId,
    destination: 'Destination',
    startDate,
    endDate,
    sourcePackageVersion: '1.0.0',
    sourceTravelVersion: '1.3.0',
    importedAt: '2026-07-16T12:00:00.000Z',
    storageSchemaVersion: 1,
    internalModelVersion: 4,
  }
}

const past = entry('passe', '2026-05-01', '2026-05-04')
const olderPast = entry('ancien', '2025-08-01', '2025-08-10')
const soon = entry('bientot', '2026-11-13', '2026-11-15')
const later = entry('plus-tard', '2027-01-08', '2027-01-11')
const ongoing = entry('en-cours', '2026-10-30', '2026-11-02')

describe('organisation de la bibliothèque', () => {
  it('classe un voyage selon la date du jour, bornes incluses', () => {
    expect(travelTiming(ongoing, '2026-10-30')).toBe('ongoing')
    expect(travelTiming(ongoing, '2026-11-02')).toBe('ongoing')
    expect(travelTiming(soon, '2026-10-31')).toBe('upcoming')
    expect(travelTiming(past, '2026-10-31')).toBe('past')
  })

  it('met en avant le prochain départ et liste les autres voyages', () => {
    const { featured, others } = arrangeLibrary([later, past, soon, olderPast], '2026-10-31')

    expect(featured).toEqual({ entry: soon, timing: 'upcoming' })
    expect(others.map(({ entry: item }) => item.travelId))
      .toEqual(['plus-tard', 'passe', 'ancien'])
  })

  it('préfère un voyage en cours à un voyage à venir', () => {
    const { featured } = arrangeLibrary([soon, ongoing], '2026-10-31')
    expect(featured).toEqual({ entry: ongoing, timing: 'ongoing' })
  })

  it('met en avant le voyage terminé le plus récent lorsqu’aucun départ n’est prévu', () => {
    const { featured, others } = arrangeLibrary([olderPast, past], '2026-10-31')
    expect(featured).toEqual({ entry: past, timing: 'past' })
    expect(others).toHaveLength(1)
  })

  it('ne propose aucun voyage mis en avant pour une bibliothèque vide', () => {
    expect(arrangeLibrary([], '2026-10-31')).toEqual({ featured: undefined, others: [] })
  })

  it('lit la date civile de l’appareil', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })

  it('formate les dates et la durée en français', () => {
    expect(formatTravelDates('2026-11-13', '2026-11-15')).toMatch(/^13\s?–\s?15 nov\. 2026$/)
    expect(formatTravelDates('2026-12-30', '2027-01-02')).toMatch(/30 déc\. 2026\s?–\s?2 janv\. 2027/)
    expect(travelDurationLabel('2026-11-13', '2026-11-15')).toBe('3 jours')
    expect(travelDurationLabel('2026-11-13', '2026-11-13')).toBe('1 jour')
  })
})
