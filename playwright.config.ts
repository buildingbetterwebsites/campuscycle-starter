// The browser checks (npm run check): Playwright opens the real site in a browser, at a phone's width
// (390 px) and a laptop's (1100 px), and does what a user does. The site must already be running: CI
// builds it and starts it (next build, then next start) before running these; on your own computer,
// start it the same way, or with npm run dev, and set PLAYWRIGHT_BASE_URL if it is not on port 3100.
// The checks also need DATABASE_URL (or STORAGE_URL), PAYLOAD_SECRET, FIRST_ADMIN_EMAIL and
// FIRST_ADMIN_PASSWORD: the same values the site runs with (the set-up makes a test clinic in that
// database, and removes it). Nothing here reads .env.local: set them in the terminal you run the checks
// from. A database that is not on this computer is refused unless you set E2E_ALLOW_REMOTE=1 (only for a
// throwaway test database, never your live one). With npm run dev, the site is on port 3000: set
// PLAYWRIGHT_BASE_URL=http://localhost:3000.
import { defineConfig, devices } from '@playwright/test'
import { BASE_URL } from './tests/e2e/helpers'

const inCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  // One check at a time: they share the test clinic's time slots.
  workers: 1,
  fullyParallel: false,
  // A failure is a finding, never retried away.
  retries: 0,
  forbidOnly: inCI,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: inCI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: BASE_URL,
    // The first page a check opens may wake the site up: allow 15 seconds.
    navigationTimeout: 15_000,
    // On your own computer: the Chrome you already have, so nothing needs downloading. In CI: the
    // Chromium that `npx playwright install --with-deps chromium` installs.
    ...(inCI ? {} : { channel: 'chrome' }),
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'phone-390', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'laptop-1100', use: { ...devices['Desktop Chrome'], viewport: { width: 1100, height: 800 } } },
  ],
})
