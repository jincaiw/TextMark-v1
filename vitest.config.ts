import { defineConfig } from 'vitest/config'
import packageJson from './package.json' with { type: 'json' }

export default defineConfig({
  // Keep the vite.config.ts define in sync so components referencing
  // __APP_VERSION__ directly (SettingsDialog About pane) render in tests.
  define: { __APP_VERSION__: JSON.stringify(packageJson.version) },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
})
