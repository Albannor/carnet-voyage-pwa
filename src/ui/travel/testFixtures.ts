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
  sourceTravelVersion: '1.1.0',
  importedAt: '2026-07-01T10:00:00.000Z',
  storageSchemaVersion: 1,
  internalModelVersion: 2,
}

export const consultationTravel: Travel = {
  id: consultationEntry.travelId,
  contentVersion: '1.1.0',
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
      links: [
        {
          id: 'link-port-route',
          label: 'Ouvrir l’itinéraire vers le Vieux-Port',
          href: 'https://example.com/route/port',
        },
      ],
    },
    {
      id: 'place-market',
      label: 'Marché central',
      address: 'Place du Marché',
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
          links: [
            {
              id: 'link-market-route',
              label: 'Ouvrir l’itinéraire vers le marché',
              href: 'https://example.com/route/market',
            },
          ],
          documentIds: [],
          reservationIds: [],
          illustrationIds: [],
        },
        {
          id: 'step-check-in',
          title: 'Installation',
          startsAt: '14:00',
          accommodationId: 'stay-port',
          placeId: 'place-port',
          links: [],
          documentIds: ['document-booking'],
          reservationIds: ['reservation-stay'],
          illustrationIds: [],
        },
        {
          id: 'step-flexible',
          title: 'Pause libre',
          links: [],
          documentIds: [],
          reservationIds: [],
          illustrationIds: [],
        },
      ],
      documentIds: [],
      reservationIds: [],
      illustrationIds: [],
    },
    {
      id: 'day-harbour',
      date: '2026-07-15',
      title: 'Autour du port',
      steps: [],
      documentIds: ['document-booking'],
      reservationIds: ['reservation-stay'],
      illustrationIds: [],
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
          documentIds: [],
          reservationIds: [],
          illustrationIds: [],
        },
      ],
      documentIds: [],
      reservationIds: [],
      illustrationIds: [],
    },
  ],
  variants: [
    {
      id: 'variant-arrival-rain',
      kind: 'rain',
      label: 'Accueil couvert',
      description: 'Attendre sous la halle avant l’installation.',
      target: { type: 'day', dayId: 'day-arrival' },
    },
    {
      id: 'variant-market-low-walking',
      kind: 'low-walking',
      label: 'Marché sans détour',
      description: 'Rejoindre directement l’entrée principale.',
      target: { type: 'step', stepId: 'step-market' },
    },
  ],
  documents: [
    {
      id: 'document-booking',
      label: 'Confirmation d’hébergement',
      description: 'PDF enregistré avec le voyage.',
      resourceId: 'pdf-booking',
    },
  ],
  reservations: [
    {
      id: 'reservation-stay',
      label: 'Réservation Maison du port',
      reference: 'PORT-2026',
      date: '2026-07-14',
      time: '14:00',
      status: 'Confirmée',
      links: [
        {
          id: 'link-manage-stay',
          label: 'Gérer la réservation Maison du port',
          href: 'https://example.com/reservations/PORT-2026',
        },
      ],
      documentIds: ['document-booking'],
    },
  ],
  checklists: [
    {
      id: 'checklist-travel',
      title: 'Avant le départ',
      target: { type: 'travel' },
      items: [{ id: 'item-passport', label: 'Prendre les pièces d’identité' }],
    },
    {
      id: 'checklist-day',
      title: 'Pour l’arrivée',
      target: { type: 'day', dayId: 'day-arrival' },
      items: [{ id: 'item-checkin', label: 'Vérifier l’heure d’arrivée' }],
    },
    {
      id: 'checklist-step',
      title: 'Au marché',
      target: { type: 'step', stepId: 'step-market' },
      items: [{ id: 'item-bag', label: 'Prendre un sac' }],
    },
  ],
  illustrations: [],
}

export const persistedConsultationTravel: PersistedTravel = {
  metadata: consultationEntry,
  travel: consultationTravel,
}

export function fixedClock(instant: string) {
  return { now: () => new Date(instant) }
}
