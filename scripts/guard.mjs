// Wraps `dev` / `migrate` / `migrate:create` / `seed` on your own computer. Refuses to run any
// of them against a database it can PROVE is the live one (see scripts/lib/decide.mjs's decideLocal),
// so pasting the wrong connection string into .env.local cannot silently touch production.
import { spawn } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
// @next/env is published as CommonJS: under plain (non-bundled) Node ESM, `import { loadEnvConfig }`
// fails at run time ("Named export ... not found") even though editors and Vitest's own transform
// accept it - a bundler quietly papers over the exact gap this script must not have, since you
// run it with plain `node`. Import the module's default export, then destructure, as Payload's own
// CLI does for the same package (node_modules/payload/dist/bin/loadEnv.js).
import nextEnv from '@next/env'
const { loadEnvConfig: loadEnvConfigFromNext } = nextEnv

import { databaseEnvironment } from './lib/databaseEnv.mjs'
import {
  couldNotStartMessage,
  notAcceptingMessage,
  notOursMessage,
  nothingAnswersMessage,
  reachMessage,
  STARTED_LAPTOP_DATABASE,
  STOPPED_EARLY_EXIT_CODE,
  stoppedEarlyMessage,
} from './lib/messages.mjs'
import { answers, isLaptopDatabase, localAddress } from './lib/localDatabase.mjs'
import { databaseProblem, ensureLaptopDatabase, NOT_OURS } from './lib/laptopDatabase.mjs'
import { migrationEnv } from './lib/migrationEnv.mjs'
import { endpointId } from './lib/endpoint.mjs'
import { decideLocal } from './lib/decide.mjs'
import { readMarker as readMarkerFromDatabase } from './lib/marker.mjs'
import { migrationVerified } from './lib/migrationResult.mjs'
import { seedVerified } from './lib/seedResult.mjs'

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))
const MIGRATION_RUNNER_PATH = fileURLToPath(new URL('./migrate.mjs', import.meta.url))
const SEED_RUNNER_PATH = fileURLToPath(new URL('./seed.mjs', import.meta.url))

// NODE_OPTIONS=--no-deprecation hides Node's deprecation warnings that Payload's own tools print;
// cross-env sets that environment variable the same way on Windows, macOS and Linux.
// `migrate` and `seed` are not in this list: they run scripts/migrate.mjs and scripts/seed.mjs
// instead of Payload's own commands (see runRunner below).
const COMMANDS = {
  dev: 'npx cross-env NODE_OPTIONS=--no-deprecation next dev',
  'migrate:create': 'npx cross-env NODE_OPTIONS=--no-deprecation payload migrate:create',
}
const KNOWN_COMMANDS = new Set([...Object.keys(COMMANDS), 'migrate', 'seed'])
// Only these three commands need a database address just to start, and it must be the ordinary
// (pooled) one, DATABASE_URL or STORAGE_URL: that is the one the site and both runners connect with.
// A direct (_UNPOOLED) address on its own is not enough. `dev` can still be useful to look at without
// one (and next/Payload will fail on their own, with their own message, if it truly cannot start), so
// it is left out here on purpose.
const COMMANDS_NEEDING_A_DATABASE = new Set(['migrate', 'migrate:create', 'seed'])

/**
 * Is it safe to touch the database named by `databaseUrl`? Takes the marker reader as a parameter
 * (defaulting to the real one, over `pg`) so a test can call this without a database.
 */
export async function check({ databaseUrl, readMarker = readMarkerFromDatabase }) {
  const ownId = endpointId(databaseUrl)
  // Only a Neon database can ever carry the marker: skip the (network) read entirely for anything
  // else, rather than trying to open a connection decideLocal would allow regardless.
  const marker = ownId ? await readMarker(databaseUrl) : null
  return decideLocal({ databaseUrl, marker })
}

/**
 * Runs one command line, forwarding Ctrl+C (SIGINT), SIGTERM, and SIGHUP to it, and resolves with its
 * exit code once it is actually gone.
 *
 * `next dev` is not a single process: the shell this spawns runs `npx`, which runs `cross-env`, which
 * runs `next`, which itself starts further workers. On Windows, killing only the process Node spawned
 * directly leaves those deeper ones running (and the port still listening) even after the guard exits
 * - Windows has no real process groups or POSIX signals for `child.kill()` to rely on, so this asks
 * Windows to kill the whole tree instead (`taskkill /T`). On POSIX, spawning the command into its own
 * process group and signalling the group (the negative pid) reaches the same descendants - and SIGHUP
 * (a closed terminal, not just Ctrl+C or a manual SIGTERM) is forwarded the same way, otherwise closing
 * the terminal window kills the guard but leaves `next dev` behind, still holding the port.
 */
function runCommand(commandLine) {
  return new Promise((resolve) => {
    const child = spawn(commandLine, {
      stdio: 'inherit',
      shell: true,
      detached: process.platform !== 'win32',
    })

    let stopping = false
    const stop = (signal) => {
      if (stopping || child.exitCode !== null || child.pid === undefined) return
      stopping = true
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
      } else {
        try {
          process.kill(-child.pid, signal)
        } catch {
          child.kill(signal)
        }
      }
    }
    const onSignal = (signal) => () => stop(signal)
    const handlers = [
      ['SIGINT', onSignal('SIGINT')],
      ['SIGTERM', onSignal('SIGTERM')],
      ['SIGHUP', onSignal('SIGHUP')],
    ]
    for (const [name, handler] of handlers) process.on(name, handler)

    child.on('exit', (code, signal) => {
      for (const [name, handler] of handlers) process.off(name, handler)
      resolve(code ?? (signal ? 130 : 1))
    })
  })
}

/**
 * How `npm run migrate` and `npm run seed` start their runner. Exported so a test can check it without
 * starting anything.
 *
 * @param {Record<string, string | undefined>} variables usually process.env
 */
export function runnerSpawnOptions(variables) {
  return {
    // The runner's output is read here (to look for its final line) and passed on; its messages and
    // errors go straight to your terminal.
    stdio: /** @type {['inherit', 'pipe', 'inherit']} */ (['inherit', 'pipe', 'inherit']),
    // From the project folder, so the runner finds the project's files (and saves uploaded images in
    // the project's media folder) whatever folder the command was started from.
    cwd: PROJECT_ROOT,
    env: { ...variables, NODE_OPTIONS: '--no-deprecation' },
  }
}

/**
 * `npm run migrate` and `npm run seed`: runs scripts/migrate.mjs or scripts/seed.mjs, shows its output
 * as it comes, and returns its exit code and output. Success needs exit code 0 AND the runner's final
 * check line (migrationVerified / seedVerified). WHY not Payload's own `payload migrate` and `payload
 * run`: one of them once ended with "success" without doing anything - see scripts/migrate.mjs.
 *
 * @param {string} runnerPath
 * @param {string[]} [args] options for the runner, such as `--again` for the seed
 * @param {Record<string, string | undefined>} [variables] the runner's environment variables
 * @returns {Promise<{ status: number | null, stdout: string }>}
 */
function runRunner(runnerPath, args = [], variables = process.env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--import', 'tsx', runnerPath, ...args], runnerSpawnOptions(variables))
    // Ctrl+C or a closed terminal: pass it on to the runner and wait until it has stopped, instead of
    // this process ending at once. When this process hosts your laptop's database, run() then still
    // closes it properly (scripts/lib/laptopDatabase.mjs), so its data is written to the folder.
    const handlers = ['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) => [signal, () => child.kill(signal)])
    for (const [signal, handler] of handlers) process.on(signal, handler)
    const done = (result) => {
      for (const [signal, handler] of handlers) process.off(signal, handler)
      resolve(result)
    }
    let stdout = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
      process.stdout.write(chunk)
    })
    child.on('error', (error) => {
      console.error(`Could not start ${runnerPath}: ${error.message}`)
      done({ status: 1, stdout })
    })
    child.on('close', (status) => done({ status, stdout }))
  })
}

const runMigration = (variables) => runRunner(MIGRATION_RUNNER_PATH, [], variables)
// `npm run seed -- --again` reaches the seed runner as its own option (scripts/seed.mjs).
const runSeed = (args) => runRunner(SEED_RUNNER_PATH, args)

/**
 * Two different database addresses under the two names (scripts/lib/databaseEnv.mjs): say which two
 * lines they are, and that one of them has to go.
 */
function conflictMessage(error) {
  const reason = error instanceof Error ? error.message : String(error)
  const names = /** @type {{ names?: string[] }} */ (error).names
  if (!names) return `${reason} Fix .env.local, then try again.`
  return `${reason} In .env.local: delete one of the two lines (${names[0]} or ${names[1]}) so only one database address is left, then try again.`
}

function unreachable(error) {
  return reachMessage(error instanceof Error ? error.message : String(error))
}

/**
 * Runs the given guard subcommand. Exported so a test can call it without spawning a process.
 *
 * `loadEnv`, `readMarker`, `answersAt`, `ensureDatabase`, `checkDatabase`, `migrate`, `seed` and `command` are
 * injectable (all default to the real ones) so a test can run this without loading the developer's own
 * real `.env`/`.env.local` files, opening a database connection, starting your laptop's database or
 * starting the migration or seed runner or `next dev`. `loadEnv`'s return value is never
 * used, so its type here is looser than `loadEnvConfigFromNext`'s real one - any function accepting
 * `(dir, dev)` will do, which is all a test's stub needs to satisfy.
 *
 * @param {string[]} argv
 * @param {{
 *   loadEnv?: (dir: string, dev?: boolean) => unknown,
 *   readMarker?: (url: string) => Promise<string | null>,
 *   answersAt?: (address: { host: string, port: number }) => Promise<boolean>,
 *   ensureDatabase?: () => Promise<{ started: boolean, stop: () => Promise<void> }>,
 *   checkDatabase?: (url: string) => Promise<string | null>,
 *   command?: (commandLine: string) => Promise<number>,
 *   migrate?: (variables: Record<string, string | undefined>) => Promise<{ status: number | null, stdout?: string | null }>,
 *   seed?: (args: string[]) => Promise<{ status: number | null, stdout?: string | null }>,
 * }} [deps]
 */
export async function run(
  argv,
  {
    loadEnv = loadEnvConfigFromNext,
    readMarker,
    answersAt = answers,
    ensureDatabase = ensureLaptopDatabase,
    checkDatabase = databaseProblem,
    migrate = runMigration,
    seed = runSeed,
    command: runCommandLine = runCommand,
  } = {},
) {
  // The same files Next.js itself reads, and in the same DEVELOPMENT order Next's own dev server and
  // Payload's CLI use (.env.development.local > .env.local > .env.development > .env) - the second
  // argument, `true`, is what selects that order; without it, loadEnvConfig loads PRODUCTION order
  // instead, which can read a different DATABASE_URL than `next dev` itself will.
  loadEnv(process.cwd(), true)

  const [command, ...rest] = argv
  if (!KNOWN_COMMANDS.has(command)) {
    console.error(`Unknown guard command: ${command ?? '(none)'}. Expected one of: dev, migrate, migrate:create, seed.`)
    return 1
  }

  // The database's address, read the same way the site itself reads it: DATABASE_URL, or the
  // STORAGE_URL name that Vercel's Neon connection can create (scripts/lib/databaseEnv.mjs).
  let addresses
  try {
    addresses = databaseEnvironment(process.env)
  } catch (error) {
    console.error(`REFUSED: ${conflictMessage(error)}`)
    return 1
  }

  if (COMMANDS_NEEDING_A_DATABASE.has(command) && !addresses.pooledUrl) {
    console.error(
      `REFUSED: no DATABASE_URL (or STORAGE_URL) is set, so there is no database for \`npm run ${command}\` to work on. Copy .env.example to .env.local if you have not yet, then remove the # in front of its DATABASE_URL line: that is your laptop's database, which starts by itself — see docs/guides/local-setup.md.`,
    )
    return 1
  }

  // Every command that could touch a database - including `seed` - goes through the same guard
  // FIRST. It used to dispatch `seed` before this check ran at all, which meant a live database's
  // connection string in .env.local was never actually checked for `npm run seed`.
  // Check every address that is set (the pooled one and, if it is different, the direct one): if any
  // of them is the live database, refuse.
  for (const databaseUrl of new Set([addresses.pooledUrl, addresses.directUrl].filter(Boolean))) {
    let decision
    try {
      decision = await check({ databaseUrl, ...(readMarker ? { readMarker } : {}) })
    } catch (error) {
      console.error(unreachable(error))
      return 1
    }
    if (!decision.allowed) {
      console.error(
        `REFUSED: ${decision.reason} Never use it on your laptop: in .env.local, use your laptop's own database instead (the DATABASE_URL line from .env.example) — see docs/guides/local-setup.md.`,
      )
      return 1
    }
  }

  // An address on this computer itself. Your laptop's database (the DATABASE_URL line from
  // .env.example): use it when this project's own database already answers (another terminal of this
  // project runs `npm run dev` or `npm run db`), otherwise start it here, for as long as this command
  // runs. Another copy's database at that address is refused. Any other address on this computer is
  // not the starter's own: only check that something answers there, so the student reads one line
  // instead of a long connection error from deep inside Payload. (The live database is never on this
  // computer, so the refusal above, which always runs first, does not depend on any of this.)
  let started = null
  for (const databaseUrl of new Set([addresses.pooledUrl, addresses.directUrl].filter(Boolean))) {
    const address = localAddress(databaseUrl)
    if (!address) continue
    if (isLaptopDatabase(databaseUrl)) {
      if (started) continue
      try {
        const database = await ensureDatabase()
        if (database.started) {
          started = database
          console.log(STARTED_LAPTOP_DATABASE)
        }
      } catch (error) {
        // Another copy's database answers there: never use it (its data is another project's).
        if (/** @type {{ code?: string }} */ (error).code === NOT_OURS) console.error(notOursMessage(address))
        else console.error(couldNotStartMessage(address, error instanceof Error ? error.message : String(error)))
        return 1
      }
      // It answers, but does it take a connection and answer a query? If not, say so now, instead of
      // letting the command wait for an answer that never comes.
      const problem = await checkDatabase(databaseUrl)
      if (problem) {
        console.error(notAcceptingMessage(address, problem))
        await started?.stop()
        return 1
      }
    } else if (!(await answersAt(address))) {
      console.error(nothingAnswersMessage(address))
      return 1
    }
  }

  try {
    return await runGuarded(command, rest, addresses, { migrate, seed, runCommandLine })
  } finally {
    // Started here: close it properly, so everything is written to its folder (.data/db).
    await started?.stop()
  }
}

/** The command itself, once the guard has allowed it (and your laptop's database answers). */
async function runGuarded(command, rest, addresses, { migrate, seed, runCommandLine }) {
  if (command === 'seed') {
    const seeding = await seed(rest)
    if (seeding.status === STOPPED_EARLY_EXIT_CODE) {
      console.error(stoppedEarlyMessage('seed'))
      return 1
    }
    if (!seedVerified(seeding)) {
      console.error(
        'SEED: FAILED. The seed did not confirm that it finished. Read the error above, fix it, then run `npm run seed` again: it creates only what is still missing.',
      )
      return seeding.status ? seeding.status : 1
    }
    return 0
  }

  if (command === 'migrate') {
    // Migrations run over the direct address when there is one (DATABASE_URL_UNPOOLED or
    // STORAGE_URL_UNPOOLED), as the Vercel build does: a migration's long transaction does not belong
    // on the pooled connection. The runner gets exactly that one address (scripts/lib/migrationEnv.mjs).
    const migration = await migrate(migrationEnv(process.env, addresses.directUrl || addresses.pooledUrl))
    if (migration.status === STOPPED_EARLY_EXIT_CODE) {
      console.error(stoppedEarlyMessage('migrate'))
      return 1
    }
    if (!migrationVerified(migration)) {
      console.error(
        'MIGRATIONS: FAILED. The migration step did not confirm that every committed migration is in your database. Read the error above, fix it, then run `npm run migrate` again.',
      )
      return migration.status ? migration.status : 1
    }
    return 0
  }

  const base = COMMANDS[command]
  const commandLine = rest.length > 0 ? `${base} ${rest.join(' ')}` : base
  return runCommandLine(commandLine)
}

// Only runs when this file is executed directly (`node scripts/guard.mjs <command>`), never when a test imports it.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await run(process.argv.slice(2)))
}
