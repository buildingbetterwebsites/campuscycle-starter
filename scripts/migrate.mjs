// Runs the committed migrations (src/migrations) on the database, then CHECKS that each one is really
// recorded there. Used by the Vercel build (scripts/build.mjs), by `npm run migrate` (scripts/guard.mjs)
// and by the tests. Start it as `node --import tsx scripts/migrate.mjs`.
//
// WHY not `payload migrate`: in the account test (28 September 2026) that command ended with exit code 0
// without migrating anything (the TypeScript loader it uses, tsx 4.22.4, can stop it early; see
// github.com/payloadcms/payload/issues/17757). The build said "ran", and the live site had no tables.
// This runner avoids that loader: `--import tsx` loads TypeScript for the whole process instead.
// "await" at the top level of this file also helps: if loading never finishes, Node stops with an error
// (exit code 13) instead of quietly exiting with 0. And the final line, MIGRATIONS_VERIFIED, is printed
// only after the check, so whoever starts this runner can tell "really done" from "stopped early".
import { databaseEnvironment } from './lib/databaseEnv.mjs'
import { NO_DATABASE_ADDRESS } from './lib/messages.mjs'
import { MIGRATIONS_VERIFIED } from './lib/migrationResult.mjs'
import { startWatchdog } from './lib/watchdog.mjs'

// Tell Payload this is a migration, not the website starting up.
process.env.PAYLOAD_MIGRATING = 'true'
// Production mode, so Payload skips its development-only extras on start-up, such as rewriting
// src/payload-types.ts and checking package versions: a migration must change nothing but the database.
process.env.NODE_ENV = 'production'

async function migrate() {
  // With no address at all, the database driver would quietly try a default one on this computer
  // (port 5432), which may be somebody else's database. Stop before connecting to anything.
  const { pooledUrl } = databaseEnvironment(process.env)
  if (!pooledUrl) {
    throw new Error(NO_DATABASE_ADDRESS)
  }

  const { default: payload } = await import('payload')
  const { default: config } = await import('../src/payload.config.ts')
  const { migrations } = await import('../src/migrations/index.ts')
  try {
    // disableOnInit: the website's start-up step (creating the first admin) is not part of a migration.
    await payload.init({ config, disableOnInit: true })
    await payload.db.migrate({ migrations })
    // Payload records every migration it has run in the payload-migrations collection. Read ALL of them
    // (pagination: false; a normal read returns only the first 10) and compare with the committed list.
    const applied = await payload.find({ collection: 'payload-migrations', pagination: false })
    const names = new Set(applied.docs.map((migration) => migration.name))
    const missing = migrations.filter((migration) => !names.has(migration.name))
    if (missing.length) {
      throw new Error(`Migrations not applied: ${missing.map((migration) => migration.name).join(', ')}`)
    }
    console.log(`MIGRATIONS: the database has all ${migrations.length} committed migrations.`)
  } finally {
    // Clean up even after an error. A failing clean-up must not hide the error that matters.
    await payload.destroy().catch(() => {})
  }
}

// A time limit: if the database never answers, stop after 110 seconds with a plain message and exit
// code 1, instead of waiting forever (scripts/lib/watchdog.mjs).
startWatchdog()

try {
  await migrate()
  // Payload 3.90.2 keeps one database connection open even after destroy(), which would keep this
  // process alive forever. So end it ourselves - but only once the marker line has really been
  // written out, or the build could miss it.
  process.stdout.write(`${MIGRATIONS_VERIFIED}\n`, () => process.exit(0))
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`, () => process.exit(1))
}
