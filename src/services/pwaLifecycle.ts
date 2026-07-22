export type PwaLifecycleStatus =
  | 'idle'
  | 'offline-ready'
  | 'update-available'
  | 'updating'
  | 'registration-error'

export interface PwaLifecycleState {
  status: PwaLifecycleStatus
}

export interface ServiceWorkerRegistrationCallbacks {
  onOfflineReady?: () => void
  onNeedRefresh?: () => void
  onRegisterError?: (error: unknown) => void
}

export type ServiceWorkerRegister = (
  callbacks: ServiceWorkerRegistrationCallbacks,
) => (reloadPage?: boolean) => Promise<void>

export interface PwaLifecycleStartOptions {
  production: boolean
  serviceWorkerSupported: boolean
  register: ServiceWorkerRegister
}

export interface PwaLifecycleController {
  getState(): PwaLifecycleState
  subscribe(listener: (state: PwaLifecycleState) => void): () => void
  start(options: PwaLifecycleStartOptions): boolean
  dismiss(): void
  applyUpdate(): Promise<void>
}

const IDLE_STATE: PwaLifecycleState = { status: 'idle' }

export function createPwaLifecycle(): PwaLifecycleController {
  let state = IDLE_STATE
  let started = false
  let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null =
    null
  const listeners = new Set<(nextState: PwaLifecycleState) => void>()

  const setState = (nextState: PwaLifecycleState) => {
    state = nextState
    listeners.forEach((listener) => listener(state))
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start(options) {
      if (started || !options.production || !options.serviceWorkerSupported) {
        return false
      }

      started = true

      try {
        updateServiceWorker = options.register({
          onOfflineReady: () => {
            if (state.status !== 'update-available') {
              setState({ status: 'offline-ready' })
            }
          },
          onNeedRefresh: () => setState({ status: 'update-available' }),
          onRegisterError: () => setState({ status: 'registration-error' }),
        })
      } catch {
        setState({ status: 'registration-error' })
      }

      return true
    },
    dismiss() {
      setState(IDLE_STATE)
    },
    async applyUpdate() {
      if (!updateServiceWorker) {
        return
      }

      setState({ status: 'updating' })

      try {
        await updateServiceWorker(true)
      } catch {
        setState({ status: 'registration-error' })
      }
    },
  }
}
