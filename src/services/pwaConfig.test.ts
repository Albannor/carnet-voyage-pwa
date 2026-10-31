import { describe, expect, it } from 'vitest'
import { pwaBuildOptions } from './pwaConfig'
import { pwaManifest } from './pwaManifest'

describe('configuration PWA', () => {
  it('utilise un manifeste unique, relatif et installable', () => {
    expect(pwaBuildOptions.manifest).toBe(pwaManifest)
    expect(pwaManifest).toMatchObject({
      id: './',
      name: 'Carnet de voyage',
      short_name: 'Carnet voyage',
      lang: 'fr',
      start_url: './',
      scope: './',
      display: 'standalone',
      theme_color: '#123f3a',
      background_color: '#f4efe6',
    })
    expect(pwaManifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: 'icons/carnet-192.png',
          sizes: '192x192',
          type: 'image/png',
        }),
        expect.objectContaining({
          src: 'icons/carnet-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        }),
        expect.objectContaining({
          src: 'icons/carnet-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        }),
      ]),
    )
  })

  it('précache uniquement le shell et garde une mise à jour sur demande', () => {
    expect(pwaBuildOptions.registerType).toBe('prompt')
    expect(pwaBuildOptions.includeManifestIcons).toBe(false)
    expect(pwaBuildOptions.devOptions).toEqual({ enabled: false })
    expect(pwaBuildOptions.workbox).toMatchObject({
      cacheId: 'carnet-voyage-shell',
      cleanupOutdatedCaches: true,
      navigateFallback: 'index.html',
      runtimeCaching: [],
    })
    expect(pwaBuildOptions.workbox?.globPatterns).toEqual([
      '**/*.{html,js,css,png,svg,woff2,webmanifest}',
    ])
    expect(pwaBuildOptions.workbox?.globIgnores).toEqual([
      'manifest.webmanifest',
    ])
    expect(
      pwaBuildOptions.workbox?.navigateFallbackDenylist?.[0].test(
        '/voyages/guide-standalone.html?source=import',
      ),
    ).toBe(true)
  })
})
