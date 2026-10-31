import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  requestScreenWakeLock,
  type RequestScreenWakeLock,
  type ScreenWakeLockHandle,
} from '../../services/screenWakeLock'

/**
 * Mode présentation d’une image ajoutée : plein écran sur fond blanc pour
 * faciliter la lecture d’un QR code. La mention « Écran maintenu allumé »
 * n’apparaît que si le verrou d’écran est réellement obtenu.
 */
export function PiecePresentation({
  title,
  detail,
  source,
  onClose,
  requestWakeLock = requestScreenWakeLock,
}: {
  title: string
  detail?: string
  source: string
  onClose(): void
  requestWakeLock?: RequestScreenWakeLock
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const [wakeLockActive, setWakeLockActive] = useState(false)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    let disposed = false
    let handle: ScreenWakeLockHandle | undefined

    async function acquire() {
      const obtained = await requestWakeLock()
      if (!obtained) return
      if (disposed) {
        void obtained.release().catch(() => undefined)
        return
      }
      handle = obtained
      setWakeLockActive(true)
      obtained.addEventListener('release', () => {
        if (!disposed) setWakeLockActive(false)
      })
    }

    // Le navigateur libère le verrou quand la page est masquée : il est redemandé au retour.
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && (!handle || handle.released)) {
        void acquire()
      }
    }

    void acquire()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (handle && !handle.released) void handle.release().catch(() => undefined)
    }
  }, [requestWakeLock])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'Tab') {
      // Le seul contrôle de la présentation garde le focus.
      event.preventDefault()
      closeRef.current?.focus()
    }
  }

  return (
    <div
      className="piece-presentation"
      role="dialog"
      aria-modal="true"
      aria-labelledby="piece-presentation-title"
      onKeyDown={handleKeyDown}
    >
      <p id="piece-presentation-title" className="piece-presentation-title">{title}</p>
      <div className="piece-presentation-image">
        <img src={source} alt={title} />
      </div>
      <p className="piece-presentation-status" role="status">
        {wakeLockActive && 'Écran maintenu allumé · luminosité au maximum conseillée'}
      </p>
      {detail && <p className="piece-presentation-detail">{detail}</p>}
      <button
        ref={closeRef}
        className="secondary-button piece-presentation-close"
        type="button"
        onClick={onClose}
      >
        Fermer
      </button>
    </div>
  )
}
