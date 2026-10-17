// Starts your laptop's database: PGlite, a real Postgres that runs inside Node. `npm run dev`,
// `npm run migrate`, `npm run migrate:create` and `npm run seed` start it by themselves when nothing
// answers at its address yet (scripts/guard.mjs), and stop it when they stop. `npm run db` starts it on
// its own, in its own terminal (scripts/db.mjs). All of them start it here, the same way.
//
// ONE PROCESS PER FOLDER. Two processes on the same data folder would damage its data. So a process may
// only open the folder after claiming the lock file .data/db.lock, which holds its process id:
//   - Creating that file is one step that only one process can win ("create it unless it exists"), so
//     two commands started at the same moment never both open the folder: the loser waits until the
//     winner's database answers, then uses it.
//   - A closed terminal or a crash can leave the file behind. A lock whose process is gone is stale:
//     it is removed, and the database is started again. (Two commands that both find the same stale
//     lock at the same moment could both remove it; that needs a crash and then a start in the same
//     instant, and is accepted to keep this simple.)
// A lock file, and not just "is something answering at the address?": opening the folder and starting
// to answer are seconds apart, and in those seconds a second command would see nothing answering.
//
// ONLY ITS OWN. Every copy of the starter on a computer uses the same address (127.0.0.1:54329), and a
// student has at least two copies (their own site and, later, the team project). So something that
// answers there is used only when THIS project's lock is held by a live process: then it is this
// project's own database. Anything else that answers is another copy's database (or another program):
// refused before anything is touched, never used (an error with code NOT_OURS).
import { linkSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

import { answers, LOCAL_DATABASE_FOLDER, LOCAL_DATABASE_HOST, LOCAL_DATABASE_PORT } from './localDatabase.mjs'

const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url))

export const LOCK_FILE = '.data/db.lock'

/** The `code` of the error thrown when something answers at the address that is not this project's. */
export const NOT_OURS = 'NOT_OURS'

function notOurs(host, port) {
  return Object.assign(new Error(`another program answers at ${host}:${port}, not this project's database`), { code: NOT_OURS })
}

// Payload opens several connections at once (and `npm run migrate` or `npm run seed` more next to a
// running `npm run dev`). PGlite still answers one query at a time, so allowing more costs nothing.
const MAX_CONNECTIONS = 50

/**
 * pglite-socket (0.2.11) frees a connection's place only when the connection closes normally. A
 * command that ends with its connections still open (`npm run migrate` and `npm run seed` do: Payload
 * keeps one open, so the runners end the process themselves) makes the connection fail instead. Then
 * pglite-socket closes it but kept its place taken for good, and after enough commands next to a
 * running `npm run dev` every new connection was refused ("MIGRATIONS: FAILED" with no plain reason).
 * So the place is freed on a failure too: the connection is closed by then anyway.
 * tests/integration/laptop-database-places.test.ts fails without this.
 *
 * @param {{ handlers: Set<EventTarget> }} server
 */
function freePlacesOfFailedConnections(server) {
  const add = server.handlers.add.bind(server.handlers)
  server.handlers.add = (handler) => {
    handler.addEventListener('error', () => server.handlers.delete(handler))
    return add(handler)
  }
}

/**
 * Opens the data folder and answers at host:port. Only call it while holding the lock.
 *
 * @param {{ folder: string, host: string, port: number, maxConnections?: number }} where
 *   maxConnections: only a test sets it lower.
 * @returns {Promise<{ stop: () => Promise<void> }>}
 */
export async function openLaptopDatabase({ folder, host, port, maxConnections = MAX_CONNECTIONS }) {
  // Loaded only here: a site on Neon never needs PGlite.
  const { PGlite } = await import('@electric-sql/pglite')
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket')
  mkdirSync(folder, { recursive: true })
  const db = await PGlite.create(folder)
  const server = new PGLiteSocketServer({ db, host, port, maxConnections })
  freePlacesOfFailedConnections(server)
  try {
    await server.start()
  } catch (error) {
    await db.close()
    throw error
  }
  // Stop taking connections, then close the database properly so everything is written to the folder.
  return {
    stop: async () => {
      await server.stop()
      await db.close()
    },
  }
}

/**
 * Claims the lock. The process id is written to a file of this process's own first, which then gets
 * the lock's name in one step that fails when the lock exists: another process never reads a lock
 * that is still empty (and would take it for stale).
 *
 * @returns {boolean} true when this process now holds the lock
 */
function claim(lock) {
  mkdirSync(path.dirname(lock), { recursive: true })
  const own = `${lock}.${process.pid}`
  writeFileSync(own, String(process.pid))
  try {
    linkSync(own, lock)
    return true
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'EEXIST') return false
    throw error
  } finally {
    rmSync(own, { force: true })
  }
}

/** The process id in the lock file, or null when it cannot be read. */
function owner(lock) {
  try {
    const pid = Number(readFileSync(lock, 'utf8').trim())
    return Number.isInteger(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM: it exists, but belongs to someone else.
    return /** @type {NodeJS.ErrnoException} */ (error).code === 'EPERM'
  }
}

async function answersWithin({ host, port }, ms) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    if (await answers({ host, port })) return true
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return false
}

/** Does a live process of this project hold the lock (so what answers is this project's database)? */
function heldHere(lock) {
  const pid = owner(lock)
  return pid !== null && alive(pid)
}

/**
 * Makes sure this project's laptop database answers: uses it when it already runs (another terminal's
 * `npm run dev` or `npm run db` of this same project), or starts it in this process.
 *
 * `started: true` means this process started it: call `stop()` when the command ends. With
 * `started: false`, `stop()` does nothing. Throws, with the reason, when it cannot start, and with
 * `code: NOT_OURS` when something else answers at the address (another copy's database).
 *
 * @param {{ root?: string, host?: string, port?: number, waitMs?: number, open?: typeof openLaptopDatabase }} [options]
 *   all default to the real ones; a test passes its own folder, port and `open`.
 * @returns {Promise<{ started: boolean, stop: () => Promise<void> }>}
 */
export async function ensureLaptopDatabase({
  root = PROJECT_ROOT,
  host = LOCAL_DATABASE_HOST,
  port = LOCAL_DATABASE_PORT,
  waitMs = 60_000,
  open = openLaptopDatabase,
} = {}) {
  const address = { host, port }
  const lock = path.join(root, LOCK_FILE)
  const reused = { started: false, stop: async () => {} }

  if (await answers(address)) {
    if (heldHere(lock)) return reused
    throw notOurs(host, port)
  }

  // Twice at most: a stale lock is removed once, then claimed.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (claim(lock)) {
      try {
        // Something may have started answering since the first check. This project's lock is ours,
        // so it is not this project's database: refuse, and never open the folder next to it.
        if (await answers(address)) throw notOurs(host, port)
        const database = await open({ folder: path.join(root, LOCAL_DATABASE_FOLDER), host, port })
        let stopped = false
        return {
          started: true,
          stop: async () => {
            if (stopped) return
            stopped = true
            try {
              await database.stop()
            } finally {
              rmSync(lock, { force: true })
            }
          },
        }
      } catch (error) {
        rmSync(lock, { force: true })
        throw error
      }
    }

    const pid = owner(lock)
    if (pid !== null && alive(pid)) {
      // Another command of this project holds the lock: it is starting the database right now, or runs
      // it already. Use it once it answers, if the lock is still held (its holder lets go when what
      // answers turned out not to be this project's).
      if (await answersWithin(address, waitMs)) {
        if (heldHere(lock)) return reused
        throw notOurs(host, port)
      }
      throw new Error(
        `another program (process ${pid}) holds ${LOCK_FILE}, but nothing answers at ${host}:${port}. If no other terminal runs this project, delete the file ${LOCK_FILE}`,
      )
    }
    // Stale: the process that held it is gone (a closed terminal, a crash).
    rmSync(lock, { force: true })
  }
  throw new Error(`could not claim ${LOCK_FILE}`)
}

/**
 * Does the database at `url` take a connection and answer a query, within `ms` milliseconds? Something
 * that answers at the address is not enough: a database that takes no more connections, or never
 * answers a query, would leave a command waiting with no reason given. Returns null when it works, or
 * the reason when it does not.
 *
 * @param {string} url
 * @param {number} [ms]
 * @returns {Promise<string | null>}
 */
export async function databaseProblem(url, ms = 15_000) {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: ms, query_timeout: ms })
  // A failing connection also reports the problem as an event: without a listener, Node would stop.
  client.on('error', () => {})
  try {
    await client.connect()
    await client.query('select 1')
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  } finally {
    await client.end().catch(() => {})
  }
}
