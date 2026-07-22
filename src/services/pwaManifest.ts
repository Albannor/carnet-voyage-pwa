import type { ManifestOptions } from 'vite-plugin-pwa'

export const pwaManifest: Partial<ManifestOptions> = {
  id: './',
  name: 'Carnet de voyage',
  short_name: 'Carnet voyage',
  description:
    'Conservez et consultez vos voyages hors ligne sur votre appareil.',
  lang: 'fr',
  start_url: './',
  scope: './',
  display: 'standalone',
  theme_color: '#123f3a',
  background_color: '#f4efe6',
  icons: [
    {
      src: 'icons/carnet-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: 'icons/carnet-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: 'icons/carnet-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
}
