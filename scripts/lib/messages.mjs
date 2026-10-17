// Messages that more than one script prints, written once so they never drift apart.

/** The build and `npm run dev`/`migrate`/`seed` could not reach the database to read its marker. */
export function reachMessage(reason) {
  return `Could not reach your database to check which one it is: ${reason}. Check DATABASE_URL in .env.local (or in Vercel), then try again.`
}

/** The migration and seed runners were started without any database address. */
export const NO_DATABASE_ADDRESS = 'No database address: set DATABASE_URL (or STORAGE_URL) to your database, then try again.'

/**
 * `npm run dev`/`migrate`/`seed` with a database address on this computer, where nothing answers: the
 * student has not started their laptop's database (`npm run db`, scripts/db.mjs).
 *
 * @param {{ host: string, port: number }} address
 */
export function notRunningMessage({ host, port }) {
  return `NOT RUNNING: nothing answers at ${host}:${port}, the database address in .env.local. Your laptop's database is not running: open a second terminal in this project's folder, run \`npm run db\` there and leave it open. Then try again.`
}
