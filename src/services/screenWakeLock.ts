/** Verrou d’écran obtenu par l’API Screen Wake Lock. */
export interface ScreenWakeLockHandle {
  readonly released: boolean
  release(): Promise<void>
  addEventListener(type: 'release', listener: () => void): void
}

interface WakeLockNavigator {
  readonly wakeLock?: {
    request(type: 'screen'): Promise<ScreenWakeLockHandle>
  }
}

export type RequestScreenWakeLock = () => Promise<ScreenWakeLockHandle | undefined>

/**
 * Tente de garder l’écran allumé. Renvoie `undefined`, sans erreur ni journal,
 * lorsque l’API est absente ou que le navigateur refuse le verrou.
 */
export async function requestScreenWakeLock(
  navigatorLike: WakeLockNavigator | undefined = globalThis.navigator as WakeLockNavigator | undefined,
): Promise<ScreenWakeLockHandle | undefined> {
  if (typeof navigatorLike?.wakeLock?.request !== 'function') return undefined
  try {
    return await navigatorLike.wakeLock.request('screen')
  } catch {
    return undefined
  }
}
