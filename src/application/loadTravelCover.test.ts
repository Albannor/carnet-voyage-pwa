import { describe, expect, it, vi } from 'vitest'
import type { Travel } from '../domain/voyage/model'
import type {
  PersistedTravelResource,
  TravelLibraryEntry,
} from '../persistence/model'
import type { TravelLibraryRepository } from '../persistence/repository'
import { loadTravelCover } from './loadTravelCover'

const entry: TravelLibraryEntry = {
  travelId: 'rome-2027',
  packageId: 'rome-2027',
  title: 'Rome en famille - profession de foi de Théophile',
  destination: 'Rome',
  startDate: '2027-01-08',
  endDate: '2027-01-11',
  sourcePackageVersion: '1.0.0',
  sourceTravelVersion: '1.3.0',
  importedAt: '2026-07-16T12:00:00.000Z',
  storageSchemaVersion: 1,
  internalModelVersion: 4,
}

const travel: Travel = {
  id: entry.travelId,
  contentVersion: '1.3.0',
  title: entry.title,
  destination: { label: entry.destination, countryCode: 'IT' },
  locale: 'fr-FR',
  timeZone: 'Europe/Rome',
  period: { start: entry.startDate, end: entry.endDate },
  summary: 'Voyage de test.',
  accommodations: [],
  places: [],
  days: [],
  variants: [],
  documents: [],
  reservations: [],
  checklists: [],
  illustrations: [{
    id: 'illustration-cover',
    resourceId: 'image-cover-skyline',
    alt: 'Vue panoramique de Rome.',
    provenance: { type: 'user-provided' },
  }],
  coverIllustrationId: 'illustration-cover',
}

const resource: PersistedTravelResource = {
  travelId: entry.travelId,
  resourceId: 'image-cover-skyline',
  path: 'assets/cover-skyline.webp',
  mediaType: 'image/webp',
  size: 12,
  sha256: 'a'.repeat(64),
  bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46]),
}

function repositoryWith(
  currentTravel: Travel,
  currentResource = resource,
): TravelLibraryRepository {
  return {
    importPackage: vi.fn(),
    listTravels: vi.fn(),
    getTravel: vi.fn().mockResolvedValue({
      ok: true,
      value: { metadata: entry, travel: currentTravel },
    }),
    getResource: vi.fn().mockResolvedValue({ ok: true, value: currentResource }),
    getPersonalState: vi.fn(),
    setChecklistItemChecked: vi.fn(),
    saveTravelNote: vi.fn(),
    deleteTravel: vi.fn(),
    close: vi.fn(),
  }
}

describe('loadTravelCover', () => {
  it('résout explicitement couverture, illustration, resourceId et ressource du voyage', async () => {
    const repository = repositoryWith(travel)
    const result = await loadTravelCover(repository, entry.travelId)

    expect(result).toEqual({
      status: 'ready',
      illustration: travel.illustrations[0],
      resource,
    })
    expect(repository.getTravel).toHaveBeenCalledWith(entry.travelId)
    expect(repository.getResource).toHaveBeenCalledWith(
      entry.travelId,
      'image-cover-skyline',
    )
  })

  it('retourne un état absent pour un ancien voyage sans couverture', async () => {
    const repository = repositoryWith({
      ...travel,
      contentVersion: '1.0.0',
      illustrations: [],
      coverIllustrationId: undefined,
    })

    expect(await loadTravelCover(repository, entry.travelId)).toEqual({
      status: 'absent',
    })
    expect(repository.getResource).not.toHaveBeenCalled()
  })

  it('refuse défensivement une ressource qui n’est pas une image', async () => {
    const repository = repositoryWith(travel, {
      ...resource,
      mediaType: 'application/pdf',
    })

    expect(await loadTravelCover(repository, entry.travelId)).toEqual({
      status: 'error',
      message: 'La couverture locale n’est pas une image passive autorisée.',
    })
  })
})
