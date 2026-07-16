import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { importTravelPackageToLibrary } from '../application/importTravelPackageToLibrary'
import { systemClock, type Clock } from '../application/travelConsultation'
import type { ImportIssue } from '../import/errors'
import { isAllowedImageMediaType } from '../import/packageManifest'
import type { TravelDocument } from '../domain/voyage/model'
import { openIndexedDbTravelRepository } from '../persistence/indexedDbTravelRepository'
import type { PersistedTravel, TravelLibraryEntry, TravelPersonalState } from '../persistence/model'
import type {
  PersistenceIssue,
  TravelLibraryRepository,
  TravelRepositoryFactory,
} from '../persistence/repository'
import {
  TravelConsultation,
  type ContextActionFeedback,
  type IllustrationResourceLoadResult,
  type TravelView,
} from './travel/TravelConsultation'
import {
  browserTravelPlatformActions,
  type TravelPlatformActions,
} from '../services/travelActions'
import {
  readTravelLocation,
  writeTravelLocation,
} from './travel/navigation'

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
  clock?: Clock
  platformActions?: TravelPlatformActions
}

type ConsultationUiState =
  | { status: 'library' }
  | { status: 'loading' }
  | { status: 'ready'; persistedTravel: PersistedTravel; personalState: TravelPersonalState; view: TravelView }
  | { status: 'error'; error: PersistenceIssue }

export function App({
  repositoryFactory = openIndexedDbTravelRepository,
  clock = systemClock,
  platformActions = browserTravelPlatformActions,
}: AppProps) {
  const repositoryRef = useRef<TravelLibraryRepository | null>(null)
  const [libraryState, setLibraryState] = useState<LibraryUiState>({
    status: 'loading',
  })
  const [importState, setImportState] = useState<ImportUiState>({ status: 'idle' })
  const [actionState, setActionState] = useState<ActionUiState>({ status: 'idle' })
  const [consultationState, setConsultationState] = useState<ConsultationUiState>({
    status: 'library',
  })
  const [contextActionFeedback, setContextActionFeedback] = useState<ContextActionFeedback>()
  const [online, setOnline] = useState(() => navigator.onLine)

  async function refreshLibrary(repository: TravelLibraryRepository) {
    const listed = await repository.listTravels()
    setLibraryState(
      listed.ok
        ? { status: 'ready', entries: listed.value }
        : { status: 'error', error: listed.error },
    )
  }

  const loadTravel = useCallback(async (
    repository: TravelLibraryRepository,
    travelId: string,
    view: TravelView,
  ) => {
    setConsultationState({ status: 'loading' })
    const [result, personalState] = await Promise.all([
      repository.getTravel(travelId),
      repository.getPersonalState(travelId),
    ])
    setConsultationState(
      !result.ok
        ? { status: 'error', error: result.error }
        : !personalState.ok
          ? { status: 'error', error: personalState.error }
          : { status: 'ready', persistedTravel: result.value, personalState: personalState.value, view },
    )
  }, [])

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

      const location = readTravelLocation(window.location.search)
      if (location) {
        await loadTravel(opened.value, location.travelId, location.view)
      }
    }

    function handleHistoryChange() {
      const repository = repositoryRef.current
      const location = readTravelLocation(window.location.search)
      if (!location) {
        setConsultationState({ status: 'library' })
      } else if (repository) {
        void loadTravel(repository, location.travelId, location.view)
      }
    }

    void initializeLibrary()
    window.addEventListener('popstate', handleHistoryChange)
    return () => {
      disposed = true
      window.removeEventListener('popstate', handleHistoryChange)
      repositoryRef.current?.close()
      repositoryRef.current = null
    }
  }, [loadTravel, repositoryFactory])

  useEffect(() => {
    const updateNetworkState = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateNetworkState)
    window.addEventListener('offline', updateNetworkState)
    return () => {
      window.removeEventListener('online', updateNetworkState)
      window.removeEventListener('offline', updateNetworkState)
    }
  }, [])

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
    const view: TravelView = { kind: 'summary' }
    writeTravelLocation({ travelId, view })
    await loadTravel(repository, travelId, view)
  }

  function navigateTravel(view: TravelView) {
    if (consultationState.status !== 'ready') return
    writeTravelLocation({
      travelId: consultationState.persistedTravel.travel.id,
      view,
    })
    setConsultationState({ ...consultationState, view })
  }

  function backToLibrary() {
    writeTravelLocation(undefined)
    setConsultationState({ status: 'library' })
    setActionState({ status: 'idle' })
    setContextActionFeedback(undefined)
  }

  async function copyAddress(address: string, placeLabel: string) {
    const copied = await platformActions.copyText(address)
    setContextActionFeedback(copied
      ? { status: 'success', message: `Adresse de ${placeLabel} copiée.` }
      : { status: 'error', message: 'La copie de l’adresse n’est pas disponible sur cet appareil.' })
  }

  async function openDocument(document: TravelDocument) {
    if (consultationState.status !== 'ready') return
    const repository = repositoryRef.current
    if (!repository) return
    const loaded = await repository.getResource(
      consultationState.persistedTravel.travel.id,
      document.resourceId,
    )
    if (!loaded.ok) {
      setContextActionFeedback({ status: 'error', message: loaded.error.message })
      return
    }
    const opened = platformActions.openLocalPdf(loaded.value, document.label)
    setContextActionFeedback(opened
      ? { status: 'success', message: `Ouverture du document local « ${document.label} ».` }
      : { status: 'error', message: 'Ce document local ne peut pas être ouvert en sécurité.' })
  }

  const loadIllustrationResource = useCallback(async (
    travelId: string,
    resourceId: string,
  ): Promise<IllustrationResourceLoadResult> => {
    const repository = repositoryRef.current
    if (!repository) {
      return { ok: false, message: 'La bibliothèque locale n’est pas disponible.' }
    }
    const loaded = await repository.getResource(travelId, resourceId)
    if (!loaded.ok) return { ok: false, message: loaded.error.message }
    if (!isAllowedImageMediaType(loaded.value.mediaType)) {
      return {
        ok: false,
        message: 'Cette ressource locale n’est pas une image passive autorisée.',
      }
    }
    return { ok: true, resource: loaded.value }
  }, [])

  async function setChecklistItemChecked(
    checklistId: string,
    itemId: string,
    checked: boolean,
  ) {
    if (consultationState.status !== 'ready' || !repositoryRef.current) {
      return { ok: false as const, message: 'La bibliothèque locale n’est pas disponible.' }
    }
    const result = await repositoryRef.current.setChecklistItemChecked(
      consultationState.persistedTravel.travel.id,
      checklistId,
      itemId,
      checked,
    )
    return result.ok
      ? { ok: true as const }
      : { ok: false as const, message: result.error.message }
  }

  async function saveTravelNote(text: string) {
    if (consultationState.status !== 'ready' || !repositoryRef.current) {
      return { ok: false as const, message: 'La bibliothèque locale n’est pas disponible.' }
    }
    const result = await repositoryRef.current.saveTravelNote(
      consultationState.persistedTravel.travel.id,
      text,
    )
    return result.ok
      ? { ok: true as const }
      : { ok: false as const, message: result.error.message }
  }

  async function deleteTravel(entry: TravelLibraryEntry) {
    const confirmed = window.confirm(
      `Supprimer « ${entry.title} » ? Le voyage, ses ressources, ses notes personnelles et ses états de checklist seront supprimés de cet appareil.`,
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
        {consultationState.status === 'loading' && (
          <section className="foundation consultation-state" aria-live="polite">
            <p role="status">Chargement du voyage…</p>
          </section>
        )}
        {consultationState.status === 'error' && (
          <section className="foundation consultation-state" aria-labelledby="travel-error-title">
            <p className="section-label">Voyage indisponible</p>
            <h2 id="travel-error-title">Impossible d’ouvrir ce voyage</h2>
            <p className="action-message action-error" role="alert">
              <strong>{consultationState.error.message}</strong>{' '}
              {consultationState.error.hint}
            </p>
            <button className="secondary-button" type="button" onClick={backToLibrary}>
              Retour à la bibliothèque
            </button>
          </section>
        )}
        {consultationState.status === 'ready' && (
          <TravelConsultation
            key={consultationState.persistedTravel.travel.id}
            persistedTravel={consultationState.persistedTravel}
            view={consultationState.view}
            clock={clock}
            online={online}
            actionFeedback={contextActionFeedback}
            personalState={consultationState.personalState}
            onNavigate={navigateTravel}
            onBackToLibrary={backToLibrary}
            onCopyAddress={(address, label) => void copyAddress(address, label)}
            onOpenDocument={(document) => void openDocument(document)}
            onLoadIllustrationResource={loadIllustrationResource}
            onSetChecklistItemChecked={setChecklistItemChecked}
            onSaveNote={saveTravelNote}
          />
        )}
        {consultationState.status === 'library' && (
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
