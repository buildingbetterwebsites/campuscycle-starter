// The decision logic for the two places that could touch the live database: the Vercel build
// (decideBuild, for production and preview deployments) and your own computer (decideLocal,
// for `npm run dev` / `migrate` / `migrate:create` / `seed`). Both functions only DECIDE - they never
// touch a file or the network (no `.env` reads, no database connections) - so they can be
// unit-tested directly. scripts/build.mjs and scripts/guard.mjs do the actual I/O and call these to
// decide what is safe.
import { endpointId } from './endpoint.mjs'

// Every fatal message below is a COMPLETE, self-contained line - it carries its own label ("NOT
// CONFIGURED YET:", "DATABASE SET UP WRONG:", "STOPPED:") because the three situations are different
// (missing, misconfigured, dangerous) and one blanket prefix does not fit all of them. build.mjs and
// guard.mjs print `decision.fatal` as-is, without adding anything.
const NO_DATABASE_MESSAGE_PRODUCTION =
  'NOT CONFIGURED YET: there is no database. In Vercel: Storage → connect Neon (Postgres) to this project, then Redeploy.'
const NO_DATABASE_MESSAGE_PREVIEW =
  'NOT CONFIGURED YET: this preview has no database of its own. Connecting Neon to Production only (the usual first deploy) does not cover previews - see docs/guides/local-setup.md for giving previews their own database, then redeploy this preview.'
const SHORT_SECRET_MESSAGE =
  'NOT CONFIGURED YET: PAYLOAD_SECRET is missing or shorter than 32 characters. In Vercel: Settings → Environment Variables → add PAYLOAD_SECRET (32 or more characters), then Redeploy.'
const NOT_NEON_PRODUCTION_MESSAGE =
  'NOT CONFIGURED YET: the live database must be a Neon database connected through Vercel Storage. In Vercel: Storage → connect Neon (Postgres) to this project (not a different kind of database), then Redeploy.'
const MISMATCH_MESSAGE =
  "DATABASE SET UP WRONG: your database has two addresses (DATABASE_URL and DATABASE_URL_UNPOOLED, or STORAGE_URL and STORAGE_URL_UNPOOLED) that point at different databases. In Vercel: Storage → your Neon database → disconnect it from this project, connect it again, then Redeploy."
const PREVIEW_IS_LIVE_MESSAGE =
  "STOPPED: this preview is connected to your LIVE database, so anything done on the preview would change your real site. In Vercel: Settings → Environment Variables → make sure DATABASE_URL and DATABASE_URL_UNPOOLED (or STORAGE_URL and STORAGE_URL_UNPOOLED) for Preview are your preview branch's, not Production's (docs/guides/local-setup.md explains the preview branch), then redeploy."

/**
 * Should the Vercel build run migrations, write the production marker, and run the seed?
 *
 * `env` is Vercel's own `VERCEL_ENV` value ("production" or "preview" - anything else is treated as
 * neither, and never migrates: scripts/build.mjs only calls this for those two).
 *
 * `marker` is whatever `readMarker` already found in the connected database (or `null` if there is
 * none yet) - this function never reads it itself.
 *
 * `reason` is always the COMPLETE text to print after "MIGRATIONS: " (it already starts with
 * "running" or "not running" - build.mjs does not add that itself, so each case can explain itself
 * in its own words).
 *
 * @param {{ env: string | undefined, databaseUrl: string | undefined, unpooledUrl: string | undefined, marker: string | null, secret?: string | undefined }} args
 * @returns {{ migrate: boolean, writeMarker: boolean, seed: boolean, reason: string, fatal?: string }}
 */
export function decideBuild({ env, databaseUrl, unpooledUrl, marker, secret = process.env.PAYLOAD_SECRET }) {
  const refuse = (reason) => ({ migrate: false, writeMarker: false, seed: false, reason })
  const fatal = (message) => ({ migrate: false, writeMarker: false, seed: false, reason: '', fatal: message })

  if (env !== 'production' && env !== 'preview') {
    return refuse(`not running (not building for a live environment: VERCEL_ENV=${env ?? '(none)'})`)
  }
  if (!databaseUrl) {
    return fatal(env === 'production' ? NO_DATABASE_MESSAGE_PRODUCTION : NO_DATABASE_MESSAGE_PREVIEW)
  }
  if ((secret ?? '').length < 32) {
    return fatal(SHORT_SECRET_MESSAGE)
  }

  const ownId = endpointId(databaseUrl)
  // Neon always gives a project both a pooled and a direct address; when only one is set (unusual,
  // but not itself a fault) migrations fall back to the pooled one, so this compares that same
  // effective address against itself and never flags a false mismatch.
  const effectiveUnpooledUrl = unpooledUrl || databaseUrl
  const unpooledId = endpointId(effectiveUnpooledUrl)
  if (unpooledUrl && ownId !== unpooledId) {
    // The two addresses were meant to name the same database. If they do not, migrating over one
    // while the running app reads the other would be worse than not migrating at all - stop instead.
    return fatal(MISMATCH_MESSAGE)
  }

  if (env === 'production') {
    if (ownId === null) {
      // DATABASE_URL is set, matches DATABASE_URL_UNPOOLED (or there is no second address), but is
      // not shaped like a Neon host at all. Catch this NOW: migrating and then trying to write the
      // marker would fail with a confusing "endpoint text not null" database error AFTER the schema
      // had already changed, instead of before anything ran.
      return fatal(NOT_NEON_PRODUCTION_MESSAGE)
    }
    // Production always migrates and re-records its own marker, whatever that marker currently says:
    // the marker exists to tell OTHER environments (previews, your own computer) whether they are
    // looking at production, not to gate production against itself.
    return { migrate: true, writeMarker: true, seed: true, reason: 'running (the production database)' }
  }

  // Preview: migrate ONLY when the marker proves this branch is a copy of production. Never on a
  // missing marker (an unproven, possibly-empty database), and never when the marker names this exact
  // endpoint (a preview environment variable pointed at the live database by mistake - that is not
  // just "do not migrate", it is dangerous enough to stop the build outright).
  if (ownId === null) {
    return refuse(
      'not running on this preview (its database is not a Neon database, so this starter cannot tell whether it is a safe copy; previews should use your Neon preview branch — see docs/guides/local-setup.md).',
    )
  }
  if (marker === ownId) {
    return fatal(PREVIEW_IS_LIVE_MESSAGE)
  }
  if (marker === null) {
    return refuse(
      'not running on this preview (its database is not a copy of your live one yet; this is normal before your first production deploy, see docs/guides/troubleshooting.md#preview-not-migrated).',
    )
  }
  return { migrate: true, writeMarker: false, seed: false, reason: 'running (a proven copy of production)' }
}

/**
 * May a local command (`dev`, `migrate`, `migrate:create`, `seed`) touch the connected database?
 *
 * Refused only when this can be PROVEN to be the live database: its own marker (already read by the
 * caller) names its own endpoint. Anything else - a database with no marker, a marker naming some
 * other endpoint, or a host that is not Neon at all - is allowed, because none of those can be shown
 * to be production.
 */
export function decideLocal({ databaseUrl, marker }) {
  const ownId = endpointId(databaseUrl)
  if (ownId !== null && marker === ownId) {
    return { allowed: false, reason: `This is the live database (its database id is ${ownId}).` }
  }
  return { allowed: true, reason: 'not the live database' }
}
