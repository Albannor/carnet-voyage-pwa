import validTravelDocument from '../../examples/voyage/1.0.0/valid/madrid-weekend.json'
import validTravelDocumentV1_1 from '../../examples/voyage/1.1.0/valid/coastal-trip.json'
import type { TravelDocumentV1 } from '../contracts/voyage/v1/document'
import { importTravelPackage, type ValidatedTravelPackage } from '../import/importTravelPackage'
import {
  createPackageArchive,
  selectedPackageFile,
  TEST_PDF_BYTES,
  TEST_PNG_BYTES,
} from '../import/test/packageFixtures'
import { sha256Hex } from '../import/sha256'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  deleteTravelDatabase,
  openIndexedDbTravelRepository,
  TRAVEL_DATABASE_VERSION,
  TRAVEL_INDEXES,
  TRAVEL_STORES,
} from './indexedDbTravelRepository'
import type { PersistedPersonalState } from './model'
import type { TravelLibraryRepository } from './repository'

let databaseCounter = 0
let databaseName = ''
let repositories: TravelLibraryRepository[] = []

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionCompletion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
    transaction.onerror = () => undefined
  })
}

async function openRawDatabase(name: string) {
  return requestResult(indexedDB.open(name, TRAVEL_DATABASE_VERSION))
}

async function openRepository() {
  const opened = await openIndexedDbTravelRepository({
    databaseName,
    now: () => new Date('2026-07-14T12:00:00.000Z'),
  })
  if (!opened.ok) throw new Error(opened.error.code)
  repositories.push(opened.value)
  return opened.value
}

function prefixedTravelDocument(suffix: string): TravelDocumentV1 {
  const document = structuredClone(validTravelDocument) as TravelDocumentV1
  const prefix = `${suffix}-`
  const placeIds = new Map(document.places.map((place) => [place.id, `${prefix}${place.id}`]))
  const accommodationIds = new Map(
    document.accommodations.map((stay) => [stay.id, `${prefix}${stay.id}`]),
  )
  const dayIds = new Map(document.days.map((day) => [day.id, `${prefix}${day.id}`]))
  const stepIds = new Map(
    document.days.flatMap((day) =>
      day.steps.map((step) => [step.id, `${prefix}${step.id}`] as const),
    ),
  )

  document.id = `travel-${suffix}`
  document.title = `Voyage ${suffix}`
  document.destination.name = `Destination ${suffix}`
  for (const place of document.places) {
    place.id = placeIds.get(place.id)!
    for (const link of place.links) link.id = `${prefix}${link.id}`
  }
  for (const stay of document.accommodations) {
    stay.id = accommodationIds.get(stay.id)!
    stay.placeId = placeIds.get(stay.placeId)!
  }
  for (const day of document.days) {
    day.id = dayIds.get(day.id)!
    for (const step of day.steps) {
      step.id = stepIds.get(step.id)!
      if (step.placeId) step.placeId = placeIds.get(step.placeId)!
      if (step.accommodationId) {
        step.accommodationId = accommodationIds.get(step.accommodationId)!
      }
      for (const link of step.links) link.id = `${prefix}${link.id}`
    }
  }
  for (const variant of document.variants) {
    variant.id = `${prefix}${variant.id}`
    variant.targetId =
      variant.targetType === 'day'
        ? dayIds.get(variant.targetId)!
        : stepIds.get(variant.targetId)!
  }
  return document
}

async function validatedPackage(
  suffix: string,
  resourceMarker = 0,
): Promise<ValidatedTravelPackage> {
  const travel = prefixedTravelDocument(suffix)
  const resourceBytes = new Uint8Array([...TEST_PNG_BYTES, resourceMarker])
  const archive = await createPackageArchive({
    travel,
    includeDefaultResource: false,
    manifest: {
      id: travel.id,
      resources: [
        {
          id: 'cover-image',
          path: 'assets/cover.png',
          mediaType: 'image/png',
          size: resourceBytes.length,
          sha256: await sha256Hex(resourceBytes),
        },
      ],
    },
    extraFiles: { 'assets/cover.png': resourceBytes },
  })
  const imported = await importTravelPackage(selectedPackageFile(archive))
  if (!imported.ok) throw new Error(imported.errors[0]?.code)
  return imported.package
}

async function validatedPackageV1_1(): Promise<ValidatedTravelPackage> {
  const archive = await createPackageArchive({
    travel: validTravelDocumentV1_1,
    includeDefaultResource: false,
    manifest: {
      id: validTravelDocumentV1_1.id,
      travelModelVersion: '1.1.0',
      resources: [{
        id: 'pdf-ferry-ticket',
        path: 'documents/booking.pdf',
        mediaType: 'application/pdf',
        size: TEST_PDF_BYTES.length,
        sha256: await sha256Hex(TEST_PDF_BYTES),
      }],
    },
    extraFiles: { 'documents/booking.pdf': TEST_PDF_BYTES },
  })
  const imported = await importTravelPackage(selectedPackageFile(archive))
  if (!imported.ok) throw new Error(imported.errors[0]?.code)
  return imported.package
}

async function seedPersonalState(state: PersistedPersonalState) {
  const database = await openRawDatabase(databaseName)
  const transaction = database.transaction(TRAVEL_STORES.personalStates, 'readwrite')
  const completion = transactionCompletion(transaction)
  await requestResult(
    transaction.objectStore(TRAVEL_STORES.personalStates).add(state),
  )
  await completion
  database.close()
}

async function personalStatesFor(travelId: string) {
  const database = await openRawDatabase(databaseName)
  const transaction = database.transaction(TRAVEL_STORES.personalStates, 'readonly')
  const completion = transactionCompletion(transaction)
  const states = await requestResult<PersistedPersonalState[]>(
    transaction
      .objectStore(TRAVEL_STORES.personalStates)
      .index(TRAVEL_INDEXES.personalStatesByTravel)
      .getAll(travelId),
  )
  await completion
  database.close()
  return states
}

beforeEach(() => {
  databaseCounter += 1
  databaseName = `carnet-voyage-test-${databaseCounter}`
  repositories = []
})

afterEach(async () => {
  repositories.forEach((repository) => repository.close())
  await deleteTravelDatabase(databaseName)
})

describe('IndexedDbTravelRepository', () => {
  it('crée et ouvre la base versionnée avec ses quatre espaces', async () => {
    await openRepository()
    const database = await openRawDatabase(databaseName)

    expect(database.version).toBe(1)
    expect(Array.from(database.objectStoreNames)).toEqual([
      TRAVEL_STORES.personalStates,
      TRAVEL_STORES.contents,
      TRAVEL_STORES.metadata,
      TRAVEL_STORES.resources,
    ])
    database.close()
  })

  it('enregistre atomiquement un voyage validé', async () => {
    const repository = await openRepository()
    const travelPackage = await validatedPackage('alpha')

    const result = await repository.importPackage(travelPackage)

    expect(result).toMatchObject({
      ok: true,
      value: {
        travelId: 'travel-alpha',
        packageId: 'travel-alpha',
        sourcePackageVersion: '1.0.0',
        sourceTravelVersion: '1.0.0',
        importedAt: '2026-07-14T12:00:00.000Z',
      },
    })
  })

  it('retrouve le voyage après fermeture et réouverture de la base', async () => {
    const firstRepository = await openRepository()
    await firstRepository.importPackage(await validatedPackage('alpha'))
    firstRepository.close()

    const reopened = await openRepository()
    const result = await reopened.getTravel('travel-alpha')

    expect(result.ok && result.value.travel.title).toBe('Voyage alpha')
  })

  it('adapte en mémoire un contenu interne antérieur sans collections 1.1.0', async () => {
    const repository = await openRepository()
    await repository.importPackage(await validatedPackage('legacy'))
    repository.close()

    const database = await openRawDatabase(databaseName)
    const readTransaction = database.transaction(TRAVEL_STORES.contents, 'readonly')
    const readCompletion = transactionCompletion(readTransaction)
    const legacyContent = await requestResult<Record<string, unknown>>(
      readTransaction.objectStore(TRAVEL_STORES.contents).get('travel-legacy'),
    )
    await readCompletion
    const legacyTravel = legacyContent.travel as Record<string, unknown>
    delete legacyTravel.documents
    delete legacyTravel.reservations
    for (const day of legacyTravel.days as Array<Record<string, unknown>>) {
      delete day.documentIds
      delete day.reservationIds
      for (const step of day.steps as Array<Record<string, unknown>>) {
        delete step.documentIds
        delete step.reservationIds
      }
    }
    legacyContent.internalModelVersion = 1
    const writeTransaction = database.transaction(TRAVEL_STORES.contents, 'readwrite')
    const writeCompletion = transactionCompletion(writeTransaction)
    writeTransaction.objectStore(TRAVEL_STORES.contents).put(legacyContent)
    await writeCompletion
    database.close()

    const reopened = await openRepository()
    const result = await reopened.getTravel('travel-legacy')

    expect(result.ok && result.value.travel.documents).toEqual([])
    expect(result.ok && result.value.travel.reservations).toEqual([])
    expect(result.ok && result.value.travel.days[0]?.documentIds).toEqual([])
    expect(result.ok && result.value.travel.days[0]?.steps[0]?.reservationIds).toEqual([])
  })

  it('persiste le contrat 1.1.0 et permet de relire son PDF local', async () => {
    const repository = await openRepository()
    await repository.importPackage(await validatedPackageV1_1())
    repository.close()

    const reopened = await openRepository()
    const stored = await reopened.getTravel(validTravelDocumentV1_1.id)
    const resource = await reopened.getResource(
      validTravelDocumentV1_1.id,
      'pdf-ferry-ticket',
    )

    expect(stored.ok && stored.value.travel).toMatchObject({
      contentVersion: '1.1.0',
      documents: [{ id: 'document-ticket', resourceId: 'pdf-ferry-ticket' }],
      reservations: [{ id: 'reservation-ferry' }],
    })
    expect(resource.ok && resource.value).toMatchObject({
      mediaType: 'application/pdf',
      size: TEST_PDF_BYTES.length,
    })
    expect(resource.ok && Array.from(resource.value.bytes)).toEqual(
      Array.from(TEST_PDF_BYTES),
    )
  })

  it('fait coexister plusieurs voyages', async () => {
    const repository = await openRepository()
    await repository.importPackage(await validatedPackage('alpha'))
    await repository.importPackage(await validatedPackage('beta'))

    const listed = await repository.listTravels()

    expect(listed.ok && listed.value.map((entry) => entry.travelId).sort()).toEqual([
      'travel-alpha',
      'travel-beta',
    ])
  })

  it('récupère le bon contenu par identifiant de voyage', async () => {
    const repository = await openRepository()
    await repository.importPackage(await validatedPackage('alpha'))
    await repository.importPackage(await validatedPackage('beta'))

    const result = await repository.getTravel('travel-beta')

    expect(result.ok && result.value.travel.destination.label).toBe(
      'Destination beta',
    )
  })

  it('récupère la ressource passive avec ses métadonnées d’intégrité', async () => {
    const repository = await openRepository()
    await repository.importPackage(await validatedPackage('alpha', 17))

    const result = await repository.getResource('travel-alpha', 'cover-image')

    expect(result.ok && result.value).toMatchObject({
      travelId: 'travel-alpha',
      resourceId: 'cover-image',
      path: 'assets/cover.png',
      mediaType: 'image/png',
      size: TEST_PNG_BYTES.length + 1,
    })
    expect(result.ok && result.value.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(result.ok && result.value.bytes.at(-1)).toBe(17)
  })

  it('ne mélange pas deux ressources portant le même identifiant', async () => {
    const repository = await openRepository()
    await repository.importPackage(await validatedPackage('alpha', 11))
    await repository.importPackage(await validatedPackage('beta', 22))

    const alpha = await repository.getResource('travel-alpha', 'cover-image')
    const beta = await repository.getResource('travel-beta', 'cover-image')

    expect(alpha.ok && alpha.value.bytes.at(-1)).toBe(11)
    expect(beta.ok && beta.value.bytes.at(-1)).toBe(22)
  })

  it('refuse un identifiant déjà présent sans écrasement', async () => {
    const repository = await openRepository()
    await repository.importPackage(await validatedPackage('alpha', 11))

    const duplicate = await repository.importPackage(
      await validatedPackage('alpha', 99),
    )
    const retained = await repository.getResource('travel-alpha', 'cover-image')

    expect(duplicate).toMatchObject({
      ok: false,
      error: { code: 'TRAVEL_ALREADY_EXISTS', travelId: 'travel-alpha' },
    })
    expect(retained.ok && retained.value.bytes.at(-1)).toBe(11)
  })

  it('annule les métadonnées si l’écriture du contenu échoue', async () => {
    const repository = await openRepository()
    const travelPackage = await validatedPackage('alpha')
    const brokenPackage = {
      ...travelPackage,
      travel: {
        ...travelPackage.travel,
        places: [
          {
            ...travelPackage.travel.places[0]!,
            label: (() => undefined) as unknown as string,
          },
          ...travelPackage.travel.places.slice(1),
        ],
      },
    }

    const result = await repository.importPackage(brokenPackage)
    const listed = await repository.listTravels()

    expect(result).toMatchObject({ ok: false, error: { code: 'WRITE_FAILED' } })
    expect(listed.ok && listed.value).toEqual([])
  })

  it('annule le contenu si l’écriture d’une ressource échoue', async () => {
    const repository = await openRepository()
    const travelPackage = await validatedPackage('alpha')
    const brokenPackage = {
      ...travelPackage,
      resources: [
        {
          ...travelPackage.resources[0]!,
          bytes: (() => undefined) as unknown as Uint8Array,
        },
      ],
    }

    const result = await repository.importPackage(brokenPackage)
    const travel = await repository.getTravel('travel-alpha')

    expect(result).toMatchObject({ ok: false, error: { code: 'WRITE_FAILED' } })
    expect(travel).toMatchObject({ ok: false, error: { code: 'TRAVEL_NOT_FOUND' } })
  })

  it('ne laisse ni voyage ni ressource orpheline après un échec tardif', async () => {
    const repository = await openRepository()
    const travelPackage = await validatedPackage('alpha')
    const brokenPackage = {
      ...travelPackage,
      resources: [
        travelPackage.resources[0]!,
        {
          ...travelPackage.resources[0]!,
          id: 'second-resource',
          bytes: (() => undefined) as unknown as Uint8Array,
        },
      ],
      manifest: {
        ...travelPackage.manifest,
        resources: [
          travelPackage.manifest.resources[0]!,
          {
            ...travelPackage.manifest.resources[0]!,
            id: 'second-resource',
          },
        ],
      },
    }

    const result = await repository.importPackage(brokenPackage)

    expect(result.ok).toBe(false)
    await expect(repository.listTravels()).resolves.toEqual({ ok: true, value: [] })
    await expect(
      repository.getResource('travel-alpha', 'cover-image'),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'RESOURCE_NOT_FOUND' },
    })
  })

  it('supprime le voyage ciblé', async () => {
    const repository = await openRepository()
    await repository.importPackage(await validatedPackage('alpha'))

    const deleted = await repository.deleteTravel('travel-alpha')
    const travel = await repository.getTravel('travel-alpha')

    expect(deleted).toEqual({ ok: true, value: undefined })
    expect(travel).toMatchObject({ ok: false, error: { code: 'TRAVEL_NOT_FOUND' } })
  })

  it('conserve les autres voyages après une suppression', async () => {
    const repository = await openRepository()
    await repository.importPackage(await validatedPackage('alpha'))
    await repository.importPackage(await validatedPackage('beta'))

    await repository.deleteTravel('travel-alpha')

    const beta = await repository.getTravel('travel-beta')
    expect(beta.ok && beta.value.travel.title).toBe('Voyage beta')
  })

  it('supprime uniquement les ressources du voyage concerné', async () => {
    const repository = await openRepository()
    await repository.importPackage(await validatedPackage('alpha', 11))
    await repository.importPackage(await validatedPackage('beta', 22))

    await repository.deleteTravel('travel-alpha')

    await expect(
      repository.getResource('travel-alpha', 'cover-image'),
    ).resolves.toMatchObject({ ok: false, error: { code: 'RESOURCE_NOT_FOUND' } })
    const beta = await repository.getResource('travel-beta', 'cover-image')
    expect(beta.ok && beta.value.bytes.at(-1)).toBe(22)
  })

  it('supprime seulement les futurs états personnels associés au voyage', async () => {
    const repository = await openRepository()
    await repository.importPackage(await validatedPackage('alpha'))
    await repository.importPackage(await validatedPackage('beta'))
    await seedPersonalState({
      travelId: 'travel-alpha',
      namespace: 'future-test',
      key: 'one',
      value: true,
      updatedAt: '2026-07-14T12:00:00.000Z',
    })
    await seedPersonalState({
      travelId: 'travel-beta',
      namespace: 'future-test',
      key: 'two',
      value: true,
      updatedAt: '2026-07-14T12:00:00.000Z',
    })

    await repository.deleteTravel('travel-alpha')

    expect(await personalStatesFor('travel-alpha')).toEqual([])
    expect(await personalStatesFor('travel-beta')).toHaveLength(1)
  })

  it('signale un voyage introuvable avec son identifiant', async () => {
    const repository = await openRepository()

    await expect(repository.getTravel('missing')).resolves.toMatchObject({
      ok: false,
      error: { code: 'TRAVEL_NOT_FOUND', travelId: 'missing' },
    })
    await expect(repository.deleteTravel('missing')).resolves.toMatchObject({
      ok: false,
      error: { code: 'TRAVEL_NOT_FOUND', travelId: 'missing' },
    })
  })

  it('signale une ressource introuvable dans le périmètre demandé', async () => {
    const repository = await openRepository()

    await expect(repository.getResource('travel-alpha', 'missing')).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'RESOURCE_NOT_FOUND',
        travelId: 'travel-alpha',
        resourceId: 'missing',
      },
    })
  })

  it('retourne une liste vide pour une nouvelle base', async () => {
    const repository = await openRepository()

    await expect(repository.listTravels()).resolves.toEqual({ ok: true, value: [] })
  })

  it('liste les métadonnées de plusieurs imports sans charger les contenus', async () => {
    const repository = await openRepository()
    await repository.importPackage(await validatedPackage('alpha'))
    await repository.importPackage(await validatedPackage('beta'))

    const listed = await repository.listTravels()

    expect(listed.ok && listed.value).toHaveLength(2)
    expect(listed.ok && listed.value[0]).not.toHaveProperty('travel')
  })

  it('retourne une erreur structurée quand IndexedDB est indisponible', async () => {
    const result = await openIndexedDbTravelRepository({ indexedDB: null })

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INDEXED_DB_UNAVAILABLE' },
    })
  })

  it('retourne READ_FAILED quand une lecture locale devient impossible', async () => {
    const repository = await openRepository()
    repository.close()

    await expect(repository.listTravels()).resolves.toMatchObject({
      ok: false,
      error: { code: 'READ_FAILED' },
    })
  })

  it('retourne DELETE_FAILED quand une suppression locale devient impossible', async () => {
    const repository = await openRepository()
    repository.close()

    await expect(repository.deleteTravel('travel-alpha')).resolves.toMatchObject({
      ok: false,
      error: { code: 'DELETE_FAILED', travelId: 'travel-alpha' },
    })
  })

  it('refuse une version future de la base sans supprimer ses données', async () => {
    const futureDatabase = await requestResult(indexedDB.open(databaseName, 2))
    futureDatabase.close()

    const result = await openIndexedDbTravelRepository({ databaseName })

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'DATABASE_VERSION_INCOMPATIBLE' },
    })
  })
})
