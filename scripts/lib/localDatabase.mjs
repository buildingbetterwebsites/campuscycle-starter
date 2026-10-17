// Your laptop's database: `npm run dev`, `migrate`, `migrate:create` and `seed` start it by themselves
// (scripts/lib/laptopDatabase.mjs), and `npm run db` starts it on its own. It is PGlite, a real Postgres
// that runs inside Node, so you need no account and no installed database. Its data stays in the
// folder below, inside this project (git leaves that folder out).
//
// The live site and the previews never use it: they use Neon, through Vercel.
import net from 'node:net'

export const LOCAL_DATABASE_HOST = '127.0.0.1'
// Not 5432: that is the port an installed Postgres uses, and the two must not clash.
export const LOCAL_DATABASE_PORT = 54329
export const LOCAL_DATABASE_FOLDER = '.data/db'
export const LOCAL_DATABASE_URL = `postgres://postgres:postgres@${LOCAL_DATABASE_HOST}:${LOCAL_DATABASE_PORT}/postgres`

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

/**
 * Where a database address points, when that is this computer itself (127.0.0.1 or localhost);
 * `null` for any other address (a Neon database, for example) or one that cannot be read.
 *
 * @param {string | undefined} url
 * @returns {{ host: string, port: number } | null}
 */
export function localAddress(url) {
  if (!url) return null
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const host = parsed.hostname.toLowerCase()
  if (!LOOPBACK_HOSTS.has(host)) return null
  return { host: host.replace(/^\[|\]$/g, ''), port: parsed.port ? Number(parsed.port) : 5432 }
}

/**
 * Does anything answer at this address? Opens a connection and closes it again at once; sends nothing.
 *
 * @param {{ host: string, port: number }} address
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
export function answers({ host, port }, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port })
    const done = (result) => {
      socket.destroy()
      resolve(result)
    }
    socket.setTimeout(timeoutMs, () => done(false))
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
}

/**
 * Is this the address of your laptop's database, the one the starter starts itself (this computer, port
 * 54329)? Only that one runs without database transactions (src/payload.config.ts explains why). Any
 * other database on this computer, such as the tests' own, keeps them.
 *
 * @param {string | undefined} url
 */
export function isLaptopDatabase(url) {
  return localAddress(url)?.port === LOCAL_DATABASE_PORT
}

/**
 * Does the site use database transactions on this database? Yes everywhere, except on your laptop's
 * database: see the comment at `transactionOptions` in src/payload.config.ts.
 *
 * @param {string | undefined} url
 */
export function databaseTransactions(url) {
  return !isLaptopDatabase(url)
}
