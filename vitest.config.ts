import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Vitest runs the unit/component suite in jsdom. The `@/…` alias mirrors the
// tsconfig path map so tests import modules exactly like the app does.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      // `server-only` is a Next.js build guard with no runtime; stub it so
      // server modules (e.g. lib/db.ts) can be unit-tested under Vitest.
      'server-only': resolve(__dirname, 'test/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
  },
})
