import { registerSW } from 'virtual:pwa-register'
import { createPwaLifecycle } from './pwaLifecycle'

export const browserPwaLifecycle = createPwaLifecycle()

export function startBrowserPwa(): boolean {
  return browserPwaLifecycle.start({
    production: import.meta.env.PROD,
    serviceWorkerSupported:
      typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    register: registerSW,
  })
}
