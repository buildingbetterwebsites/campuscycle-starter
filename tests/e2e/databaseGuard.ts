// The browser checks write to the database they are given: they make a test clinic with time slots
// and bookings, and the error-page check renames the clinics table for a moment. That must never
// happen to a real site's data. So before anything is written (tests/e2e/fixture.ts), this decides:
//   - never the live database: the same check `npm run dev` and `npm run migrate` use
//     (check() in scripts/guard.mjs, which reads the live-database marker);
//   - only a database on this computer (127.0.0.1 or localhost), as in CI, unless you say on purpose
//     that a remote test database is fine: E2E_ALLOW_REMOTE=1.
// The refusal names only the database's host, never its password.
import { check } from '../../scripts/guard.mjs'
import { databaseEnvironment } from '../../scripts/lib/databaseEnv.mjs'

type ReadMarker = (url: string) => Promise<string | null>

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])

/** Why the browser checks may not write to this database, or null when they may. */
export async function e2eDatabaseProblem(
  databaseUrl: string | undefined,
  env: Record<string, string | undefined>,
  readMarker?: ReadMarker,
): Promise<string | null> {
  if (!databaseUrl) return 'REFUSED: DATABASE_URL (or STORAGE_URL) is not set. Set it to the database of the site under test (a local or throwaway one).'
  let host: string
  try {
    host = new URL(databaseUrl).hostname.toLowerCase()
  } catch {
    return 'REFUSED: DATABASE_URL is not a database address the browser checks can read.'
  }
  let decision: { allowed: boolean }
  try {
    decision = await check({ databaseUrl, ...(readMarker ? { readMarker } : {}) })
  } catch {
    return `REFUSED: could not reach the database at ${host} to check that it is not the live one.`
  }
  if (!decision.allowed) {
    return `REFUSED: the database at ${host} is the live site's database. The browser checks write test records; run them against a local or throwaway database.`
  }
  if (!LOCAL_HOSTS.has(host) && env.E2E_ALLOW_REMOTE !== '1') {
    return `REFUSED: the database at ${host} is not on this computer. The browser checks write test records (and rename a table for a moment). If this really is a throwaway test database, set E2E_ALLOW_REMOTE=1 and run them again.`
  }
  return null
}

/**
 * The same, for the database the site itself uses: read the way src/payload.config.ts reads it, under
 * DATABASE_URL or under STORAGE_URL (scripts/lib/databaseEnv.mjs), so a set-up with only STORAGE_URL
 * works too.
 */
export async function e2eSiteDatabaseProblem(env: Record<string, string | undefined>, readMarker?: ReadMarker): Promise<string | null> {
  let databaseUrl: string
  try {
    databaseUrl = databaseEnvironment(env).pooledUrl
  } catch (error) {
    return `REFUSED: ${error instanceof Error ? error.message : String(error)}`
  }
  return e2eDatabaseProblem(databaseUrl || undefined, env, readMarker)
}
