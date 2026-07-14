import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { importTravelPackageToLibrary } from '../application/importTravelPackageToLibrary'
import type { ImportIssue } from '../import/errors'
import { openIndexedDbTravelRepository } from '../persistence/indexedDbTravelRepository'
import type { PersistedTravel, TravelLibraryEntry } from '../persistence/model'
import type {
  PersistenceIssue,
  TravelLibraryRepository,
  TravelRepositoryFactory,
} from '../persistence/repository'

const principles = [
  {
    title: 'Local',
    description: 'Les voyages sont enregistrés sur votre appareil.',
  },
  {
    title: 'Disponible',
    description: 'Le contenu importé reste distinct de vos futurs états personnels.',
  },
  {
    title: 'Isolé',
    description: 'Chaque voyage et ses ressources possèdent leur propre périmètre.',
  },
]

type ImportUiState =
  | { status: 'idle' }
  | { status: 'processing'; fileName: string }
  | { status: 'success'; fileName: string; entry: TravelLibraryEntry }
  | {
      status: 'error'
      fileName: string
      title: string
      errors: readonly (ImportIssue | PersistenceIssue)[]
    }

type LibraryUiState =
  | { status: 'loading' }
  | { status: 'ready'; entries: readonly TravelLibraryEntry[] }
  | { status: 'error'; error: PersistenceIssue }

type ActionUiState =
  | { status: 'idle' }
  | { status: 'processing'; message: string }
  | { status: 'success'; message: string }
  | { status: 'error'; error: PersistenceIssue }

function issueContext(error: ImportIssue | PersistenceIssue) {
  if ('kind' in error) {
    return [error.file, error.field].filter(Boolean).join(' · ')
  }
  return [error.travelId, error.resourceId].filter(Boolean).join(' · ')
}

interface AppProps {
  repositoryFactory?: TravelRepositoryFactory
}

export function App({
  repositoryFactory = openIndexedDbTravelRepository,
}: AppProps) {
  const repositoryRef = useRef<TravelLibraryRepository | null>(null)
  const [libraryState, setLibraryState] = useState<LibraryUiState>({
    status: 'loading',
  })
  const [importState, setImportState] = useState<ImportUiState>({ status: 'idle' })
  const [actionState, setActionState] = useState<ActionUiState>({ status: 'idle' })
  const [selectedTravel, setSelectedTravel] = useState<PersistedTravel>()

  async function refreshLibrary(repository: TravelLibraryRepository) {
    const listed = await repository.listTravels()
    setLibraryState(
      listed.ok
        ? { status: 'ready', entries: listed.value }
        : { status: 'error', error: listed.error },
    )
  }

  useEffect(() => {
    let disposed = false

    async function initializeLibrary() {
      const opened = await repositoryFactory()
      if (disposed) {
        if (opened.ok) opened.value.close()
        return
      }
      if (!opened.ok) {
        setLibraryState({ status: 'error', error: opened.error })
        return
      }

      repositoryRef.current = opened.value
      const listed = await opened.value.listTravels()
      if (disposed) return
      setLibraryState(
        listed.ok
          ? { status: 'ready', entries: listed.value }
          : { status: 'error', error: listed.error },
      )
    }

    void initializeLibrary()
    return () => {
      disposed = true
      repositoryRef.current?.close()
      repositoryRef.current = null
    }
  }, [repositoryFactory])

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    const repository = repositoryRef.current
    if (!repository) {
      setImportState({
        status: 'error',
        fileName: file.name,
        title: 'Enregistrement indisponible',
        errors: [
          {
            code: 'INDEXED_DB_UNAVAILABLE',
            message: "La bibliothèque locale n'est pas disponible.",
            hint: 'Attendez son chargement ou rouvrez l’application.',
          },
        ],
      })
      return
    }

    setImportState({ status: 'processing', fileName: file.name })
    const result = await importTravelPackageToLibrary(file, repository)
    if (!result.ok) {
      setImportState(
        result.source === 'import'
          ? {
              status: 'error',
              fileName: file.name,
              title: `Le paquet « ${file.name} » n’est pas valide`,
              errors: result.result.errors,
            }
          : {
              status: 'error',
              fileName: file.name,
              title: `Le voyage de « ${file.name} » n’a pas été enregistré`,
              errors: [result.error],
            },
      )
      return
    }

    setImportState({
      status: 'success',
      fileName: file.name,
      entry: result.entry,
    })
    await refreshLibrary(repository)
  }

  async function openTravel(travelId: string) {
    const repository = repositoryRef.current
    if (!repository) return
    setActionState({ status: 'processing', message: 'Ouverture du voyage…' })
    const result = await repository.getTravel(travelId)
    if (result.ok) {
      setSelectedTravel(result.value)
      setActionState({ status: 'idle' })
    } else {
      setActionState({ status: 'error', error: result.error })
    }
  }

  async function deleteTravel(entry: TravelLibraryEntry) {
    const confirmed = window.confirm(
      `Supprimer « ${entry.title} » ? Le voyage, ses ressources et ses futurs états personnels seront supprimés de cet appareil.`,
    )
    if (!confirmed) return

    const repository = repositoryRef.current
    if (!repository) return
    setActionState({ status: 'processing', message: `Suppression de « ${entry.title} »…` })
    const deleted = await repository.deleteTravel(entry.travelId)
    if (!deleted.ok) {
      setActionState({ status: 'error', error: deleted.error })
      return
    }

    setActionState({ status: 'success', message: `« ${entry.title} » a été supprimé.` })
    await refreshLibrary(repository)
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenu-principal">
        Aller au contenu
      </a>

      <header className="hero">
        <div className="brand-mark" aria-hidden="true">
          CV
        </div>
        <p className="eyebrow">Votre bibliothèque personnelle</p>
        <h1>Carnet de voyage</h1>
        <p className="intro">
          Conservez plusieurs voyages validés et retrouvez leurs informations
          essentielles directement sur cet appareil.
        </p>
      </header>

      <main id="contenu-principal" tabIndex={-1}>
        {selectedTravel ? (
          <section className="foundation travel-preview" aria-labelledby="preview-title">
            <button
              className="secondary-button back-button"
              type="button"
              onClick={() => {
                setSelectedTravel(undefined)
                setActionState({ status: 'idle' })
              }}
            >
              Retour à la bibliothèque
            </button>
            <p className="section-label">Aperçu local</p>
            <h2 id="preview-title">{selectedTravel.travel.title}</h2>
            <p className="preview-destination">
              {selectedTravel.travel.destination.label} ·{' '}
              <time dateTime={selectedTravel.travel.period.start}>
                {selectedTravel.travel.period.start}
              </time>{' '}
              au{' '}
              <time dateTime={selectedTravel.travel.period.end}>
                {selectedTravel.travel.period.end}
              </time>
            </p>
            <p className="foundation-copy">{selectedTravel.travel.summary}</p>
            <p className="result-note">
              Cet aperçu confirme le voyage retrouvé. La consultation détaillée
              sera ajoutée à l’étape 5.
            </p>
          </section>
        ) : (
          <section className="foundation" aria-labelledby="library-title">
            <p className="section-label">Stockage local</p>
            <h2 id="library-title">Ma bibliothèque</h2>
            <p className="foundation-copy">
              Les voyages entièrement validés sont enregistrés dans IndexedDB avec
              leurs ressources passives. Chaque voyage reste isolé des autres.
            </p>

            {actionState.status === 'processing' && (
              <p className="action-message" role="status" aria-live="polite">
                {actionState.message}
              </p>
            )}
            {actionState.status === 'success' && (
              <p className="action-message action-success" role="status">
                {actionState.message}
              </p>
            )}
            {actionState.status === 'error' && (
              <p className="action-message action-error" role="alert">
                <strong>{actionState.error.message}</strong>{' '}
                {actionState.error.hint}
              </p>
            )}

            <section className="library-panel" aria-labelledby="saved-travels-title">
              <h3 id="saved-travels-title">Voyages enregistrés</h3>
              {libraryState.status === 'loading' && (
                <p role="status" aria-live="polite">
                  Chargement de la bibliothèque…
                </p>
              )}
              {libraryState.status === 'error' && (
                <div className="library-error" role="alert">
                  <strong>{libraryState.error.message}</strong>
                  <span>{libraryState.error.hint}</span>
                </div>
              )}
              {libraryState.status === 'ready' && libraryState.entries.length === 0 && (
                <p className="empty-library">
                  Aucun voyage enregistré. Importez un paquet ZIP validé pour
                  commencer votre bibliothèque locale.
                </p>
              )}
              {libraryState.status === 'ready' && libraryState.entries.length > 0 && (
                <ul className="travel-list">
                  {libraryState.entries.map((entry) => (
                    <li className="travel-card" key={entry.travelId}>
                      <div>
                        <h4>{entry.title}</h4>
                        <p>{entry.destination}</p>
                        <p className="travel-dates">
                          <time dateTime={entry.startDate}>{entry.startDate}</time> au{' '}
                          <time dateTime={entry.endDate}>{entry.endDate}</time>
                        </p>
                      </div>
                      <div className="travel-actions">
                        <button
                          className="primary-button"
                          type="button"
                          onClick={() => void openTravel(entry.travelId)}
                        >
                          Ouvrir {entry.title}
                        </button>
                        <button
                          className="danger-button"
                          type="button"
                          onClick={() => void deleteTravel(entry)}
                        >
                          Supprimer {entry.title}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="import-panel" aria-labelledby="import-title">
              <div>
                <h3 id="import-title">Importer un voyage</h3>
                <p id="package-format-help" className="format-help">
                  Format accepté : archive ZIP de 25 Mio maximum contenant
                  manifest.json et voyage.json. Un identifiant déjà présent est
                  refusé sans écrasement.
                </p>
              </div>

              <label className="file-picker" htmlFor="travel-package">
                Choisir un fichier ZIP
              </label>
              <input
                id="travel-package"
                className="file-input"
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                aria-describedby="package-format-help"
                disabled={
                  importState.status === 'processing' ||
                  libraryState.status !== 'ready'
                }
                onChange={(event) => void handleFileSelection(event)}
              />

              {importState.status === 'processing' && (
                <p className="import-status" role="status" aria-live="polite">
                  Validation et enregistrement de « {importState.fileName} » en
                  cours…
                </p>
              )}

              {importState.status === 'success' && (
                <section
                  className="import-result import-success"
                  aria-labelledby="import-success-title"
                  role="status"
                >
                  <p className="result-label">Voyage enregistré</p>
                  <h3 id="import-success-title">{importState.entry.title}</h3>
                  <p>
                    {importState.entry.destination} · {importState.entry.startDate}{' '}
                    au {importState.entry.endDate}
                  </p>
                  <p className="result-note">
                    La transaction locale est terminée et le voyage apparaît dans
                    la bibliothèque.
                  </p>
                </section>
              )}

              {importState.status === 'error' && (
                <section
                  className="import-result import-errors"
                  aria-labelledby="import-error-title"
                  role="alert"
                >
                  <p className="result-label">Import non enregistré</p>
                  <h3 id="import-error-title">{importState.title}</h3>
                  <ul>
                    {importState.errors.map((error, index) => {
                      const context = issueContext(error)
                      return (
                        <li key={`${error.code}-${context}-${index}`}>
                          <strong>{error.message}</strong>
                          {context && <span>{context}</span>}
                          <span>{error.hint}</span>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}
            </section>

            <ul className="principles" aria-label="Principes du carnet">
              {principles.map((principle) => (
                <li key={principle.title}>
                  <strong>{principle.title}</strong>
                  <span>{principle.description}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer>
        <p>Aucun compte requis. Vos voyages restent sous votre contrôle.</p>
      </footer>
    </div>
  )
}
