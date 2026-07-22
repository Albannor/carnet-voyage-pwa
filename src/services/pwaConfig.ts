import type { VitePWAOptions } from 'vite-plugin-pwa'
import { pwaManifest } from './pwaManifest'

export const pwaBuildOptions: Partial<VitePWAOptions> = {
  registerType: 'prompt',
  includeManifestIcons: false,
  manifest: pwaManifest,
  workbox: {
    cacheId: 'carnet-voyage-shell',
    cleanupOutdatedCaches: true,
    globPatterns: ['**/*.{html,js,css,png,svg,webmanifest}'],
    globIgnores: ['manifest.webmanifest'],
    navigateFallback: 'index.html',
    navigateFallbackDenylist: [/\/guide-standalone\.html(?:\?.*)?$/],
    runtimeCaching: [],
  },
  devOptions: {
    enabled: false,
  },
}
