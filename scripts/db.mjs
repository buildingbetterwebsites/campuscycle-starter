// `npm run db`: starts your laptop's database and keeps it running until you press Ctrl+C.
//
// It is PGlite: a real Postgres that runs inside Node, so you need no account and no installed
// database. Its data is kept in the folder .data/db inside this project (git leaves it out), so your
// content is still there the next time you start it. The address it listens on is the DATABASE_URL
// line in .env.example (scripts/lib/localDatabase.mjs).
//
// Leave it running in its own terminal while you use `npm run migrate`, `npm run seed` and
// `npm run dev` in a second one. The live site and the previews never use it: they use Neon.
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import {
  answers,
  LOCAL_DATABASE_FOLDER,
  LOCAL_DATABASE_HOST,
  LOCAL_DATABASE_PORT,
  LOCAL_DATABASE_URL,
} from './lib/localDatabase.mjs'

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))
const DATA_FOLDER = path.join(PROJECT_ROOT, LOCAL_DATABASE_FOLDER)

// Payload opens several connections at once (and `npm run migrate` or `npm run seed` more next to a
// running `npm run dev`). PGlite still answers one query at a time, so allowing more costs nothing.
const MAX_CONNECTIONS = 50

const address = { host: LOCAL_DATABASE_HOST, port: LOCAL_DATABASE_PORT }

// Two copies on the same folder would damage its data: stop if one is already running.
if (await answers(address)) {
  console.error(
    `Your laptop's database is already running: something answers at ${LOCAL_DATABASE_HOST}:${LOCAL_DATABASE_PORT}. Use the terminal it runs in (press Ctrl+C there to stop it).`,
  )
  process.exit(1)
}

mkdirSync(DATA_FOLDER, { recursive: true })
console.log(`Starting your laptop's database (its data is kept in ${LOCAL_DATABASE_FOLDER}) ...`)

const db = await PGlite.create(DATA_FOLDER)
const server = new PGLiteSocketServer({
  db,
  host: LOCAL_DATABASE_HOST,
  port: LOCAL_DATABASE_PORT,
  maxConnections: MAX_CONNECTIONS,
})

try {
  await server.start()
} catch (error) {
  console.error(
    `Could not start your laptop's database on port ${LOCAL_DATABASE_PORT}: ${error instanceof Error ? error.message : String(error)}`,
  )
  await db.close()
  process.exit(1)
}

console.log(`Your laptop's database is running at ${LOCAL_DATABASE_URL}`)
console.log('Leave this terminal open. Press Ctrl+C to stop it; your data stays in the folder.')

// Ctrl+C, a stop request, or a closed terminal window: stop taking connections, then close the
// database properly so everything it holds is written to the folder.
let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  console.log("Stopping your laptop's database ...")
  try {
    await server.stop()
    await db.close()
  } finally {
    console.log('Stopped. Your data is kept in the folder.')
    process.exit(0)
  }
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, stop)
