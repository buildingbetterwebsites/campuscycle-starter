// Messages that more than one script prints, written once so they never drift apart.

/** The build and `npm run dev`/`migrate`/`seed` could not reach the database to read its marker. */
export function reachMessage(reason) {
  return `Could not reach your database to check which one it is: ${reason}. Check DATABASE_URL in .env.local (or in Vercel), then try again.`
}

/** The migration and seed runners were started without any database address. */
export const NO_DATABASE_ADDRESS = 'No database address: set DATABASE_URL (or STORAGE_URL) to your database, then try again.'
