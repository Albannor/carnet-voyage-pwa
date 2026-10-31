import type { ValidatedTravelPackage } from '../import/importTravelPackage'
import {
  INTERNAL_TRAVEL_MODEL_VERSION,
  GENERAL_NOTE_KEY,
  MAX_TRAVEL_NOTE_LENGTH,
  PERSONAL_STATE_NAMESPACES,
  PERSONAL_STATE_RECORD_VERSION,
  checklistItemStateKey,
  type PersistedChecklistItemState,
  type PersistedPersonalState,
  type PersistedTravel,
  type PersistedTravelContent,
  type PersistedTravelResource,
  type PersistedTravelNoteState,
  type TravelPersonalState,
  type TravelLibraryEntry,
} from './model'
import {
  persistenceIssue,
  type PersistenceIssue,
  type PersistenceResult,
  type TravelLibraryRepository,
} from './repository'

export const TRAVEL_DATABASE_NAME = 'carnet-voyage'
export const TRAVEL_DATABASE_VERSION = 1

export const TRAVEL_STORES = Object.freeze({
  metadata: 'travelMetadata',
  contents: 'travelContents',
  resources: 'travelResources',
  personalStates: 'personalStates',
})

export const TRAVEL_INDEXES = Object.freeze({
  resourcesByTravel: 'byTravelId',
  resourcesByPath: 'byTravelAndPath',
  personalStatesByTravel: 'byTravelId',
})

export interface IndexedDbTravelRepositoryOptions {
  readonly databaseName?: string
  readonly indexedDB?: IDBFactory | null
  readonly now?: () => Date
}

function success<T>(value: T): PersistenceResult<T> {
  return { ok: true, value }
}

function failure<T>(error: PersistenceIssue): PersistenceResult<T> {
  return { ok: false, error }
}

function normalizeStoredTravel(content: PersistedTravelContent) {
  if (content.internalModelVersion > INTERNAL_TRAVEL_MODEL_VERSION) {
    return undefined
  }

  const travel = content.travel
  return {
    ...travel,
    documents: travel.documents ?? [],
    reservations: travel.reservations ?? [],
    checklists: travel.checklists ?? [],
    illustrations: travel.illustrations ?? [],
    days: travel.days.map((day) => ({
      ...day,
      documentIds: day.documentIds ?? [],
      reservationIds: day.reservationIds ?? [],
      illustrationIds: day.illustrationIds ?? [],
      steps: day.steps.map((step) => ({
        ...step,
        documentIds: step.documentIds ?? [],
        reservationIds: step.reservationIds ?? [],
        illustrationIds: step.illustrationIds ?? [],
      })),
    })),
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionCompletion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () =>
      reject(transaction.error ?? new DOMException('Transaction annulée', 'AbortError'))
    transaction.onerror = () => undefined
  })
}

function errorName(error: unknown) {
  return error instanceof DOMException || error instanceof Error
    ? error.name
    : undefined
}

async function abortAndWait(
  transaction: IDBTransaction,
  completion: Promise<void>,
) {
  try {
    transaction.abort()
  } catch {
    // La transaction peut déjà être annulée automatiquement par IndexedDB.
  }

  try {
    await completion
  } catch {
    // Le résultat structuré est construit par l'appelant après le rollback.
  }
}

function createDatabaseSchema(database: IDBDatabase) {
  const metadata = database.createObjectStore(TRAVEL_STORES.metadata, {
    keyPath: 'travelId',
  })
  metadata.createIndex('byImportedAt', 'importedAt', { unique: false })

  database.createObjectStore(TRAVEL_STORES.contents, {
    keyPath: 'travelId',
  })

  const resources = database.createObjectStore(TRAVEL_STORES.resources, {
    keyPath: ['travelId', 'resourceId'],
  })
  resources.createIndex(TRAVEL_INDEXES.resourcesByTravel, 'travelId', {
    unique: false,
  })
  resources.createIndex(
    TRAVEL_INDEXES.resourcesByPath,
    ['travelId', 'path'],
    { unique: true },
  )

  const personalStates = database.createObjectStore(
    TRAVEL_STORES.personalStates,
    { keyPath: ['travelId', 'namespace', 'key'] },
  )
  personalStates.createIndex(
    TRAVEL_INDEXES.personalStatesByTravel,
    'travelId',
    { unique: false },
  )
}

function openDatabase(
  factory: IDBFactory,
  databaseName: string,
): Promise<PersistenceResult<IDBDatabase>> {
  return new Promise((resolve) => {
    let settled = false
    let upgradeFailed = false
    let request: IDBOpenDBRequest

    try {
      request = factory.open(databaseName, TRAVEL_DATABASE_VERSION)
    } catch {
      resolve(
        failure(
          persistenceIssue(
            'DATABASE_OPEN_FAILED',
            "La base locale des voyages n'a pas pu être ouverte.",
            { hint: 'Vérifiez que le stockage du navigateur est autorisé.' },
          ),
        ),
      )
      return
    }

    request.onupgradeneeded = (event) => {
      if (event.oldVersion !== 0) {
        upgradeFailed = true
        request.transaction?.abort()
        return
      }

      try {
        createDatabaseSchema(request.result)
      } catch {
        upgradeFailed = true
        request.transaction?.abort()
      }
    }

    request.onblocked = () => {
      if (settled) return
      settled = true
      resolve(
        failure(
          persistenceIssue(
            'DATABASE_OPEN_FAILED',
            "La base locale est utilisée par une version qui empêche son ouverture.",
            {
              hint: "Fermez les autres onglets de l'application puis réessayez.",
            },
          ),
        ),
      )
    }

    request.onerror = () => {
      if (settled) return
      settled = true
      const incompatible =
        errorName(request.error) === 'VersionError' || upgradeFailed
      resolve(
        failure(
          persistenceIssue(
            incompatible
              ? 'DATABASE_VERSION_INCOMPATIBLE'
              : 'DATABASE_OPEN_FAILED',
            incompatible
              ? "La version locale de la base n'est pas compatible avec cette application."
              : "La base locale des voyages n'a pas pu être ouverte.",
            {
              hint: incompatible
                ? "Mettez l'application à jour sans supprimer ses données locales."
                : 'Vérifiez que le stockage du navigateur est autorisé.',
            },
          ),
        ),
      )
    }

    request.onsuccess = () => {
      if (settled) {
        request.result.close()
        return
      }
      settled = true
      const database = request.result
      database.onversionchange = () => database.close()
      resolve(success(database))
    }
  })
}

function writeFailure(
  error: unknown,
  travelId: string,
  phase: 'metadata' | 'content' | 'resource',
): PersistenceIssue {
  const name = errorName(error)
  if (phase === 'metadata' && name === 'ConstraintError') {
    return persistenceIssue(
      'TRAVEL_ALREADY_EXISTS',
      'Ce voyage est déjà présent dans la bibliothèque.',
      {
        travelId,
        hint: "Supprimez explicitement l'ancien voyage avant de l'importer de nouveau.",
      },
    )
  }
  if (name === 'QuotaExceededError') {
    return persistenceIssue(
      'STORAGE_QUOTA_EXCEEDED',
      "L'espace de stockage local disponible est insuffisant.",
      {
        travelId,
        hint: "Libérez de l'espace sur l'appareil puis réessayez.",
      },
    )
  }
  if (name === 'AbortError') {
    return persistenceIssue(
      'TRANSACTION_ABORTED',
      "L'enregistrement local du voyage a été annulé.",
      { travelId, hint: "Réessayez l'import du paquet." },
    )
  }
  return persistenceIssue(
    'WRITE_FAILED',
    "Le voyage n'a pas pu être enregistré localement.",
    {
      travelId,
      hint: "Aucune donnée partielle n'a été conservée. Réessayez l'import.",
    },
  )
}

function readFailure(travelId?: string): PersistenceIssue {
  return persistenceIssue(
    'READ_FAILED',
    "Les données locales n'ont pas pu être lues.",
    {
      travelId,
      hint: "Fermez puis rouvrez l'application avant de réessayer.",
    },
  )
}

function personalWriteFailure(travelId: string): PersistenceIssue {
  return persistenceIssue(
    'WRITE_FAILED',
    "L’état personnel n’a pas pu être enregistré localement.",
    { travelId, hint: 'La valeur précédente reste conservée. Réessayez.' },
  )
}

const CHECKLIST_ITEM_STATE_KEY_PATTERN =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

function isChecklistState(state: PersistedPersonalState): state is PersistedChecklistItemState {
  return state.namespace === PERSONAL_STATE_NAMESPACES.checklist
    && state.version === PERSONAL_STATE_RECORD_VERSION
    && typeof state.key === 'string'
    && CHECKLIST_ITEM_STATE_KEY_PATTERN.test(state.key)
    && typeof state.value === 'object'
    && state.value !== null
    && typeof (state.value as Record<string, unknown>).checked === 'boolean'
    && Object.keys(state.value as object).length === 1
}

function isNoteState(state: PersistedPersonalState): state is PersistedTravelNoteState {
  return state.namespace === PERSONAL_STATE_NAMESPACES.notes
    && state.key === GENERAL_NOTE_KEY
    && state.version === PERSONAL_STATE_RECORD_VERSION
    && typeof state.value === 'object'
    && state.value !== null
    && typeof (state.value as Record<string, unknown>).text === 'string'
    && ((state.value as Record<string, unknown>).text as string).length <= MAX_TRAVEL_NOTE_LENGTH
    && Object.keys(state.value as object).length === 1
}

class IndexedDbTravelRepository implements TravelLibraryRepository {
  constructor(
    private readonly database: IDBDatabase,
    private readonly now: () => Date,
  ) {}

  async importPackage(
    travelPackage: ValidatedTravelPackage,
  ): Promise<PersistenceResult<TravelLibraryEntry>> {
    const { manifest, travel } = travelPackage
    const importedAt = this.now().toISOString()
    const metadata: TravelLibraryEntry = {
      travelId: travel.id,
      packageId: manifest.id,
      title: travel.title,
      destination: travel.destination.label,
      startDate: travel.period.start,
      endDate: travel.period.end,
      sourcePackageVersion: manifest.packageFormatVersion,
      sourceTravelVersion: manifest.travelModelVersion,
      importedAt,
      storageSchemaVersion: TRAVEL_DATABASE_VERSION,
      internalModelVersion: INTERNAL_TRAVEL_MODEL_VERSION,
    }
    const content: PersistedTravelContent = {
      travelId: travel.id,
      internalModelVersion: INTERNAL_TRAVEL_MODEL_VERSION,
      travel,
    }
    const manifestResources = new Map(
      manifest.resources.map((resource) => [resource.id, resource]),
    )
    const resources: PersistedTravelResource[] = []

    for (const resource of travelPackage.resources) {
      const declaration = manifestResources.get(resource.id)
      if (!declaration || declaration.path !== resource.path) {
        return failure(writeFailure(new Error('Resource metadata missing'), travel.id, 'resource'))
      }
      resources.push({
        travelId: travel.id,
        resourceId: resource.id,
        path: resource.path,
        mediaType: resource.mediaType,
        size: declaration.size,
        sha256: declaration.sha256,
        bytes: resource.bytes,
      })
    }

    let transaction: IDBTransaction
    try {
      transaction = this.database.transaction(
        [TRAVEL_STORES.metadata, TRAVEL_STORES.contents, TRAVEL_STORES.resources],
        'readwrite',
      )
    } catch {
      return failure(writeFailure(new Error('Transaction unavailable'), travel.id, 'metadata'))
    }

    const completion = transactionCompletion(transaction)
    let phase: 'metadata' | 'content' | 'resource' = 'metadata'

    try {
      await requestResult(
        transaction.objectStore(TRAVEL_STORES.metadata).add(metadata),
      )
      phase = 'content'
      await requestResult(
        transaction.objectStore(TRAVEL_STORES.contents).add(content),
      )
      phase = 'resource'
      const resourceStore = transaction.objectStore(TRAVEL_STORES.resources)
      for (const resource of resources) {
        await requestResult(resourceStore.add(resource))
      }
      await completion
      return success(metadata)
    } catch (error) {
      await abortAndWait(transaction, completion)
      return failure(writeFailure(error, travel.id, phase))
    }
  }

  async listTravels(): Promise<PersistenceResult<readonly TravelLibraryEntry[]>> {
    try {
      const transaction = this.database.transaction(TRAVEL_STORES.metadata, 'readonly')
      const completion = transactionCompletion(transaction)
      const entries = await requestResult<TravelLibraryEntry[]>(
        transaction.objectStore(TRAVEL_STORES.metadata).getAll(),
      )
      await completion
      entries.sort(
        (left, right) =>
          right.importedAt.localeCompare(left.importedAt) ||
          left.title.localeCompare(right.title, 'fr'),
      )
      return success(entries)
    } catch {
      return failure(readFailure())
    }
  }

  async getTravel(travelId: string): Promise<PersistenceResult<PersistedTravel>> {
    try {
      const transaction = this.database.transaction(
        [TRAVEL_STORES.metadata, TRAVEL_STORES.contents],
        'readonly',
      )
      const completion = transactionCompletion(transaction)
      const metadata = await requestResult<TravelLibraryEntry | undefined>(
        transaction.objectStore(TRAVEL_STORES.metadata).get(travelId),
      )
      const content = await requestResult<PersistedTravelContent | undefined>(
        transaction.objectStore(TRAVEL_STORES.contents).get(travelId),
      )
      await completion

      if (!metadata && !content) {
        return failure(
          persistenceIssue(
            'TRAVEL_NOT_FOUND',
            "Ce voyage n'existe pas dans la bibliothèque locale.",
            { travelId, hint: 'Actualisez la bibliothèque puis réessayez.' },
          ),
        )
      }
      if (!metadata || !content) {
        return failure(readFailure(travelId))
      }
      const travel = normalizeStoredTravel(content)
      return travel
        ? success({ metadata, travel })
        : failure(readFailure(travelId))
    } catch {
      return failure(readFailure(travelId))
    }
  }

  async getResource(
    travelId: string,
    resourceId: string,
  ): Promise<PersistenceResult<PersistedTravelResource>> {
    try {
      const transaction = this.database.transaction(TRAVEL_STORES.resources, 'readonly')
      const completion = transactionCompletion(transaction)
      const resource = await requestResult<PersistedTravelResource | undefined>(
        transaction
          .objectStore(TRAVEL_STORES.resources)
          .get([travelId, resourceId]),
      )
      await completion
      return resource
        ? success(resource)
        : failure(
            persistenceIssue(
              'RESOURCE_NOT_FOUND',
              "Cette ressource n'existe pas pour le voyage sélectionné.",
              {
                travelId,
                resourceId,
                hint: 'Vérifiez le voyage et la ressource demandés.',
              },
            ),
          )
    } catch {
      return failure(readFailure(travelId))
    }
  }

  async listResourceIds(
    travelId: string,
  ): Promise<PersistenceResult<readonly string[]>> {
    try {
      const transaction = this.database.transaction(TRAVEL_STORES.resources, 'readonly')
      const completion = transactionCompletion(transaction)
      const keys = await requestResult(
        transaction
          .objectStore(TRAVEL_STORES.resources)
          .index(TRAVEL_INDEXES.resourcesByTravel)
          .getAllKeys(IDBKeyRange.only(travelId)),
      )
      await completion
      return success(keys.flatMap((key) => (
        Array.isArray(key) && key[0] === travelId && typeof key[1] === 'string'
          ? [key[1]]
          : []
      )))
    } catch {
      return failure(readFailure(travelId))
    }
  }

  async getPersonalState(
    travelId: string,
  ): Promise<PersistenceResult<TravelPersonalState>> {
    try {
      const transaction = this.database.transaction(
        [
          TRAVEL_STORES.metadata,
          TRAVEL_STORES.contents,
          TRAVEL_STORES.personalStates,
        ],
        'readonly',
      )
      const completion = transactionCompletion(transaction)
      const metadata = await requestResult<TravelLibraryEntry | undefined>(
        transaction.objectStore(TRAVEL_STORES.metadata).get(travelId),
      )
      const records = await requestResult<PersistedPersonalState[]>(
        transaction.objectStore(TRAVEL_STORES.personalStates)
          .index(TRAVEL_INDEXES.personalStatesByTravel)
          .getAll(travelId),
      )
      const content = await requestResult<PersistedTravelContent | undefined>(
        transaction.objectStore(TRAVEL_STORES.contents).get(travelId),
      )
      await completion
      if (!metadata && !content) {
        return failure(persistenceIssue(
          'TRAVEL_NOT_FOUND',
          "Ce voyage n'existe pas dans la bibliothèque locale.",
          { travelId, hint: 'Actualisez la bibliothèque puis réessayez.' },
        ))
      }
      if (!metadata || !content) return failure(readFailure(travelId))

      const travel = normalizeStoredTravel(content)
      if (!travel) return failure(readFailure(travelId))

      const knownRecords = records.filter((record) =>
        record.namespace === PERSONAL_STATE_NAMESPACES.checklist
        || record.namespace === PERSONAL_STATE_NAMESPACES.notes)
      if (knownRecords.some((record) => !isChecklistState(record) && !isNoteState(record))) {
        return failure(readFailure(travelId))
      }
      const validChecklistKeys = new Set(
        travel.checklists.flatMap((checklist) => checklist.items.map((item) =>
          checklistItemStateKey(checklist.id, item.id),
        )),
      )
      if (knownRecords.filter(isChecklistState).some(
        (record) => !validChecklistKeys.has(record.key),
      )) {
        return failure(readFailure(travelId))
      }
      const checkedItemKeys = knownRecords
        .filter(isChecklistState)
        .filter((record) => record.value.checked)
        .map((record) => record.key)
        .sort()
      const note = knownRecords.find(isNoteState)?.value.text ?? ''
      return success({ checkedItemKeys, note })
    } catch {
      return failure(readFailure(travelId))
    }
  }

  async setChecklistItemChecked(
    travelId: string,
    checklistId: string,
    itemId: string,
    checked: boolean,
  ): Promise<PersistenceResult<void>> {
    const storedTravel = await this.getTravel(travelId)
    if (!storedTravel.ok) {
      return storedTravel.error.code === 'TRAVEL_NOT_FOUND'
        ? storedTravel
        : failure(personalWriteFailure(travelId))
    }
    const checklist = storedTravel.value.travel.checklists.find(
      (candidate) => candidate.id === checklistId,
    )
    if (!checklist?.items.some((item) => item.id === itemId)) {
      return failure(personalWriteFailure(travelId))
    }
    const record: PersistedChecklistItemState = {
      travelId,
      namespace: PERSONAL_STATE_NAMESPACES.checklist,
      key: checklistItemStateKey(checklistId, itemId),
      version: PERSONAL_STATE_RECORD_VERSION,
      value: { checked },
      updatedAt: this.now().toISOString(),
    }
    return this.writePersonalState(record)
  }

  async saveTravelNote(
    travelId: string,
    text: string,
  ): Promise<PersistenceResult<void>> {
    if (text.length > MAX_TRAVEL_NOTE_LENGTH) return failure(personalWriteFailure(travelId))
    const record: PersistedTravelNoteState = {
      travelId,
      namespace: PERSONAL_STATE_NAMESPACES.notes,
      key: GENERAL_NOTE_KEY,
      version: PERSONAL_STATE_RECORD_VERSION,
      value: { text },
      updatedAt: this.now().toISOString(),
    }
    return this.writePersonalState(record)
  }

  private async writePersonalState(
    state: PersistedChecklistItemState | PersistedTravelNoteState,
  ): Promise<PersistenceResult<void>> {
    let transaction: IDBTransaction
    try {
      transaction = this.database.transaction(
        [TRAVEL_STORES.metadata, TRAVEL_STORES.personalStates],
        'readwrite',
      )
    } catch {
      return failure(personalWriteFailure(state.travelId))
    }
    const completion = transactionCompletion(transaction)
    try {
      const metadata = await requestResult<TravelLibraryEntry | undefined>(
        transaction.objectStore(TRAVEL_STORES.metadata).get(state.travelId),
      )
      if (!metadata) {
        await abortAndWait(transaction, completion)
        return failure(persistenceIssue(
          'TRAVEL_NOT_FOUND',
          "Ce voyage n'existe pas dans la bibliothèque locale.",
          { travelId: state.travelId, hint: 'Actualisez la bibliothèque puis réessayez.' },
        ))
      }
      await requestResult(
        transaction.objectStore(TRAVEL_STORES.personalStates).put(state),
      )
      await completion
      return success(undefined)
    } catch {
      await abortAndWait(transaction, completion)
      return failure(personalWriteFailure(state.travelId))
    }
  }

  async deleteTravel(travelId: string): Promise<PersistenceResult<void>> {
    let transaction: IDBTransaction
    try {
      transaction = this.database.transaction(
        [
          TRAVEL_STORES.metadata,
          TRAVEL_STORES.contents,
          TRAVEL_STORES.resources,
          TRAVEL_STORES.personalStates,
        ],
        'readwrite',
      )
    } catch {
      return failure(
        persistenceIssue(
          'DELETE_FAILED',
          "Le voyage n'a pas pu être supprimé.",
          { travelId, hint: 'Réessayez après avoir rouvert l’application.' },
        ),
      )
    }

    const completion = transactionCompletion(transaction)
    try {
      const metadataStore = transaction.objectStore(TRAVEL_STORES.metadata)
      const metadata = await requestResult<TravelLibraryEntry | undefined>(
        metadataStore.get(travelId),
      )
      if (!metadata) {
        await abortAndWait(transaction, completion)
        return failure(
          persistenceIssue(
            'TRAVEL_NOT_FOUND',
            "Ce voyage n'existe pas dans la bibliothèque locale.",
            { travelId, hint: 'Actualisez la bibliothèque puis réessayez.' },
          ),
        )
      }

      const resourceStore = transaction.objectStore(TRAVEL_STORES.resources)
      const resourceKeys = await requestResult<IDBValidKey[]>(
        resourceStore.index(TRAVEL_INDEXES.resourcesByTravel).getAllKeys(travelId),
      )
      const personalStore = transaction.objectStore(TRAVEL_STORES.personalStates)
      const personalKeys = await requestResult<IDBValidKey[]>(
        personalStore
          .index(TRAVEL_INDEXES.personalStatesByTravel)
          .getAllKeys(travelId),
      )

      for (const key of resourceKeys) {
        await requestResult(resourceStore.delete(key))
      }
      for (const key of personalKeys) {
        await requestResult(personalStore.delete(key))
      }
      await requestResult(
        transaction.objectStore(TRAVEL_STORES.contents).delete(travelId),
      )
      await requestResult(metadataStore.delete(travelId))
      await completion
      return success(undefined)
    } catch {
      await abortAndWait(transaction, completion)
      return failure(
        persistenceIssue(
          'DELETE_FAILED',
          "Le voyage n'a pas pu être supprimé.",
          {
            travelId,
            hint: "Aucune suppression partielle n'a été validée. Réessayez.",
          },
        ),
      )
    }
  }

  close() {
    this.database.close()
  }
}

export async function openIndexedDbTravelRepository(
  options: IndexedDbTravelRepositoryOptions = {},
): Promise<PersistenceResult<TravelLibraryRepository>> {
  const factory =
    options.indexedDB === undefined ? globalThis.indexedDB : options.indexedDB
  if (!factory) {
    return failure(
      persistenceIssue(
        'INDEXED_DB_UNAVAILABLE',
        "Le stockage local IndexedDB n'est pas disponible.",
        {
          hint: 'Utilisez un navigateur compatible et autorisez le stockage local.',
        },
      ),
    )
  }

  const databaseResult = await openDatabase(
    factory,
    options.databaseName ?? TRAVEL_DATABASE_NAME,
  )
  return databaseResult.ok
    ? success(
        new IndexedDbTravelRepository(
          databaseResult.value,
          options.now ?? (() => new Date()),
        ),
      )
    : databaseResult
}

export function deleteTravelDatabase(
  databaseName: string,
  factory: IDBFactory = globalThis.indexedDB,
) {
  return new Promise<void>((resolve, reject) => {
    const request = factory.deleteDatabase(databaseName)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Database deletion blocked'))
  })
}

export type { PersistedPersonalState }
