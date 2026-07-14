import type { SelectedPackageFile } from '../import/importTravelPackage'
import {
  importTravelPackage,
  type TravelPackageImportResult,
} from '../import/importTravelPackage'
import type { TravelLibraryEntry } from '../persistence/model'
import type {
  PersistenceIssue,
  TravelLibraryRepository,
} from '../persistence/repository'

export type ImportTravelPackageToLibraryResult =
  | { readonly ok: true; readonly entry: TravelLibraryEntry }
  | {
      readonly ok: false
      readonly source: 'import'
      readonly result: Extract<TravelPackageImportResult, { ok: false }>
    }
  | {
      readonly ok: false
      readonly source: 'persistence'
      readonly error: PersistenceIssue
    }

/**
 * Orchestre la frontière de confiance : aucune écriture n'est tentée tant que
 * l'import n'a pas produit un paquet entièrement validé et normalisé.
 */
export async function importTravelPackageToLibrary(
  selectedFile: SelectedPackageFile,
  repository: TravelLibraryRepository,
): Promise<ImportTravelPackageToLibraryResult> {
  const imported = await importTravelPackage(selectedFile)
  if (!imported.ok) {
    return { ok: false, source: 'import', result: imported }
  }

  const persisted = await repository.importPackage(imported.package)
  return persisted.ok
    ? { ok: true, entry: persisted.value }
    : { ok: false, source: 'persistence', error: persisted.error }
}
