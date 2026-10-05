import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    // tests/e2e holds the browser checks: Playwright runs those (npm run check), not Vitest.
    // .superpowers/ holds the starter's builders' working notes and scratch copies (never published);
    // a copy of the tests in there must never be collected as tests.
    exclude: [...configDefaults.exclude, 'tests/e2e/**', '.superpowers/**'],
    globalSetup: ['tests/setup/pglite.ts'],
    // One PGlite server backs the whole run: parallel test files would race each other on it.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, 'src'),
    },
  },
})
