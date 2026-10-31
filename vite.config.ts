import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'
import { pwaBuildOptions } from './src/services/pwaConfig'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA(pwaBuildOptions),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Les worktrees locaux de .claude/ contiennent d’autres copies du dépôt.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
