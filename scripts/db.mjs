// `npm run db`: starts your laptop's database in its own terminal and keeps it running until you press
// Ctrl+C. You do not need it: `npm run dev`, `npm run migrate` and `npm run seed` start the database by
// themselves when it is not running yet. Use it when you want the database to keep running on its own,
// for example while you restart `npm run dev` often.
//
// It is PGlite: a real Postgres that runs inside Node, so you need no account and no installed
// database. Its data is kept in the folder .data/db inside this project (git leaves it out). It starts
// the same way, with the same code, as the commands above (scripts/lib/laptopDatabase.mjs).
import process from 'node:process'

import { ensureLaptopDatabase, NOT_OURS } from './lib/laptopDatabase.mjs'
import { answers, LOCAL_DATABASE_FOLDER, LOCAL_DATABASE_HOST, LOCAL_DATABASE_PORT, LOCAL_DATABASE_URL } from './lib/localDatabase.mjs'
import { notOursMessage } from './lib/messages.mjs'

const ALREADY_RUNNING = `Your laptop's database is already running (another terminal's \`npm run db\` or \`npm run dev\` of this project). Use that one.`

const address = { host: LOCAL_DATABASE_HOST, port: LOCAL_DATABASE_PORT }

// When something answers already, ensureLaptopDatabase decides whose it is: this project's own (used,
// so this says it is already running) or another copy's (refused).
if (!(await answers(address))) console.log(`Starting your laptop's database (its data is kept in ${LOCAL_DATABASE_FOLDER}) ...`)

let database
try {
  database = await ensureLaptopDatabase()
} catch (error) {
  if (/** @type {{ code?: string }} */ (error).code === NOT_OURS) console.error(notOursMessage(address))
  else console.error(`Could not start your laptop's database: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
if (!database.started) {
  console.error(ALREADY_RUNNING)
  process.exit(1)
}

console.log(`Your laptop's database is running at ${LOCAL_DATABASE_URL}`)
console.log('Leave this terminal open. Press Ctrl+C to stop it; your data stays in the folder.')

// Ctrl+C, a stop request, or a closed terminal window: close the database properly, so everything it
// holds is written to the folder.
let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  console.log("Stopping your laptop's database ...")
  try {
    await database.stop()
  } finally {
    console.log('Stopped. Your data is kept in the folder.')
    process.exit(0)
  }
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, stop)
