export interface ConnectivityAdapter {
  isOnline(): boolean
  subscribe(listener: (online: boolean) => void): () => void
}

type ConnectivityWindow = Pick<
  Window,
  'addEventListener' | 'removeEventListener'
>
type ConnectivityNavigator = Pick<Navigator, 'onLine'>

export function createBrowserConnectivityAdapter(
  browserWindow: ConnectivityWindow,
  browserNavigator: ConnectivityNavigator,
): ConnectivityAdapter {
  return {
    isOnline: () => browserNavigator.onLine,
    subscribe(listener) {
      const notify = () => listener(browserNavigator.onLine)

      browserWindow.addEventListener('online', notify)
      browserWindow.addEventListener('offline', notify)

      return () => {
        browserWindow.removeEventListener('online', notify)
        browserWindow.removeEventListener('offline', notify)
      }
    },
  }
}

export const browserConnectivity = createBrowserConnectivityAdapter(
  window,
  navigator,
)
