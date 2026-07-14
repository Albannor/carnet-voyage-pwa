import type { ValidatedTravelPackage } from '../import/importTravelPackage'
import type {
  PersistedTravel,
  PersistedTravelResource,
  TravelLibraryEntry,
} from './model'

export type PersistenceErrorCode =
  | 'INDEXED_DB_UNAVAILABLE'
  | 'DATABASE_OPEN_FAILED'
  | 'DATABASE_VERSION_INCOMPATIBLE'
  | 'TRANSACTION_ABORTED'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'TRAVEL_ALREADY_EXISTS'
  | 'TRAVEL_NOT_FOUND'
  | 'RESOURCE_NOT_FOUND'
  | 'DELETE_FAILED'
  | 'READ_FAILED'
  | 'WRITE_FAILED'

export interface PersistenceIssue {
  readonly code: PersistenceErrorCode
  readonly message: string
  readonly hint: string
  readonly travelId?: string
  readonly resourceId?: string
}

export type PersistenceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: PersistenceIssue }

export interface TravelLibraryRepository {
  importPackage(
    travelPackage: ValidatedTravelPackage,
  ): Promise<PersistenceResult<TravelLibraryEntry>>
  listTravels(): Promise<PersistenceResult<readonly TravelLibraryEntry[]>>
  getTravel(travelId: string): Promise<PersistenceResult<PersistedTravel>>
  getResource(
    travelId: string,
    resourceId: string,
  ): Promise<PersistenceResult<PersistedTravelResource>>
  deleteTravel(travelId: string): Promise<PersistenceResult<void>>
  close(): void
}

export type TravelRepositoryFactory = () => Promise<
  PersistenceResult<TravelLibraryRepository>
>

export function persistenceIssue(
  code: PersistenceErrorCode,
  message: string,
  context: Omit<PersistenceIssue, 'code' | 'message'>,
): PersistenceIssue {
  return { code, message, ...context }
}
