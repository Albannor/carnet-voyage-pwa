/** Résultat d’une demande de stockage persistant. */
export type PersistentStorageStatus = 'persisted' | 'best-effort' | 'unsupported'

interface StorageManagerLike {
  persisted?(): Promise<boolean>
  persist?(): Promise<boolean>
}

interface StorageNavigator {
  readonly storage?: StorageManagerLike
}

export type RequestPersistentStorage = () => Promise<PersistentStorageStatus>

/**
 * Demande au navigateur de ne pas évincer IndexedDB sous pression de stockage
 * ou après une longue absence. Sans backend, les voyages et pièces ajoutées
 * n’existent que sur l’appareil. Renvoie `best-effort`, sans erreur ni journal,
 * lorsque le navigateur refuse ; `unsupported` lorsque l’API est absente.
 */
export async function requestPersistentStorage(
  navigatorLike: StorageNavigator | undefined = globalThis.navigator as StorageNavigator | undefined,
): Promise<PersistentStorageStatus> {
  const storage = navigatorLike?.storage
  if (typeof storage?.persist !== 'function') return 'unsupported'
  try {
    if (typeof storage.persisted === 'function' && await storage.persisted()) {
      return 'persisted'
    }
    return await storage.persist() ? 'persisted' : 'best-effort'
  } catch {
    return 'best-effort'
  }
}
