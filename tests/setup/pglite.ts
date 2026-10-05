// Vitest's globalSetup: runs once before the whole test file runs, and once after it finishes.
// Locally, it starts an in-memory Postgres (PGlite) on a free port and points the tests at it.
// In CI, TEST_DATABASE_URL is already set to a real Postgres service, so this only migrates it.
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrationVerified } from '../../scripts/lib/migrationResult.mjs'

let server: PGLiteSocketServer | undefined

const MIGRATION_RUNNER_PATH = fileURLToPath(new URL('../../scripts/migrate.mjs', import.meta.url))

/**
 * Runs the migration runner (scripts/migrate.mjs, the same one the build uses) and waits for it.
 * Success means exit code 0 AND its final check line (scripts/lib/migrationResult.mjs): `payload
 * migrate` used to run here, and sometimes ended with "success" without creating any table, so whole
 * test files then failed with 'relation "bookings" does not exist'.
 *
 * Not `spawnSync`: that call blocks Node's event loop for its whole duration, but the PGlite socket
 * server below needs that same event loop free to accept the runner's connection. A synchronous spawn
 * here deadlocks the two against each other (the runner waits forever for a socket that this process
 * is too busy waiting on the runner to ever accept).
 */
function migrate(env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', MIGRATION_RUNNER_PATH], { stdio: ['ignore', 'pipe', 'pipe'], env, windowsHide: true })
    let stdout = ''
    let output = ''
    child.stdout.on('data', chunk => { stdout += chunk; output += chunk })
    child.stderr.on('data', chunk => { output += chunk })
    child.on('error', reject)
    child.on('close', (status) => {
      if (migrationVerified({ status, stdout })) resolve()
      else reject(new Error(`The test database could not be migrated (exit code ${status}).\n${output}`))
    })
  })
}

export async function setup() {
  // A fresh folder for the images the tests upload (tests/setup/config.ts points the media collection
  // at it), so test runs never write into the project's own media folder. Removed in teardown().
  process.env.TEST_MEDIA_DIR = mkdtempSync(path.join(tmpdir(), 'bw-starter-test-media-'))
  if (!process.env.TEST_DATABASE_URL) {
    const db = await PGlite.create()
    // maxConnections: the runner tests start real migration and seed runners while the test file's own
    // Payload still holds its connections, and each Payload opens several. With 10, they sometimes ran
    // out, and every later test file failed with "Connection terminated unexpectedly". PGlite still
    // answers one query at a time, so allowing more connections costs nothing.
    server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1', maxConnections: 50 })
    await server.start()
    // The installed @electric-sql/pglite-socket types do not declare `port`, though the running
    // server has it: it fills in the real assigned port once `port: 0` (any free port) is listening.
    const port = (server as unknown as { port: number }).port
    process.env.TEST_DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`
  }
  // Also set DATABASE_URL and PAYLOAD_SECRET here, process-wide, not only for the migration below:
  // `src/payload.config.ts` reads both at module-import time (buildConfig(...) runs as soon as the file
  // is imported), and globalSetup is the one place guaranteed to run before any test file - and so
  // before anything imports the config - gets loaded. STORAGE_URL is the other name the config accepts
  // for the address: remove it, so a value left in the shell can never point the tests elsewhere (or
  // clash with DATABASE_URL).
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  delete process.env.STORAGE_URL
  process.env.PAYLOAD_SECRET ??= 'test-secret-0123456789-0123456789'
  // Brings the test database's schema up to date with the committed migrations, the same way a
  // real deployment would (never with push: true, not even here).
  await migrate({ ...process.env, NODE_OPTIONS: '--no-deprecation' })
}

export async function teardown() {
  await server?.stop()
  if (process.env.TEST_MEDIA_DIR) rmSync(process.env.TEST_MEDIA_DIR, { recursive: true, force: true })
}
