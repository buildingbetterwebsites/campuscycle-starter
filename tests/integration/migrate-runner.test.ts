import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MIGRATIONS_VERIFIED, migrationVerified } from '../../scripts/lib/migrationResult.mjs'
import { NO_ANSWER_MESSAGE } from '../../scripts/lib/watchdog.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))

type Result = { status: number | null, stdout: string, stderr: string }

// Runs scripts/migrate.mjs exactly the way the build and `npm run migrate` do. Asynchronous on purpose:
// the test database (PGlite) answers from this same test process, so a blocking spawnSync would
// leave nobody to answer the runner's connection.
function runRunner(variables: Record<string, string | undefined>, nodeArgs = ['--import', 'tsx']): Promise<Result> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, NODE_OPTIONS: '--no-deprecation', DATABASE_URL: undefined, STORAGE_URL: undefined, ...variables }
    const child = spawn(process.execPath, [...nodeArgs, 'scripts/migrate.mjs'], { cwd: root, env, windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', status => resolve({ status, stdout, stderr }))
  })
}

// These tests migrate the SAME test database every other test file uses. That is safe because Vitest
// runs the test files one after the other here (`fileParallelism: false` in vitest.config.mts), and
// because migrating an up-to-date database changes nothing.
describe('the migration runner (scripts/migrate.mjs)', () => {
  it('migrates the test database and prints the verified marker', async () => {
    const result = await runRunner({ DATABASE_URL: process.env.TEST_DATABASE_URL })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout.split(/\r?\n/)).toContain(MIGRATIONS_VERIFIED)
    expect(migrationVerified(result)).toBe(true)
  }, 60_000)

  it('finds the database under the STORAGE_URL name too', async () => {
    const result = await runRunner({ STORAGE_URL: process.env.TEST_DATABASE_URL })
    expect(migrationVerified(result)).toBe(true)
  }, 60_000)

  it('exits non-zero without the marker when the database refuses the connection', async () => {
    const result = await runRunner({ DATABASE_URL: 'postgres://postgres:not-a-real-password@127.0.0.1:1/postgres' })
    expect(result.status).not.toBe(0)
    expect(result.stdout).not.toContain(MIGRATIONS_VERIFIED)
    expect(migrationVerified(result)).toBe(false)
    // The address holds a password: it must never be printed.
    expect(result.stdout + result.stderr).not.toContain('not-a-real-password')
  }, 60_000)

  it('refuses to start without any database address, instead of trying a default one', async () => {
    const result = await runRunner({})
    expect(result.status).not.toBe(0)
    expect(result.stdout).not.toContain(MIGRATIONS_VERIFIED)
    expect(result.stderr).toContain('No database address')
  }, 60_000)
})

// The lifecycle checks below replace Payload with a stand-in (through a Node "loader" that swaps four
// imports, the watchdog's time limit included), so each failure can be produced on purpose and in under
// a second: an import or connection error, a migration error, a migration that is missing afterwards,
// a database that never answers, and the dangerous case from the account test: something exiting with
// code 0 halfway through, before anything was verified.
const fakePayload = `
setInterval(() => {}, 1000);
export default {
  async init(options) {
    if (!options.disableOnInit) throw Error('the first-admin hook must stay switched off');
    if (process.env.RUNNER_TEST_MODE === 'init-error') throw Error('init failed');
  },
  db: { async migrate() {
    if (process.env.RUNNER_TEST_MODE === 'adapter-exit') process.exit(0);
    if (process.env.RUNNER_TEST_MODE === 'migration-error') throw Error('migration failed');
    if (process.env.RUNNER_TEST_MODE === 'hang') await new Promise(() => {});
  } },
  async find(args) {
    if (args.pagination !== false) throw Error('the check must read every applied migration, not one page');
    return { docs: process.env.RUNNER_TEST_MODE === 'missing' ? [] : [{ name: 'initial' }] };
  },
  async destroy() { console.log('CLEANUP'); },
};`
// The real watchdog, but with a 300 ms limit in the 'hang' test, so it does not take 110 seconds.
const shortWatchdog = `
import { startWatchdog as real } from '${pathToFileURL(path.join(root, 'scripts', 'lib', 'watchdog.mjs')).href}';
export const startWatchdog = (options = {}) =>
  real(process.env.RUNNER_TEST_MODE === 'hang' ? { ...options, ms: 300 } : options);`
const loader = `
const sources = ${JSON.stringify({
  payload: fakePayload,
  '../src/payload.config.ts': 'export default {};',
  '../src/migrations/index.ts': 'export const migrations = [{ name: \'initial\' }];',
  './lib/watchdog.mjs': shortWatchdog,
})};
export async function resolve(specifier, context, next) {
  if (sources[specifier]) return { url: 'data:text/javascript,' + encodeURIComponent(sources[specifier]), shortCircuit: true };
  return next(specifier, context);
}`
const withFakePayload = ['--no-warnings', '--loader', `data:text/javascript,${encodeURIComponent(loader)}`]
const fakeDatabase = 'postgres://postgres:postgres@127.0.0.1:1/postgres'

describe('the migration runner\'s lifecycle, with a stand-in for Payload', () => {
  it('verifies, cleans up, then exits 0 with the marker even though a connection is still open', async () => {
    const result = await runRunner({ DATABASE_URL: fakeDatabase, RUNNER_TEST_MODE: 'success' }, withFakePayload)
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toMatch(new RegExp(`CLEANUP\\r?\\n(.*\\r?\\n)*${MIGRATIONS_VERIFIED}\\r?\\n`))
  }, 30_000)

  it('exits 1 without the marker, after cleaning up, when a migration is missing or anything fails', async () => {
    for (const mode of ['missing', 'init-error', 'migration-error']) {
      const result = await runRunner({ DATABASE_URL: fakeDatabase, RUNNER_TEST_MODE: mode }, withFakePayload)
      expect(result.status, mode).toBe(1)
      expect(result.stdout, mode).toContain('CLEANUP')
      expect(result.stdout, mode).not.toContain(MIGRATIONS_VERIFIED)
    }
  }, 30_000)

  it('an exit with code 0 halfway through cannot print the marker, so it never counts as success', async () => {
    const result = await runRunner({ DATABASE_URL: fakeDatabase, RUNNER_TEST_MODE: 'adapter-exit' }, withFakePayload)
    expect(result.status).toBe(0)
    expect(result.stdout).not.toContain(MIGRATIONS_VERIFIED)
    expect(migrationVerified(result)).toBe(false)
  }, 30_000)

  it('a database that never answers: the watchdog stops the runner with a plain message and exit code 1', async () => {
    const result = await runRunner({ DATABASE_URL: fakeDatabase, RUNNER_TEST_MODE: 'hang' }, withFakePayload)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(NO_ANSWER_MESSAGE)
    expect(migrationVerified(result)).toBe(false)
  }, 30_000)
})
