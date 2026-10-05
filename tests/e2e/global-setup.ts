// Runs once before the browser checks: makes the test clinic (fixture.ts) and wakes the site up.
// The fixture's details reach every check through the E2E_FIXTURE setting (see readFixture in
// helpers.ts): Playwright passes settings made here on to the checks.
import { execFileSync } from 'node:child_process'
import { BASE_URL } from './helpers'

export function runFixture(command: 'create' | 'remove' | 'break' | 'mend'): string {
  return execFileSync(process.execPath, ['--import', 'tsx', 'tests/e2e/fixture.ts', command], {
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: '--no-deprecation' },
    stdio: ['ignore', 'pipe', 'inherit'],
    timeout: 120_000,
  })
}

export default async function globalSetup() {
  // In case an earlier run stopped while the clinics table was renamed (user-tasks.spec.ts).
  runFixture('mend')
  const output = runFixture('create')
  const line = output.split(/\r?\n/).find((text) => text.startsWith('E2E_FIXTURE='))
  if (!line) throw new Error(`The test clinic could not be made. The fixture said:\n${output}`)
  process.env.E2E_FIXTURE = line.slice('E2E_FIXTURE='.length)

  // A site that has just started (or a database that was asleep) can take seconds to answer its first
  // request. Ask each kind of page once, allowing 15 seconds, so the checks themselves start warm.
  const { clinic } = JSON.parse(process.env.E2E_FIXTURE) as { clinic: { slug: string } }
  for (const path of ['/', '/workshops', '/clinics', `/clinics/${clinic.slug}`]) {
    const response = await fetch(new URL(path, BASE_URL), { signal: AbortSignal.timeout(15_000) })
    if (response.status >= 500) throw new Error(`${path} answered ${response.status} while warming up: is the site running at ${BASE_URL}?`)
  }
}
