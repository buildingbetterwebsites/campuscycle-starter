// W5 runs `npm run migrate:create`, `npm run migrate` and `npm run generate` next to a running
// `npm run dev`. With the laptop's database started by `npm run dev` itself, those commands must use
// that one, never open the same data folder a second time (that would damage its data).
//
// Here a separate process stands in for `npm run dev`: it starts the real database (PGlite) the way the
// guard does (scripts/lib/laptopDatabase.mjs), in a folder and on a port of this test's own. Then the
// migration runs next to it, and afterwards the data is still in the folder.
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import pg from 'pg'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { ensureLaptopDatabase, LOCK_FILE, NOT_OURS } from '../../scripts/lib/laptopDatabase.mjs'
import { migrationVerified } from '../../scripts/lib/migrationResult.mjs'

const MODULE = pathToFileURL(fileURLToPath(new URL('../../scripts/lib/laptopDatabase.mjs', import.meta.url))).href
const MIGRATION_RUNNER = fileURLToPath(new URL('../../scripts/migrate.mjs', import.meta.url))

const root = mkdtempSync(path.join(tmpdir(), 'bw-laptop-db-reuse-'))
// A second copy of the starter: another project folder on the same computer.
const otherCopy = mkdtempSync(path.join(tmpdir(), 'bw-laptop-db-other-copy-'))
let host: ChildProcess | undefined

async function freePort(): Promise<number> {
  const server = net.createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise((resolve) => server.close(resolve))
  return port
}

/** The stand-in for `npm run dev`: starts the database, says so, and stops it properly when told to. */
function startHost(port: number): Promise<ChildProcess> {
  const code = `
    import { ensureLaptopDatabase } from ${JSON.stringify(MODULE)}
    const database = await ensureLaptopDatabase({ root: process.env.ROOT, port: Number(process.env.PORT) })
    console.log(database.started ? 'STARTED' : 'REUSED')
    process.stdin.on('data', async () => { await database.stop(); process.exit(0) })
  `
  const child = spawn(process.execPath, ['--input-type=module', '-e', code], {
    env: { ...process.env, ROOT: root, PORT: String(port) },
    stdio: ['pipe', 'pipe', 'inherit'],
    windowsHide: true,
  })
  return new Promise((resolve, reject) => {
    child.stdout!.on('data', (chunk) => {
      if (String(chunk).includes('STARTED')) resolve(child)
      else reject(new Error(`the stand-in for npm run dev did not start the database: ${chunk}`))
    })
    child.on('exit', (status) => reject(new Error(`the stand-in for npm run dev stopped (exit code ${status})`)))
  })
}

function stopHost(child: ChildProcess): Promise<number | null> {
  return new Promise((resolve) => {
    child.on('exit', (status) => resolve(status))
    child.stdin!.write('stop\n')
  })
}

function runMigrations(url: string): Promise<{ status: number | null; stdout: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--import', 'tsx', MIGRATION_RUNNER], {
      env: { ...process.env, DATABASE_URL: url, PAYLOAD_SECRET: 'test-secret-0123456789-0123456789', NODE_OPTIONS: '--no-deprecation' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', () => {})
    child.on('close', (status) => resolve({ status, stdout }))
  })
}

afterAll(() => {
  if (host && host.exitCode === null) host.kill()
  rmSync(root, { recursive: true, force: true })
  rmSync(otherCopy, { recursive: true, force: true })
})

describe("your laptop's database, started by one command and used by another", () => {
  it("a migration next to it uses that database (never a second one on the folder), another copy of the starter is refused, and the data stays when it stops", async () => {
    const port = await freePort()
    const url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`
    host = await startHost(port)
    expect(readFileSync(path.join(root, LOCK_FILE), 'utf8')).toBe(String(host.pid))

    // What the guard does for `npm run migrate` in the second terminal: it finds the database answering.
    const open = vi.fn()
    const second = await ensureLaptopDatabase({ root, port, open })
    expect(second.started).toBe(false)
    expect(open).not.toHaveBeenCalled()

    // Another copy of the starter, on the same address: refused, and its own folder is never opened.
    const openOther = vi.fn()
    await expect(ensureLaptopDatabase({ root: otherCopy, port, open: openOther })).rejects.toMatchObject({ code: NOT_OURS })
    expect(openOther).not.toHaveBeenCalled()

    const migration = await runMigrations(url)
    expect(migrationVerified(migration), migration.stdout).toBe(true)

    // `npm run dev` stops: it closes the database properly and lets go of the lock.
    expect(await stopHost(host)).toBe(0)
    expect(existsSync(path.join(root, LOCK_FILE))).toBe(false)

    // Started again from the same folder, the migrations are still there.
    const again = await ensureLaptopDatabase({ root, port })
    expect(again.started).toBe(true)
    const client = new pg.Client(url)
    try {
      await client.connect()
      const { rows } = await client.query('select count(*)::int as count from payload_migrations')
      expect(rows[0].count).toBeGreaterThan(0)
    } finally {
      await client.end()
      await again.stop()
    }
  }, 180_000)
})
