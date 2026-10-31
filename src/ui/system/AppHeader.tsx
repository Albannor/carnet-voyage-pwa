import type { PwaLifecycleStatus } from '../../services/pwaLifecycle'
import { OfflineIcon, OfflineReadyIcon, PlusIcon, UpdateIcon } from '../icons'

const logoSource = `${import.meta.env.BASE_URL}icons/carnet.svg`

interface StatusBadgeProps {
  readonly online: boolean
  readonly pwaStatus: PwaLifecycleStatus
}

/** État de disponibilité, toujours exprimé par une icône et un texte. */
export function StatusBadge({ online, pwaStatus }: StatusBadgeProps) {
  if (!online) {
    return (
      <span className="status-pill status-pill-neutral">
        <OfflineIcon size={15} />
        Hors connexion
      </span>
    )
  }
  if (pwaStatus === 'update-available') {
    return (
      <span className="status-pill status-pill-warning">
        <UpdateIcon size={15} />
        Mise à jour disponible
      </span>
    )
  }
  if (pwaStatus === 'registration-error') return null
  return (
    <span className="status-pill status-pill-sage">
      <OfflineReadyIcon size={15} />
      Disponible hors connexion
    </span>
  )
}

interface AppHeaderProps extends StatusBadgeProps {
  /** Absent lorsque l’import n’est pas proposé dans la vue courante. */
  readonly onImport?: () => void
  readonly importDisabled?: boolean
}

export function AppHeader({
  online,
  pwaStatus,
  onImport,
  importDisabled = false,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-bar">
        <div className="brand">
          <img className="brand-logo" src={logoSource} alt="" width={36} height={36} />
          <h1 className="brand-name">Carnet de voyage</h1>
        </div>
        {onImport && (
          <button
            className="round-button round-button-solid"
            type="button"
            aria-label="Importer un voyage"
            disabled={importDisabled}
            onClick={onImport}
          >
            <PlusIcon size={22} />
          </button>
        )}
      </div>
      <div className="app-header-status">
        <StatusBadge online={online} pwaStatus={pwaStatus} />
      </div>
    </header>
  )
}
