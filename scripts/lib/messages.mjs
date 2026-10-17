// Messages that more than one script prints, written once so they never drift apart.

/** The build and `npm run dev`/`migrate`/`seed` could not reach the database to read its marker. */
export function reachMessage(reason) {
  return `Could not reach your database to check which one it is: ${reason}. Check DATABASE_URL in .env.local (or in Vercel), then try again.`
}

/** The migration and seed runners were started without any database address. */
export const NO_DATABASE_ADDRESS = 'No database address: set DATABASE_URL (or STORAGE_URL) to your database, then try again.'

/**
 * `npm run dev`/`migrate`/`migrate:create`/`seed` started your laptop's database themselves
 * (scripts/lib/laptopDatabase.mjs), because nothing answered at its address yet.
 */
export const STARTED_LAPTOP_DATABASE = "Started your laptop's database (data in .data/db); it stops when this command stops."

/**
 * Your laptop's database did not answer, and starting it failed.
 *
 * @param {{ host: string, port: number }} address
 * @param {string} reason
 */
export function couldNotStartMessage({ host, port }, reason) {
  return `NOT RUNNING: your laptop's database could not start at ${host}:${port}: ${reason}. Fix that, then try again.`
}

/**
 * This project's laptop database answers at its address, but takes no connection or never answers a
 * query (scripts/lib/laptopDatabase.mjs databaseProblem).
 *
 * @param {{ host: string, port: number }} address
 * @param {string} reason
 */
export function notAcceptingMessage({ host, port }, reason) {
  return `NOT RUNNING: your laptop's database at ${host}:${port} takes no connections (${reason}). If \`npm run dev\` runs in another terminal, stop it there with Ctrl+C and start it again. Then try again.`
}

/**
 * A runner (scripts/migrate.mjs, scripts/seed.mjs) stopped without finishing and without an error of
 * its own: Node ended it with exit code 13 ("unsettled top-level await"), because it was left waiting
 * for something that could no longer come, most often its database connection.
 */
export const STOPPED_EARLY_EXIT_CODE = 13

/** @param {'migrate' | 'seed'} command */
export function stoppedEarlyMessage(command) {
  return command === 'migrate'
    ? 'MIGRATIONS: FAILED. The migration stopped halfway without an error of its own: it lost its connection to the database, or never got one. If `npm run dev` runs in another terminal, stop it there with Ctrl+C and start it again. Then run `npm run migrate` again: it only runs what is still missing.'
    : 'SEED: FAILED. The seed stopped halfway without an error of its own: it lost its connection to the database, or never got one. If `npm run dev` runs in another terminal, stop it there with Ctrl+C and start it again. Then run `npm run seed` again: it only creates what is still missing.'
}

/**
 * Something answers at your laptop's database's address, but this project did not start it: most
 * likely another copy of the starter (scripts/lib/laptopDatabase.mjs, "ONLY ITS OWN").
 *
 * @param {{ host: string, port: number }} address
 */
export function notOursMessage({ host, port }) {
  return `NOT YOURS: another program answers at ${host}:${port}, most likely the laptop database of another copy of this starter (another project folder) that is still running. Stop it there (Ctrl+C in that terminal), then try again here.`
}

/**
 * A database address on this computer that is not your laptop's database (another port), where nothing
 * answers. The starter does not start that one: it is not its own.
 *
 * @param {{ host: string, port: number }} address
 */
export function nothingAnswersMessage({ host, port }) {
  return `NOT RUNNING: nothing answers at ${host}:${port}, the database address in .env.local. Start that database, or use your laptop's own database instead (the DATABASE_URL line from .env.example). Then try again.`
}
