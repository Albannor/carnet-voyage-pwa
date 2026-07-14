import type { Travel } from '../../domain/voyage/model'
import type { PersistedTravel, TravelLibraryEntry } from '../../persistence/model'

export const consultationEntry: TravelLibraryEntry = {
  travelId: 'travel-consultation',
  packageId: 'package-consultation',
  title: 'Escapade Atlantique',
  destination: 'La Rochelle',
  startDate: '2026-07-14',
  endDate: '2026-07-17',
  sourcePackageVersion: '1.0.0',
  sourceTravelVersion: '1.0.0',
  importedAt: '2026-07-01T10:00:00.000Z',
  storageSchemaVersion: 1,
  internalModelVersion: 1,
}

export const consultationTravel: Travel = {
  id: consultationEntry.travelId,
  contentVersion: '1.0.0',
  title: consultationEntry.title,
  destination: { label: consultationEntry.destination, countryCode: 'FR' },
  locale: 'fr-FR',
  timeZone: 'Europe/Paris',
  period: { start: '2026-07-14', end: '2026-07-17' },
  summary: 'Quatre jours structurés autour du port et des îles proches.',
  accommodations: [
    {
      id: 'stay-port',
      label: 'Maison du port',
      placeId: 'place-port',
      period: { start: '2026-07-14', end: '2026-07-15' },
    },
    {
      id: 'stay-island',
      label: 'Escale insulaire',
      placeId: 'place-island',
      period: { start: '2026-07-16', end: '2026-07-17' },
    },
  ],
  places: [
    {
      id: 'place-port',
      label: 'Vieux-Port',
      address: 'Quai du Carénage',
      links: [],
    },
    {
      id: 'place-market',
      label: 'Marché central',
      links: [],
    },
    {
      id: 'place-island',
      label: 'Port de l’île',
      address: 'Jetée principale',
      links: [],
    },
  ],
  days: [
    {
      id: 'day-arrival',
      date: '2026-07-14',
      title: 'Arrivée au port',
      summary: 'Installation et premiers repères.',
      steps: [
        {
          id: 'step-market',
          title: 'Passage au marché',
          description: 'Prévoir les courses utiles pour la journée.',
          startsAt: '09:00',
          endsAt: '10:00',
          placeId: 'place-market',
          links: [],
        },
        {
          id: 'step-check-in',
          title: 'Installation',
          startsAt: '14:00',
          accommodationId: 'stay-port',
          placeId: 'place-port',
          links: [],
        },
        {
          id: 'step-flexible',
          title: 'Pause libre',
          links: [],
        },
      ],
    },
    {
      id: 'day-harbour',
      date: '2026-07-15',
      title: 'Autour du port',
      steps: [],
    },
    {
      id: 'day-island',
      date: '2026-07-16',
      title: 'Cap sur l’île',
      summary: 'Traversée puis installation sur l’île.',
      steps: [
        {
          id: 'step-ferry',
          title: 'Prendre le bateau',
          startsAt: '11:30',
          placeId: 'place-island',
          links: [],
        },
      ],
    },
  ],
  variants: [],
}

export const persistedConsultationTravel: PersistedTravel = {
  metadata: consultationEntry,
  travel: consultationTravel,
}

export function fixedClock(instant: string) {
  return { now: () => new Date(instant) }
}
