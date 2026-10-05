// The build Vercel runs (`npm run build`). Migrations change the LIVE database, so this decides
// whether it is safe to run them BEFORE building the app - never by guessing, always by reading the
// database itself (through the production marker) and comparing it with what Vercel says this
// deployment is. See scripts/lib/decide.mjs for the actual rule.
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { databaseEnvironment } from './lib/databaseEnv.mjs'
import { decideBuild } from './lib/decide.mjs'
import { endpointId } from './lib/endpoint.mjs'
import { readMarker as readMarkerFromDatabase, writeMarker as writeMarkerOnDatabase } from './lib/marker.mjs'
import { reachMessage } from './lib/messages.mjs'
import { migrationEnv } from './lib/migrationEnv.mjs'
import { migrationVerified } from './lib/migrationResult.mjs'
import { seedVerified } from './lib/seedResult.mjs'

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))
const MIGRATION_RUNNER_PATH = fileURLToPath(new URL('./migrate.mjs', import.meta.url))
const SEED_RUNNER_PATH = fileURLToPath(new URL('./seed.mjs', import.meta.url))

const NEXT_BUILD_COMMAND =
  'npx cross-env NODE_OPTIONS="--no-deprecation --max-old-space-size=8000" next build'
// Two minutes is far more than migrations or the seed take; it only stops a build that would
// otherwise hang. The runners' own watchdog (scripts/lib/watchdog.mjs) normally stops them first,
// after 110 seconds, with a clearer message.
const RUNNER_TIME_LIMIT_MS = 120_000

/**
 * The ORDER a given Vercel environment's build runs in - not whether each step actually happens
 * (decideBuild decides that at runtime, from the real database). Exported so a test can check the
 * shape of the pipeline without a database connection.
 */
export function plan(env) {
  if (env === 'production') return ['migrate', 'write-marker', 'seed', 'next build']
  if (env === 'preview') return ['migrate', 'next build']
  return ['next build']
}

/** Runs a shell command, waiting for it to finish. Returns its exit code (never throws on a non-zero one). */
function realRun(command, extraEnv = {}) {
  const result = spawnSync(command, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...extraEnv },
  })
  return result.status ?? 1
}

/**
 * How the build starts a runner (scripts/migrate.mjs or scripts/seed.mjs) on the database at
 * `databaseUrl`. Exported so a test can check it without starting anything.
 *
 * @param {Record<string, string | undefined>} variables the build's own variables (usually process.env)
 * @param {string} databaseUrl
 */
export function runnerOptions(variables, databaseUrl) {
  // The runner reads the address the same way the site does (scripts/lib/databaseEnv.mjs). Give it
  // exactly one: this one, under DATABASE_URL, and no STORAGE_* names (scripts/lib/migrationEnv.mjs).
  const env = migrationEnv(variables, databaseUrl)
  env.NODE_OPTIONS = '--no-deprecation'
  return {
    // From the project folder, so the runner finds the project's files whatever folder the build
    // was started from.
    cwd: PROJECT_ROOT,
    encoding: /** @type {const} */ ('utf8'),
    timeout: RUNNER_TIME_LIMIT_MS,
    // Room for 10 MB of messages. With the default (1 MB), a runner that prints a lot would be stopped
    // halfway, and the build would report a failure that had nothing to do with the database.
    maxBuffer: 10 * 1024 * 1024,
    env,
  }
}

/**
 * The line the build prints when a runner could not finish at all (it was stopped, so it printed no
 * reason itself).
 *
 * @param {string} label MIGRATIONS or SEED
 * @param {Error & { code?: string }} error
 */
export function runnerFailure(label, error) {
  if (error.code === 'ETIMEDOUT') return `${label}: the runner took longer than 2 minutes, so it was stopped.`
  return `${label}: the runner could not finish: ${error.message}`
}

/**
 * Runs one of the two runners on the database at `databaseUrl`, shows its output in the build log,
 * and returns its exit code and output. Whether that counts as success is decided by
 * migrationVerified or seedVerified: exit code 0 alone is not enough.
 */
function runRunner(runnerPath, label, databaseUrl) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', runnerPath], runnerOptions(process.env, databaseUrl))
  process.stdout.write(result.stdout || '')
  process.stderr.write(result.stderr || '')
  if (result.error) process.stderr.write(`${runnerFailure(label, result.error)}\n`)
  return { status: result.status, stdout: result.stdout }
}

const realMigrate = (databaseUrl) => runRunner(MIGRATION_RUNNER_PATH, 'MIGRATIONS', databaseUrl)
const realSeed = (databaseUrl) => runRunner(SEED_RUNNER_PATH, 'SEED', databaseUrl)

/**
 * Runs the production or preview build gate, then `next build`.
 *
 * Every dependency that touches the network or spawns a process (`readMarker`, `writeMarker`,
 * `migrate`, `seed`, `run`) is injectable, defaulting to the real ones - so a test can drive the actual
 * orchestration (what runs, in what order, with which database address, and what happens when a step
 * fails) with fakes, instead of only checking `plan()`'s static shape or hitting a real database and a
 * real `next build`.
 *
 * The two addresses come from `variables` (normally process.env) through scripts/lib/databaseEnv.mjs,
 * which accepts DATABASE_URL or STORAGE_URL. A test can also pass `databaseUrl`/`unpooledUrl` directly.
 *
 * @param {{
 *   env?: string,
 *   variables?: Record<string, string | undefined>,
 *   databaseUrl?: string,
 *   unpooledUrl?: string,
 *   readMarker?: (url: string) => Promise<string | null>,
 *   writeMarker?: (url: string, id: string | null) => Promise<void>,
 *   migrate?: (databaseUrl: string) => { status: number | null, stdout?: string | null },
 *   seed?: (databaseUrl: string) => { status: number | null, stdout?: string | null },
 *   run?: (command: string, extraEnv?: Record<string, string>) => number,
 * }} [options]
 * @returns {Promise<number>} the exit code for the whole build
 */
export async function build({
  env = process.env.VERCEL_ENV ?? 'local',
  variables = process.env,
  databaseUrl,
  unpooledUrl,
  readMarker = readMarkerFromDatabase,
  writeMarker = writeMarkerOnDatabase,
  migrate = realMigrate,
  seed = realSeed,
  run = realRun,
} = {}) {
  if (databaseUrl === undefined && unpooledUrl === undefined) {
    try {
      const addresses = databaseEnvironment(variables)
      databaseUrl = addresses.pooledUrl
      unpooledUrl = addresses.directUrl
    } catch (error) {
      // The same database variable set twice, with two different addresses (for example a
      // DATABASE_URL typed in by hand next to the STORAGE_URL that connecting Neon added).
      console.error(
        `\nDATABASE SET UP WRONG: ${shortReason(error)} In Vercel: Settings → Environment Variables → keep the database variables that connecting Neon added, delete the ones you added yourself, then Redeploy.\n`,
      )
      return 1
    }
  }

  if (env === 'production' || env === 'preview') {
    // Migrations (and the marker) always use the direct address when Vercel provides one - Neon
    // reserves the pooled one for ordinary app traffic, not for schema changes.
    const effectiveUrl = unpooledUrl || databaseUrl

    let marker = null
    if (effectiveUrl) {
      try {
        marker = await readMarker(effectiveUrl)
      } catch (error) {
        // A database that exists but cannot be reached right now (for example Neon still waking
        // up from scale-to-zero, or a typo'd host) must not look like "there is no database at all" -
        // that would send you chasing the wrong fix.
        console.error(reachMessage(shortReason(error)))
        return 1
      }
    }
    // Nothing to read a marker FROM if there is no database at all: decideBuild handles that case
    // itself (it turns into its own "NOT CONFIGURED YET" fatal), but calling readMarker first would
    // just throw trying to connect to an empty connection string.
    const decision = decideBuild({ env, databaseUrl, unpooledUrl, marker })

    if (decision.fatal) {
      // decision.fatal is always a COMPLETE message (its own label, its own fix) - never wrapped in
      // another one here.
      console.error(`\n${decision.fatal}\n`)
      return 1
    }

    console.log(`MIGRATIONS: ${decision.reason}`)

    if (decision.migrate) {
      const migration = migrate(effectiveUrl)
      if (!migrationVerified(migration)) {
        if (env === 'preview') {
          // A broken preview migration must not block the pull request's build - only warn, so the
          // author can still see the rest of the preview and fix the branch from Neon.
          console.error(
            'MIGRATIONS: FAILED ON THE PREVIEW DATABASE (build continues). In Neon: Branches → preview → Reset from parent, then redeploy the preview. See docs/guides/troubleshooting.md#preview-migration-failed.',
          )
        } else {
          // Production: a failed migration must stop the build - building an app against a database
          // that is not on the schema it expects is worse than not deploying at all. "Failed" includes
          // exit code 0 WITHOUT the runner's final check line: that is exactly how the account test's
          // silent non-migration looked.
          console.error(
            'MIGRATIONS: FAILED. The migration step did not confirm that every committed migration is in your live database (see the messages above), so the build stops here: the site would otherwise run without the tables it needs. Fix the error above, then Redeploy.',
          )
          return migration.status ? migration.status : 1
        }
      } else {
        if (decision.writeMarker) {
          try {
            await writeMarker(effectiveUrl, endpointId(effectiveUrl))
          } catch (error) {
            // The migration itself succeeded - the schema is fine - but without the marker, the NEXT
            // preview build cannot tell this database is production. Stopping here (rather than
            // carrying on to the seed and `next build`) makes that visible immediately instead of as a
            // confusing "not running" on some later preview.
            console.error(
              `MIGRATIONS: ran, but could not record which database is the live one: ${shortReason(error)}. Try Redeploy; if it happens again, check the database in Vercel Storage.`,
            )
            return 1
          }
        }
        if (decision.seed) {
          // The seed (scripts/seed.mjs), on the same database the migrations just ran on. It runs on
          // every production build, but adds the example content only once per database: later builds
          // print "SEED: skipped (...)" and change nothing (src/seed/seed.ts). It also creates the first
          // editor account when none exists yet.
          const seeding = seed(effectiveUrl)
          if (!seedVerified(seeding)) {
            // The tables are fine (the migrations finished), but the site would go live without its
            // example content, or with only part of it - better to stop and say so.
            console.error(
              'SEED: FAILED. The seed step did not confirm that it finished (see the messages above), so the build stops here. Your database tables are fine; only the example content (and, on a new site, the first editor account) may be missing. Check FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD in Vercel if the error above mentions them. Fix the error above, then Redeploy.',
            )
            return seeding.status ? seeding.status : 1
          }
        }
      }
    }
  } else {
    console.log(
      process.env.VERCEL_ENV
        ? `MIGRATIONS: not running (VERCEL_ENV=${process.env.VERCEL_ENV})`
        : 'MIGRATIONS: not running (not a Vercel build)',
    )
  }

  return run(NEXT_BUILD_COMMAND)
}

function shortReason(error) {
  return error instanceof Error ? error.message : String(error)
}

// Only runs when this file is executed directly (`node scripts/build.mjs`), never when a test imports it.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await build())
}
