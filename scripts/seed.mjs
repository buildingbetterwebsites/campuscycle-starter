// Runs a seed (src/seed/run.ts): the first editor account, and the Campus Cycle example content the
// first time. Then prints SEED_VERIFIED as its very last line. Used by the Vercel build
// (scripts/build.mjs, production only) and by `npm run seed` (scripts/guard.mjs). Start it as
// `node --import tsx scripts/seed.mjs`, or with `--again` to add back example records that were
// deleted (src/seed/seed.ts explains both).
//
// WHY not `payload run src/seed/run.ts`: Payload's own command uses a TypeScript loader that once ended
// a migration with exit code 0 without doing anything (see scripts/migrate.mjs). This runner is built
// the same way as the migration runner, so whoever starts it can tell "really done" (exit code 0 AND
// the final line) from "stopped early".
import { databaseEnvironment } from './lib/databaseEnv.mjs'
import { SEED_VERIFIED } from './lib/seedResult.mjs'
import { SEED_TOO_SLOW_MESSAGE, startWatchdog } from './lib/watchdog.mjs'
import { NO_DATABASE_ADDRESS } from './lib/messages.mjs'

// Production mode, so Payload skips its development-only extras on start-up, such as rewriting
// src/payload-types.ts and checking package versions: the seed must change nothing but the database.
process.env.NODE_ENV = 'production'

// An error whose message says everything: what went wrong and what to do (src/lib/plainError.ts).
function plainError(message) {
  return Object.assign(new Error(message), { name: 'PlainError' })
}

/** The options after `npm run seed --`. Only `--again` exists. */
function readOptions(args) {
  const unknown = args.filter((arg) => arg !== '--again')
  if (unknown.length > 0) {
    throw plainError(
      `Unknown option for the seed: ${unknown.join(' ')}. The only option is --again (npm run seed -- --again), which adds back example records that were deleted.`,
    )
  }
  return { again: args.includes('--again') }
}

async function seed() {
  const { again } = readOptions(process.argv.slice(2))
  // With no address at all, the database driver would quietly try a default one on this computer
  // (port 5432), which may be somebody else's database. Stop before connecting to anything.
  const { pooledUrl } = databaseEnvironment(process.env)
  if (!pooledUrl) {
    throw plainError(NO_DATABASE_ADDRESS)
  }

  const { default: payload } = await import('payload')
  const { default: config } = await import('../src/payload.config.ts')
  const { runSeed } = await import('../src/seed/run.ts')
  try {
    // disableOnInit: runSeed creates the first editor itself, as its first step.
    await payload.init({ config, disableOnInit: true })
    await runSeed(payload, { again })
  } finally {
    // Clean up even after an error. A failing clean-up must not hide the error that matters.
    await payload.destroy().catch(() => {})
  }
}

// What to print for an error. A plain error's message already says what to do, so the long list of code
// lines under it (the stack) would only bury it: that list appears only when DEBUG is set. Any other
// error is unexpected, and its stack is what you need to find the cause.
function describe(error) {
  if (!(error instanceof Error)) return String(error)
  if (error.name === 'PlainError' && !process.env.DEBUG) return error.message
  return error.stack ?? error.message
}

// A time limit: if the seed has not finished after 110 seconds (for example because the database never
// answers), stop with a plain message and exit code 1, instead of waiting forever
// (scripts/lib/watchdog.mjs).
startWatchdog({ message: SEED_TOO_SLOW_MESSAGE })

try {
  await seed()
  // Payload 3.90.2 keeps one database connection open even after destroy(), which would keep this
  // process alive forever. So end it ourselves - but only once the final line has really been
  // written out, or the build could miss it.
  process.stdout.write(`${SEED_VERIFIED}\n`, () => process.exit(0))
} catch (error) {
  process.stderr.write(`${describe(error)}\n`, () => process.exit(1))
}
