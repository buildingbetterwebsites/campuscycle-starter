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
import { linkSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { answers, LOCAL_DATABASE_FOLDER, LOCAL_DATABASE_HOST, LOCAL_DATABASE_PORT } from './localDatabase.mjs'

const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url))

export const LOCK_FILE = '.data/db.lock'

// Payload opens several connections at once (and `npm run migrate` or `npm run seed` more next to a
// running `npm run dev`). PGlite still answers one query at a time, so allowing more costs nothing.
const MAX_CONNECTIONS = 50

/**
 * Opens the data folder and answers at host:port. Only call it while holding the lock.
 *
 * @param {{ folder: string, host: string, port: number }} where
 * @returns {Promise<{ stop: () => Promise<void> }>}
 */
export async function openLaptopDatabase({ folder, host, port }) {
  // Loaded only here: a site on Neon never needs PGlite.
  const { PGlite } = await import('@electric-sql/pglite')
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket')
  mkdirSync(folder, { recursive: true })
  const db = await PGlite.create(folder)
  const server = new PGLiteSocketServer({ db, host, port, maxConnections: MAX_CONNECTIONS })
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

/**
 * Makes sure your laptop's database answers: uses the one that already answers (another terminal's
 * `npm run dev` or `npm run db`), or starts it in this process.
 *
 * `started: true` means this process started it: call `stop()` when the command ends. With
 * `started: false`, `stop()` does nothing. Throws, with the reason, when it cannot start.
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

  if (await answers(address)) return reused

  // Twice at most: a stale lock is removed once, then claimed.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (claim(lock)) {
      try {
        // Something may have started answering since the first check (an `npm run db` from before
        // the lock existed, or another program on this port): never open the folder next to it.
        if (await answers(address)) {
          rmSync(lock, { force: true })
          return reused
        }
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
      // Another command holds the lock: it is starting the database right now, or runs it already.
      if (await answersWithin(address, waitMs)) return reused
      throw new Error(
        `another program (process ${pid}) holds ${LOCK_FILE}, but nothing answers at ${host}:${port}. If no other terminal runs this project, delete the file ${LOCK_FILE}`,
      )
    }
    // Stale: the process that held it is gone (a closed terminal, a crash).
    rmSync(lock, { force: true })
  }
  throw new Error(`could not claim ${LOCK_FILE}`)
}
