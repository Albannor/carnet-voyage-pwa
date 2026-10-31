import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { importTravelPackageToLibrary } from '../application/importTravelPackageToLibrary'
import {
  loadTravelCover,
  type TravelCoverLoadResult,
} from '../application/loadTravelCover'
import { systemClock, type Clock } from '../application/travelConsultation'
import { isAllowedImageMediaType } from '../import/packageManifest'
import type { TravelDocument } from '../domain/voyage/model'
import { openIndexedDbTravelRepository } from '../persistence/indexedDbTravelRepository'
import type {
  NewUserPiece,
  PersistedTravel,
  TravelLibraryEntry,
  TravelPersonalState,
  UserPieceMetadata,
} from '../persistence/model'
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
  type UserPieceFileLoadResult,
  type UserPieceSaveResult,
} from './travel/TravelConsultation'
import {
  browserTravelPlatformActions,
  type TravelPlatformActions,
} from '../services/travelActions'
import {
  readTravelLocation,
  writeTravelLocation,
} from './travel/navigation'
import {
  LibraryView,
  TrustRow,
  type ActionUiState,
  type ImportUiState,
  type LibraryUiState,
} from './library/LibraryView'
import { localIsoDate } from './library/libraryArrangement'
import {
  browserConnectivity,
  type ConnectivityAdapter,
} from '../services/connectivity'
import {
  browserPwaLifecycle,
} from '../services/browserPwa'
import type { PwaLifecycleController } from '../services/pwaLifecycle'
import { PwaStatusPanel } from './system/PwaStatusPanel'
import { AppHeader } from './system/AppHeader'

interface AppProps {
  repositoryFactory?: TravelRepositoryFactory
  clock?: Clock
  platformActions?: TravelPlatformActions
  connectivity?: ConnectivityAdapter
  pwaLifecycle?: PwaLifecycleController
}

type ConsultationUiState =
  | { status: 'library' }
  | { status: 'loading' }
  | {
      status: 'ready'
      persistedTravel: PersistedTravel
      personalState: TravelPersonalState
      userPieces: readonly UserPieceMetadata[]
      view: TravelView
    }
  | { status: 'error'; error: PersistenceIssue }

export function App({
  repositoryFactory = openIndexedDbTravelRepository,
  clock = systemClock,
  platformActions = browserTravelPlatformActions,
  connectivity = browserConnectivity,
  pwaLifecycle = browserPwaLifecycle,
}: AppProps) {
  const repositoryRef = useRef<TravelLibraryRepository | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [libraryState, setLibraryState] = useState<LibraryUiState>({
    status: 'loading',
  })
  const [importState, setImportState] = useState<ImportUiState>({ status: 'idle' })
  const [actionState, setActionState] = useState<ActionUiState>({ status: 'idle' })
  const [consultationState, setConsultationState] = useState<ConsultationUiState>({
    status: 'library',
  })
  const [contextActionFeedback, setContextActionFeedback] = useState<ContextActionFeedback>()
  const [online, setOnline] = useState(() => connectivity.isOnline())
  const [pwaState, setPwaState] = useState(() => pwaLifecycle.getState())

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
    const [result, personalState, userPieces] = await Promise.all([
      repository.getTravel(travelId),
      repository.getPersonalState(travelId),
      repository.listUserPieces(travelId),
    ])
    setConsultationState(
      !result.ok
        ? { status: 'error', error: result.error }
        : !personalState.ok
          ? { status: 'error', error: personalState.error }
          : !userPieces.ok
            ? { status: 'error', error: userPieces.error }
            : {
                status: 'ready',
                persistedTravel: result.value,
                personalState: personalState.value,
                userPieces: userPieces.value,
                view,
              },
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

  useEffect(
    () => connectivity.subscribe(setOnline),
    [connectivity],
  )

  useEffect(
    () => pwaLifecycle.subscribe(setPwaState),
    [pwaLifecycle],
  )

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
              title: `« ${file.name} » n’est pas un voyage importable`,
              errors: result.result.errors,
            }
          : {
              status: 'error',
              fileName: file.name,
              title: `Le voyage de « ${file.name} » n’a pas pu être enregistré`,
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

  /** Le bouton de copie affiche lui-même le résultat, à côté de l’action. */
  function copyAddress(address: string) {
    return platformActions.copyText(address)
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
        message: 'Cette image n’est pas dans un format autorisé.',
      }
    }
    return { ok: true, resource: loaded.value }
  }, [])

  const listLocalResourceIds = useCallback(async (travelId: string) => {
    const listed = await repositoryRef.current?.listResourceIds(travelId)
    return listed?.ok ? listed.value : undefined
  }, [])

  /** Met à jour la liste des pièces ajoutées du voyage affiché, sans autre effet. */
  function updateUserPieces(
    travelId: string,
    update: (pieces: readonly UserPieceMetadata[]) => readonly UserPieceMetadata[],
  ) {
    setConsultationState((current) => (
      current.status === 'ready' && current.persistedTravel.travel.id === travelId
        ? { ...current, userPieces: update(current.userPieces) }
        : current
    ))
  }

  async function addUserPiece(piece: NewUserPiece): Promise<UserPieceSaveResult> {
    const repository = repositoryRef.current
    if (consultationState.status !== 'ready' || !repository) {
      return { ok: false, message: 'La bibliothèque locale n’est pas disponible.' }
    }
    const travelId = consultationState.persistedTravel.travel.id
    const added = await repository.addUserPiece(travelId, piece)
    if (!added.ok) return { ok: false, message: `${added.error.message} ${added.error.hint}` }
    updateUserPieces(travelId, (pieces) => [...pieces, added.value])
    return { ok: true, piece: added.value }
  }

  async function renameUserPiece(pieceId: string, title: string) {
    const repository = repositoryRef.current
    if (consultationState.status !== 'ready' || !repository) {
      return { ok: false as const, message: 'La bibliothèque locale n’est pas disponible.' }
    }
    const travelId = consultationState.persistedTravel.travel.id
    const renamed = await repository.renameUserPiece(travelId, pieceId, title)
    if (!renamed.ok) return { ok: false as const, message: renamed.error.message }
    updateUserPieces(travelId, (pieces) => pieces.map((piece) => (
      piece.pieceId === pieceId ? renamed.value : piece
    )))
    return { ok: true as const }
  }

  async function deleteUserPiece(pieceId: string) {
    const repository = repositoryRef.current
    if (consultationState.status !== 'ready' || !repository) {
      return { ok: false as const, message: 'La bibliothèque locale n’est pas disponible.' }
    }
    const travelId = consultationState.persistedTravel.travel.id
    const title = consultationState.userPieces.find((piece) => piece.pieceId === pieceId)?.title
    const deleted = await repository.deleteUserPiece(travelId, pieceId)
    if (!deleted.ok) return { ok: false as const, message: deleted.error.message }
    updateUserPieces(travelId, (pieces) => pieces.filter((piece) => piece.pieceId !== pieceId))
    setContextActionFeedback({
      status: 'success',
      message: title ? `« ${title} » a été supprimée de cet appareil.` : 'La pièce a été supprimée.',
    })
    return { ok: true as const }
  }

  async function openUserPiece(piece: UserPieceMetadata) {
    const repository = repositoryRef.current
    if (!repository) return
    const loaded = await repository.getUserPieceFile(piece.travelId, piece.pieceId)
    if (!loaded.ok) {
      setContextActionFeedback({ status: 'error', message: loaded.error.message })
      return
    }
    const opened = platformActions.openLocalPdf(loaded.value, piece.title)
    setContextActionFeedback(opened
      ? { status: 'success', message: `Ouverture du document local « ${piece.title} ».` }
      : { status: 'error', message: 'Ce document local ne peut pas être ouvert en sécurité.' })
  }

  const loadUserPieceFile = useCallback(async (
    travelId: string,
    pieceId: string,
  ): Promise<UserPieceFileLoadResult> => {
    const repository = repositoryRef.current
    if (!repository) {
      return { ok: false, message: 'La bibliothèque locale n’est pas disponible.' }
    }
    const loaded = await repository.getUserPieceFile(travelId, pieceId)
    return loaded.ok
      ? { ok: true, file: loaded.value }
      : { ok: false, message: loaded.error.message }
  }, [])

  const loadLibraryCover = useCallback(async (
    travelId: string,
  ): Promise<TravelCoverLoadResult> => {
    const repository = repositoryRef.current
    return repository
      ? loadTravelCover(repository, travelId)
      : {
          status: 'error',
          message: 'La bibliothèque locale n’est pas disponible.',
        }
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

  /** La confirmation explicite est demandée par la carte du voyage. */
  async function deleteTravel(entry: TravelLibraryEntry) {
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

  const inLibrary = consultationState.status === 'library'

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenu-principal">
        Aller au contenu
      </a>

      {consultationState.status !== 'ready' && (
        <AppHeader />
      )}

      <main
        id="contenu-principal"
        className={consultationState.status === 'ready' ? 'main-travel' : undefined}
        tabIndex={-1}
      >
        <PwaStatusPanel
          online={online}
          pwaStatus={pwaState.status}
          onDismissPwaStatus={() => pwaLifecycle.dismiss()}
          onApplyUpdate={() => void pwaLifecycle.applyUpdate()}
        />
        {consultationState.status === 'loading' && (
          <section className="foundation consultation-state" aria-live="polite">
            <p role="status">Chargement du voyage…</p>
          </section>
        )}
        {consultationState.status === 'error' && (
          <section className="foundation consultation-state" aria-labelledby="travel-error-title">
            <p className="section-label">Voyage indisponible</p>
            <h2 id="travel-error-title">Impossible d’ouvrir ce voyage</h2>
            <p className="notice notice-error" role="alert">
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
            onCopyAddress={copyAddress}
            onOpenDocument={(document) => void openDocument(document)}
            onLoadIllustrationResource={loadIllustrationResource}
            onListLocalResourceIds={listLocalResourceIds}
            onSetChecklistItemChecked={setChecklistItemChecked}
            onSaveNote={saveTravelNote}
            userPieces={consultationState.userPieces}
            onAddUserPiece={addUserPiece}
            onRenameUserPiece={renameUserPiece}
            onDeleteUserPiece={deleteUserPiece}
            onOpenUserPiece={(piece) => void openUserPiece(piece)}
            onLoadUserPieceFile={loadUserPieceFile}
          />
        )}
        {inLibrary && (
          <LibraryView
            libraryState={libraryState}
            importState={importState}
            actionState={actionState}
            today={localIsoDate(clock.now())}
            fileInputRef={fileInputRef}
            onFileSelection={(event) => void handleFileSelection(event)}
            onOpen={(travelId) => void openTravel(travelId)}
            onDelete={(travel) => void deleteTravel(travel)}
            onLoadCover={loadLibraryCover}
          />
        )}
      </main>

      {inLibrary && (
        <footer className="app-footer">
          <TrustRow />
        </footer>
      )}
    </div>
  )
}
