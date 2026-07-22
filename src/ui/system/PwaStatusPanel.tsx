import type { PwaLifecycleStatus } from '../../services/pwaLifecycle'

interface PwaStatusPanelProps {
  online: boolean
  pwaStatus: PwaLifecycleStatus
  onDismissPwaStatus: () => void
  onApplyUpdate: () => void
}

export function PwaStatusPanel({
  online,
  pwaStatus,
  onDismissPwaStatus,
  onApplyUpdate,
}: PwaStatusPanelProps) {
  if (online && pwaStatus === 'idle') {
    return null
  }

  return (
    <aside className="system-status" aria-label="État de l’application">
      {!online ? (
        <p className="system-status__notice" role="status">
          <strong>Hors connexion.</strong> Le carnet et les contenus enregistrés
          restent consultables. Les services externes sont indisponibles.
        </p>
      ) : null}

      {pwaStatus === 'offline-ready' ? (
        <div className="system-status__notice" role="status">
          <p>
            <strong>Prêt hors ligne.</strong> Le carnet pourra redémarrer sans
            réseau sur cet appareil.
          </p>
          <button
            className="secondary-button"
            type="button"
            onClick={onDismissPwaStatus}
          >
            Compris
          </button>
        </div>
      ) : null}

      {pwaStatus === 'update-available' ? (
        <div className="system-status__notice" role="status">
          <p>
            <strong>Mise à jour disponible.</strong> Rechargez lorsque vous êtes
            prêt ; vos voyages et données personnelles resteront sur cet
            appareil.
          </p>
          <div className="system-status__actions">
            <button className="primary-button" type="button" onClick={onApplyUpdate}>
              Recharger maintenant
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={onDismissPwaStatus}
            >
              Plus tard
            </button>
          </div>
        </div>
      ) : null}

      {pwaStatus === 'updating' ? (
        <p className="system-status__notice" role="status">
          Mise à jour en cours…
        </p>
      ) : null}

      {pwaStatus === 'registration-error' ? (
        <div className="system-status__notice" role="alert">
          <p>
            Le mode hors ligne n’a pas pu être préparé. Le carnet reste
            utilisable tant que cette page est ouverte.
          </p>
          <button
            className="secondary-button"
            type="button"
            onClick={onDismissPwaStatus}
          >
            Fermer
          </button>
        </div>
      ) : null}
    </aside>
  )
}
