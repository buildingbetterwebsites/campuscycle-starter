import { spawn } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { SEED_VERIFIED, seedVerified } from '../../scripts/lib/seedResult.mjs'
import { SEED_TOO_SLOW_MESSAGE } from '../../scripts/lib/watchdog.mjs'
import { forgetExampleAdded, getTestPayload, resetCollections, resetSiteFacts } from '../setup/payload'
import { refuseUnlessThrowAwayTestDatabase } from '../setup/safety'

// These tests delete every user and every example record: never on a real database.
refuseUnlessThrowAwayTestDatabase()

const root = fileURLToPath(new URL('../..', import.meta.url))
const runner = path.join(root, 'scripts', 'seed.mjs')
// The runner's TypeScript loader, by its full address: the runner below starts in a temporary folder
// (see `folder`), where `--import tsx` alone would not find it.
const tsx = import.meta.resolve('tsx')

type Result = { status: number | null; stdout: string; stderr: string }

// Runs scripts/seed.mjs exactly the way the build and `npm run seed` do. Asynchronous on purpose: the
// test database (PGlite) answers from this same test process, so a blocking spawnSync would leave
// nobody to answer the runner's connection.
//
// It starts in its own temporary folder (`cwd`): Payload saves uploaded images in a "media" folder
// inside the folder it was started from, and the real runner must not write into the project's own.
function runRunner(
  variables: Record<string, string | undefined>,
  cwd: string,
  nodeArgs = ['--import', tsx],
  args: string[] = [],
): Promise<Result> {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      NODE_OPTIONS: '--no-deprecation',
      TSX_TSCONFIG_PATH: path.join(root, 'tsconfig.json'),
      DATABASE_URL: undefined,
      STORAGE_URL: undefined,
      ...variables,
    }
    const child = spawn(process.execPath, [...nodeArgs, runner, ...args], { cwd, env, windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (status) => resolve({ status, stdout, stderr }))
  })
}

const folder = mkdtempSync(path.join(tmpdir(), 'bw-starter-seed-runner-'))
// At the level of the whole file, so the folder is removed even when only some tests run (for
// example `vitest run -t ...`): Vitest skips a describe block's own afterAll when all its tests are
// skipped.
afterAll(() => rmSync(folder, { recursive: true, force: true }))
const clean = ['bookings', 'timeSlots', 'clinics', 'workshops', 'topics', 'repairs', 'pages', 'media', 'users']
const admin = { FIRST_ADMIN_EMAIL: 'seed-runner@campuscycle.example', FIRST_ADMIN_PASSWORD: 'test-password-0123456789' }

describe('the seed runner (scripts/seed.mjs)', () => {
  afterAll(async () => {
    await resetCollections(clean)
    await forgetExampleAdded()
    await resetSiteFacts()
  })

  it('creates the first editor and the content once, reports the counts, and ends with the verified line', async () => {
    await resetCollections(clean)
    await forgetExampleAdded()
    await resetSiteFacts()
    const first = await runRunner({ DATABASE_URL: process.env.TEST_DATABASE_URL, ...admin }, folder)
    expect(first.status, first.stderr).toBe(0)
    expect(first.stdout.split(/\r?\n/)).toContain('SEED: created 21, kept 0')
    expect(seedVerified(first)).toBe(true)
    // Its images went to the runner's own folder, not into the project.
    expect(readdirSync(path.join(folder, 'media'))).toHaveLength(6)
    const p = await getTestPayload()
    expect((await p.count({ collection: 'users' })).totalDocs).toBe(1)

    // A second run adds nothing: the example was added before. It still ends with the verified line,
    // because the step finished correctly.
    const second = await runRunner({ DATABASE_URL: process.env.TEST_DATABASE_URL, ...admin }, folder)
    expect(second.stdout.split(/\r?\n/)).toContain(
      "SEED: skipped (the example content was added before; your editors' changes are kept)",
    )
    expect(seedVerified(second)).toBe(true)

    // --again adds back only what is missing: here nothing.
    const again = await runRunner({ DATABASE_URL: process.env.TEST_DATABASE_URL, ...admin }, folder, undefined, ['--again'])
    expect(again.stdout).toMatch(/SEED: created 0, kept 21 \(--again/)
    expect(seedVerified(again)).toBe(true)
  }, 120_000)

  it('exits non-zero without the verified line when the database refuses the connection', async () => {
    const result = await runRunner({ DATABASE_URL: 'postgres://postgres:not-a-real-password@127.0.0.1:1/postgres', ...admin }, folder)
    expect(result.status).not.toBe(0)
    expect(seedVerified(result)).toBe(false)
    // The address holds a password: it must never be printed.
    expect(result.stdout + result.stderr).not.toContain('not-a-real-password')
  }, 60_000)

  it('refuses to start without any database address, instead of trying a default one', async () => {
    const result = await runRunner({}, folder)
    expect(result.status).not.toBe(0)
    expect(result.stdout).not.toContain(SEED_VERIFIED)
    expect(result.stderr).toContain('No database address')
  }, 60_000)
})

// The lifecycle checks below replace Payload, the seed and the watchdog's time limit with stand-ins
// (through a Node "loader" that swaps four imports), so each failure can be produced on purpose and in
// under a second.
const fakePayload = `
setInterval(() => {}, 1000);
export default {
  async init(options) {
    if (!options.disableOnInit) throw Error('the first-admin hook must stay switched off: runSeed does it');
    if (process.env.RUNNER_TEST_MODE === 'init-error') throw Error('init failed');
  },
  async destroy() { console.log('CLEANUP'); },
};`
const fakeRun = `
export async function runSeed(payload, options) {
  if (process.env.RUNNER_TEST_MODE === 'adapter-exit') process.exit(0);
  if (process.env.RUNNER_TEST_MODE === 'seed-error') throw Error('seed failed');
  if (process.env.RUNNER_TEST_MODE === 'plain-error') {
    throw Object.assign(Error('Images cannot be stored: a plain message.'), { name: 'PlainError' });
  }
  if (process.env.RUNNER_TEST_MODE === 'hang') await new Promise(() => {});
  console.log('again=' + options.again);
  console.log('SEED: created 20, kept 0');
}`
// The real watchdog, but with a 300 ms limit in the 'hang' test, so it does not take 110 seconds.
const shortWatchdog = `
import { startWatchdog as real } from '${pathToFileURL(path.join(root, 'scripts', 'lib', 'watchdog.mjs')).href}';
export { SEED_TOO_SLOW_MESSAGE } from '${pathToFileURL(path.join(root, 'scripts', 'lib', 'watchdog.mjs')).href}';
export const startWatchdog = (options = {}) =>
  real(process.env.RUNNER_TEST_MODE === 'hang' ? { ...options, ms: 300 } : options);`
const loader = `
const sources = ${JSON.stringify({
  payload: fakePayload,
  '../src/payload.config.ts': 'export default {};',
  '../src/seed/run.ts': fakeRun,
  './lib/watchdog.mjs': shortWatchdog,
})};
export async function resolve(specifier, context, next) {
  if (sources[specifier]) return { url: 'data:text/javascript,' + encodeURIComponent(sources[specifier]), shortCircuit: true };
  return next(specifier, context);
}`
const withStandIns = ['--no-warnings', '--loader', `data:text/javascript,${encodeURIComponent(loader)}`]
const fakeDatabase = 'postgres://postgres:postgres@127.0.0.1:1/postgres'

describe('the seed runner\'s lifecycle, with stand-ins for Payload and the seed', () => {
  it('seeds, cleans up, then exits 0 with the verified line even though a connection is still open', async () => {
    const result = await runRunner({ DATABASE_URL: fakeDatabase, RUNNER_TEST_MODE: 'success' }, root, withStandIns)
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toMatch(new RegExp(`SEED: created 20, kept 0\\r?\\nCLEANUP\\r?\\n${SEED_VERIFIED}\\r?\\n`))
    expect(result.stdout).toContain('again=false')
  }, 30_000)

  it('passes --again on to the seed, and refuses any other argument', async () => {
    const again = await runRunner({ DATABASE_URL: fakeDatabase, RUNNER_TEST_MODE: 'success' }, root, withStandIns, ['--again'])
    expect(again.status, again.stderr).toBe(0)
    expect(again.stdout).toContain('again=true')
    const unknown = await runRunner({ DATABASE_URL: fakeDatabase, RUNNER_TEST_MODE: 'success' }, root, withStandIns, ['--force'])
    expect(unknown.status).toBe(1)
    expect(unknown.stderr).toContain('--force')
    expect(unknown.stderr).toContain('--again')
    expect(seedVerified(unknown)).toBe(false)
  }, 30_000)

  it('prints only the message of a plain, known error; the technical details only with DEBUG set', async () => {
    const plain = await runRunner({ DATABASE_URL: fakeDatabase, RUNNER_TEST_MODE: 'plain-error' }, root, withStandIns)
    expect(plain.status).toBe(1)
    expect(plain.stderr.trim()).toBe('Images cannot be stored: a plain message.')
    const debug = await runRunner({ DATABASE_URL: fakeDatabase, RUNNER_TEST_MODE: 'plain-error', DEBUG: '1' }, root, withStandIns)
    expect(debug.stderr).toContain('Images cannot be stored: a plain message.')
    expect(debug.stderr).toMatch(/\n\s+at /)
    // An unexpected error keeps its details: they are what you need to find the cause.
    const unexpected = await runRunner({ DATABASE_URL: fakeDatabase, RUNNER_TEST_MODE: 'seed-error' }, root, withStandIns)
    expect(unexpected.stderr).toMatch(/seed failed\r?\n\s+at /)
  }, 30_000)

  it('exits 1 without the verified line, after cleaning up, when anything fails', async () => {
    for (const mode of ['init-error', 'seed-error']) {
      const result = await runRunner({ DATABASE_URL: fakeDatabase, RUNNER_TEST_MODE: mode }, root, withStandIns)
      expect(result.status, mode).toBe(1)
      expect(result.stdout, mode).toContain('CLEANUP')
      expect(result.stdout, mode).not.toContain(SEED_VERIFIED)
    }
  }, 30_000)

  it('an exit with code 0 halfway through cannot print the verified line, so it never counts as success', async () => {
    const result = await runRunner({ DATABASE_URL: fakeDatabase, RUNNER_TEST_MODE: 'adapter-exit' }, root, withStandIns)
    expect(result.status).toBe(0)
    expect(result.stdout).not.toContain(SEED_VERIFIED)
    expect(seedVerified(result)).toBe(false)
  }, 30_000)

  it('a seed that never finishes: the watchdog stops the runner with a plain message and exit code 1', async () => {
    const result = await runRunner({ DATABASE_URL: fakeDatabase, RUNNER_TEST_MODE: 'hang' }, root, withStandIns)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(SEED_TOO_SLOW_MESSAGE)
    expect(seedVerified(result)).toBe(false)
  }, 30_000)
})
