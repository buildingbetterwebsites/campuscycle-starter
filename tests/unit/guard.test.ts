import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { check, run as runGuard, runnerSpawnOptions } from '../../scripts/guard.mjs'
import { answers, LOCAL_DATABASE_URL, localAddress } from '../../scripts/lib/localDatabase.mjs'
import { MIGRATIONS_VERIFIED } from '../../scripts/lib/migrationResult.mjs'
import { SEED_VERIFIED } from '../../scripts/lib/seedResult.mjs'

// The guard checks that your laptop's database takes a connection before it runs anything. These tests
// never connect to a real database: the check says it works, unless a test says otherwise.
const run = (argv: string[], deps: Parameters<typeof runGuard>[1] = {}) => runGuard(argv, { checkDatabase: async () => null, ...deps })

// What the seed runner returns when it really finished: exit code 0 AND its own final line.
const seeded = async () => ({ status: 0, stdout: `SEED: created 20, kept 0\n${SEED_VERIFIED}\n` })

// check() takes an injectable marker reader so this can run without a real database - it is the same
// decideLocal rule tests/unit/decide.test.ts already covers in full, exercised here through guard.mjs's
// own wiring (endpointId -> readMarker -> decideLocal).
describe('guard check', () => {
  it('refuses when the connected database\'s own marker names its own endpoint', async () => {
    const decision = await check({
      databaseUrl: 'postgres://u:p@ep-live-1.eu-central-1.aws.neon.tech/db',
      readMarker: async () => 'ep-live-1',
    })
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toContain('This is the live database')
  })

  it('allows a database with no marker in it', async () => {
    const decision = await check({
      databaseUrl: 'postgres://u:p@ep-mine-1.eu-central-1.aws.neon.tech/db',
      readMarker: async () => null,
    })
    expect(decision.allowed).toBe(true)
  })

  it('allows a non-Neon host without ever calling the marker reader', async () => {
    let called = false
    const decision = await check({
      databaseUrl: 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
      readMarker: async () => {
        called = true
        return 'ep-live-1'
      },
    })
    expect(decision.allowed).toBe(true)
    expect(called).toBe(false)
  })
})

// `run()` calls `loadEnvConfig` for real by default, which would read the developer's own actual
// `.env`/`.env.local` on their machine. Every test below stubs it out with a no-op, so the test
// worker's real files (if any exist on whoever's machine runs the suite) are never touched.
const noLoadEnv = () => {}
// The 127.0.0.1 addresses below stand for your laptop's database; `up` says something answers there,
// so these tests never open a real connection. The test at the end of 'guard run()' covers the
// opposite: nothing answers.
const up = async () => true

const DATABASE_NAMES = ['DATABASE_URL', 'DATABASE_URL_UNPOOLED', 'STORAGE_URL', 'STORAGE_URL_UNPOOLED'] as const

describe('guard run()', () => {
  const original = Object.fromEntries(DATABASE_NAMES.map((name) => [name, process.env[name]]))

  // The STORAGE_* names must start empty in every test, whatever the machine running the tests has set.
  beforeEach(() => {
    delete process.env.DATABASE_URL_UNPOOLED
    delete process.env.STORAGE_URL
    delete process.env.STORAGE_URL_UNPOOLED
  })

  // Restore exactly what was there before, including "nothing" - assigning
  // `undefined` to a process.env property stringifies it to the literal text "undefined" instead of
  // removing the key, which would leave DATABASE_URL looking set to later tests.
  afterEach(() => {
    for (const name of DATABASE_NAMES) {
      if (original[name] === undefined) delete process.env[name]
      else process.env[name] = original[name]
    }
  })

  // Every test below reaches at least one `console.log('SEED: ...')` - silence it here rather than in
  // each test; the one test that cares what was logged still grabs `log` to assert on it.
  let log: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    log = vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    log.mockRestore()
  })

  it('npm run seed runs the seed runner once check() allows it, and succeeds only with its final line', async () => {
    // A non-Neon host (like the shared PGlite test database): check() allows it without a marker read.
    process.env.DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:5999/postgres'
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const seed = vi.fn(seeded)
      expect(await run(['seed'], { loadEnv: noLoadEnv, answersAt: up, seed })).toBe(0)
      expect(seed).toHaveBeenCalledTimes(1)
      expect(error).not.toHaveBeenCalled()

      // Exit code 0 without the final line: the runner stopped early, so this is a failure.
      expect(await run(['seed'], { loadEnv: noLoadEnv, answersAt: up, seed: async () => ({ status: 0, stdout: 'SEED: created 20, kept 0\n' }) })).toBe(1)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('SEED: FAILED.'))
      expect(error).toHaveBeenCalledWith(expect.stringContaining('npm run seed'))

      error.mockClear()
      expect(await run(['seed'], { loadEnv: noLoadEnv, answersAt: up, seed: async () => ({ status: 5, stdout: '' }) })).toBe(5)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('SEED: FAILED.'))
    } finally {
      error.mockRestore()
    }
  })

  it('npm run seed -- --again passes --again on to the seed runner', async () => {
    process.env.DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:5999/postgres'
    const seed = vi.fn(seeded)
    expect(await run(['seed', '--again'], { loadEnv: noLoadEnv, answersAt: up, seed })).toBe(0)
    expect(seed).toHaveBeenCalledWith(['--again'])
    seed.mockClear()
    expect(await run(['seed'], { loadEnv: noLoadEnv, answersAt: up, seed })).toBe(0)
    expect(seed).toHaveBeenCalledWith([])
  })

  it('run(["seed"]) is REFUSED when the marker proves this is the live database - not run unchecked', async () => {
    process.env.DATABASE_URL = 'postgres://u:p@ep-live-1.eu-central-1.aws.neon.tech/db'
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const seed = vi.fn(seeded)
    try {
      const code = await run(['seed'], { loadEnv: noLoadEnv, answersAt: up, readMarker: async () => 'ep-live-1', seed })
      expect(code).toBe(1)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('This is the live database'))
      expect(error).toHaveBeenCalledWith(
        "REFUSED: This is the live database (its database id is ep-live-1). Never use it on your laptop: in .env.local, use your laptop's own database instead (the DATABASE_URL line from .env.example) — see docs/guides/local-setup.md.",
      )
      // The old bypass ran the seed before ever checking: proof this version does not.
      expect(seed).not.toHaveBeenCalled()
    } finally {
      error.mockRestore()
    }
  })

  it('run(["migrate"]) is also refused the same way (the guard is not seed-specific)', async () => {
    process.env.DATABASE_URL = 'postgres://u:p@ep-live-1.eu-central-1.aws.neon.tech/db'
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const code = await run(['migrate'], { loadEnv: noLoadEnv, answersAt: up, readMarker: async () => 'ep-live-1' })
      expect(code).toBe(1)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('REFUSED:'))
    } finally {
      error.mockRestore()
    }
  })

  it('refuses migrate/migrate:create/seed with a plain message about that command, when DATABASE_URL is empty', async () => {
    delete process.env.DATABASE_URL
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      for (const command of ['migrate', 'migrate:create', 'seed']) {
        error.mockClear()
        const code = await run([command], { loadEnv: noLoadEnv, answersAt: up })
        expect(code).toBe(1)
        expect(error).toHaveBeenCalledWith(expect.stringContaining('REFUSED:'))
        expect(error).toHaveBeenCalledWith(expect.stringContaining('DATABASE_URL'))
        expect(error).toHaveBeenCalledWith(expect.stringContaining('.env.local'))
        // Phrased around the actual command a student typed, not the flatter
        // (and for migrate:create, slightly odd-reading) "no database to migrate:create".
        expect(error).toHaveBeenCalledWith(expect.stringContaining(`\`npm run ${command}\``))
        expect(error).toHaveBeenCalledWith(expect.stringContaining('to work on'))
        // Points at the laptop's database and the prefilled line, never at making a Neon account.
        expect(error).toHaveBeenCalledWith(expect.stringContaining('remove the # in front of its DATABASE_URL line'))
        expect(error).toHaveBeenCalledWith(expect.stringContaining("that is your laptop's database, which starts by itself"))
        expect(error).not.toHaveBeenCalledWith(expect.stringContaining('Neon'))
      }
    } finally {
      error.mockRestore()
    }
  })

  it('a marker-read error is caught and printed plainly, rather than crashing with a stack trace', async () => {
    process.env.DATABASE_URL = 'postgres://u:p@ep-a-pooler.eu-central-1.aws.neon.tech/db'
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const code = await run(['migrate'], {
        loadEnv: noLoadEnv,
        readMarker: async () => {
          throw new Error('connection timeout')
        },
      })
      expect(code).toBe(1)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Could not reach your database'))
      expect(error).toHaveBeenCalledWith(expect.stringContaining('connection timeout'))
    } finally {
      error.mockRestore()
    }
  })

  it('rejects an unknown command without ever calling loadEnv\'s real implementation', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const code = await run(['nonsense'], { loadEnv: noLoadEnv, answersAt: up })
      expect(code).toBe(1)
    } finally {
      error.mockRestore()
    }
  })

  it('refuses a LIVE database found under STORAGE_URL, just like one under DATABASE_URL', async () => {
    delete process.env.DATABASE_URL
    process.env.STORAGE_URL = 'postgres://u:p@ep-live-1-pooler.eu-central-1.aws.neon.tech/db'
    const migrate = vi.fn(async () => ({ status: 0, stdout: `${MIGRATIONS_VERIFIED}\n` }))
    const seed = vi.fn(seeded)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      for (const command of ['migrate', 'seed', 'dev']) {
        error.mockClear()
        const code = await run([command], { loadEnv: noLoadEnv, answersAt: up, readMarker: async () => 'ep-live-1', migrate, seed })
        expect(code, command).toBe(1)
        expect(error).toHaveBeenCalledWith(expect.stringContaining('This is the live database'))
      }
      expect(migrate).not.toHaveBeenCalled()
      expect(seed).not.toHaveBeenCalled()
    } finally {
      error.mockRestore()
    }
  })

  it('refuses when the DIRECT address is the live database, even if the pooled one is not', async () => {
    process.env.DATABASE_URL = 'postgres://u:p@ep-mine-1-pooler.eu-central-1.aws.neon.tech/db'
    process.env.STORAGE_URL_UNPOOLED = 'postgres://u:p@ep-live-1.eu-central-1.aws.neon.tech/db'
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const readMarker = async (url: string) => (url.includes('ep-live-1') ? 'ep-live-1' : null)
      const code = await run(['migrate'], { loadEnv: noLoadEnv, answersAt: up, readMarker, migrate: async () => ({ status: 0, stdout: `${MIGRATIONS_VERIFIED}\n` }) })
      expect(code).toBe(1)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('This is the live database (its database id is ep-live-1).'))
    } finally {
      error.mockRestore()
    }
  })

  it('refuses two different addresses under DATABASE_URL and STORAGE_URL, without printing either', async () => {
    process.env.DATABASE_URL = 'postgres://u:secret@ep-a-pooler.eu-central-1.aws.neon.tech/db'
    process.env.STORAGE_URL = 'postgres://u:secret@ep-b-pooler.eu-central-1.aws.neon.tech/db'
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const code = await run(['dev'], { loadEnv: noLoadEnv, answersAt: up, readMarker: async () => null })
      expect(code).toBe(1)
      expect(error).toHaveBeenCalledWith(
        'REFUSED: Conflicting DATABASE_URL and STORAGE_URL: they hold two different database addresses. In .env.local: delete one of the two lines (DATABASE_URL or STORAGE_URL) so only one database address is left, then try again.',
      )
    } finally {
      error.mockRestore()
    }
  })

  it('npm run migrate runs over the direct address when there is one, and gives the runner only that one', async () => {
    const pooled = 'postgres://postgres:postgres@127.0.0.1:5999/pooled' // not Neon: allowed
    const direct = 'postgres://postgres:postgres@127.0.0.1:5999/direct'
    const migrate = vi.fn(async (_variables: Record<string, string | undefined>) => ({ status: 0, stdout: `${MIGRATIONS_VERIFIED}\n` }))
    // Both under the STORAGE_* names, as Vercel's Neon connection can write them into .env.local.
    delete process.env.DATABASE_URL
    process.env.STORAGE_URL = pooled
    process.env.STORAGE_URL_UNPOOLED = direct
    expect(await run(['migrate'], { loadEnv: noLoadEnv, answersAt: up, migrate })).toBe(0)
    const variables = migrate.mock.calls[0][0]
    expect(variables.DATABASE_URL).toBe(direct)
    expect(variables).not.toHaveProperty('STORAGE_URL')
    expect(variables).not.toHaveProperty('STORAGE_URL_UNPOOLED')

    // Only the pooled address: the migration uses that one.
    delete process.env.STORAGE_URL_UNPOOLED
    expect(await run(['migrate'], { loadEnv: noLoadEnv, answersAt: up, migrate })).toBe(0)
    expect(migrate.mock.calls[1][0].DATABASE_URL).toBe(pooled)
  })

  it('npm run migrate succeeds only when the runner exits 0 AND prints its check line', async () => {
    delete process.env.DATABASE_URL
    process.env.STORAGE_URL = 'postgres://postgres:postgres@127.0.0.1:5999/postgres' // not Neon: allowed
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(await run(['migrate'], { loadEnv: noLoadEnv, answersAt: up, migrate: async () => ({ status: 0, stdout: `Migrating: a\n${MIGRATIONS_VERIFIED}\n` }) })).toBe(0)
      expect(error).not.toHaveBeenCalled()

      expect(await run(['migrate'], { loadEnv: noLoadEnv, answersAt: up, migrate: async () => ({ status: 0, stdout: '' }) })).toBe(1)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('MIGRATIONS: FAILED.'))

      error.mockClear()
      expect(await run(['migrate'], { loadEnv: noLoadEnv, answersAt: up, migrate: async () => ({ status: 3, stdout: '' }) })).toBe(3)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('npm run migrate'))
    } finally {
      error.mockRestore()
    }
  })

  it('migrate, migrate:create and seed need the pooled address (DATABASE_URL or STORAGE_URL), not only the direct one', async () => {
    delete process.env.DATABASE_URL
    process.env.DATABASE_URL_UNPOOLED = 'postgres://postgres:postgres@127.0.0.1:5999/postgres'
    const migrate = vi.fn(async () => ({ status: 0, stdout: `${MIGRATIONS_VERIFIED}\n` }))
    const seed = vi.fn(seeded)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      for (const command of ['migrate', 'migrate:create', 'seed']) {
        error.mockClear()
        expect(await run([command], { loadEnv: noLoadEnv, answersAt: up, migrate, seed }), command).toBe(1)
        expect(error).toHaveBeenCalledWith(expect.stringContaining('REFUSED: no DATABASE_URL (or STORAGE_URL) is set'))
        expect(error).toHaveBeenCalledWith(expect.stringContaining(`\`npm run ${command}\``))
      }
      expect(migrate).not.toHaveBeenCalled()
      expect(seed).not.toHaveBeenCalled()
    } finally {
      error.mockRestore()
    }
  })

  it('names the two lines to choose from when the DIRECT addresses conflict', async () => {
    process.env.DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:5999/postgres'
    process.env.DATABASE_URL_UNPOOLED = 'postgres://u:secret@ep-a.eu-central-1.aws.neon.tech/db'
    process.env.STORAGE_URL_UNPOOLED = 'postgres://u:secret@ep-b.eu-central-1.aws.neon.tech/db'
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(await run(['migrate'], { loadEnv: noLoadEnv, answersAt: up })).toBe(1)
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('delete one of the two lines (DATABASE_URL_UNPOOLED or STORAGE_URL_UNPOOLED)'),
      )
    } finally {
      error.mockRestore()
    }
  })

  // Your laptop's database: the guard starts it when nothing answers, uses it when something does, and
  // stops what it started when the command ends. `ensureDatabase` stands in for
  // scripts/lib/laptopDatabase.mjs (tests/unit/laptopDatabase.test.ts covers that one itself).
  const STARTED = "Started your laptop's database (data in .data/db); it stops when this command stops."
  const migrated = async () => ({ status: 0, stdout: `${MIGRATIONS_VERIFIED}\n` })

  it("starts your laptop's database when nothing answers, says so in one line, and stops it when the command ends", async () => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL
    const order: string[] = []
    const stop = vi.fn(async () => void order.push('stop'))
    const ensureDatabase = vi.fn(async () => ({ started: true, stop }))
    const migrate = vi.fn(async () => (order.push('migrate'), migrated()))
    const seed = vi.fn(async () => (order.push('seed'), seeded()))
    const command = vi.fn(async (line: string) => (order.push(line.includes('migrate:create') ? 'migrate:create' : 'dev'), 0))
    for (const name of ['migrate', 'migrate:create', 'seed', 'dev']) {
      order.length = 0
      log.mockClear()
      expect(await run([name], { loadEnv: noLoadEnv, ensureDatabase, migrate, seed, command }), name).toBe(0)
      expect(log).toHaveBeenCalledWith(STARTED)
      // The command ran with the database up, and only then was the database stopped.
      expect(order, name).toEqual([name, 'stop'])
    }
    expect(ensureDatabase).toHaveBeenCalledTimes(4)
  })

  it('stops the database it started also when the command fails', async () => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL
    const stop = vi.fn(async () => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const code = await run(['migrate'], { loadEnv: noLoadEnv, ensureDatabase: async () => ({ started: true, stop }), migrate: async () => ({ status: 3, stdout: '' }) })
      expect(code).toBe(3)
      expect(stop).toHaveBeenCalledTimes(1)
    } finally {
      error.mockRestore()
    }
  })

  it('uses the database that already answers (another terminal runs it): no line, nothing to stop', async () => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL
    process.env.DATABASE_URL_UNPOOLED = LOCAL_DATABASE_URL
    const stop = vi.fn(async () => {})
    const ensureDatabase = vi.fn(async () => ({ started: false, stop }))
    const migrate = vi.fn(migrated)
    expect(await run(['migrate'], { loadEnv: noLoadEnv, ensureDatabase, migrate })).toBe(0)
    expect(migrate).toHaveBeenCalledTimes(1)
    // Once, though both addresses name it.
    expect(ensureDatabase).toHaveBeenCalledTimes(1)
    expect(log).not.toHaveBeenCalledWith(STARTED)
  })

  it('says why, and runs nothing, when your laptop\'s database cannot start', async () => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL
    const migrate = vi.fn(migrated)
    const seed = vi.fn(seeded)
    const command = vi.fn(async () => 0)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      for (const name of ['migrate', 'migrate:create', 'seed', 'dev']) {
        error.mockClear()
        const ensureDatabase = async () => {
          throw new Error('the folder is damaged')
        }
        expect(await run([name], { loadEnv: noLoadEnv, ensureDatabase, migrate, seed, command }), name).toBe(1)
        expect(error).toHaveBeenCalledTimes(1)
        expect(error).toHaveBeenCalledWith(
          "NOT RUNNING: your laptop's database could not start at 127.0.0.1:54329: the folder is damaged. Fix that, then try again.",
        )
      }
      expect(migrate).not.toHaveBeenCalled()
      expect(seed).not.toHaveBeenCalled()
      expect(command).not.toHaveBeenCalled()
    } finally {
      error.mockRestore()
    }
  })

  it("refuses another copy's database at the laptop address, and runs nothing", async () => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL
    const migrate = vi.fn(migrated)
    const seed = vi.fn(seeded)
    const command = vi.fn(async () => 0)
    const ensureDatabase = async () => {
      throw Object.assign(new Error("another program answers at 127.0.0.1:54329, not this project's database"), { code: 'NOT_OURS' })
    }
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      for (const name of ['migrate', 'migrate:create', 'seed', 'dev']) {
        error.mockClear()
        expect(await run([name], { loadEnv: noLoadEnv, ensureDatabase, migrate, seed, command }), name).toBe(1)
        expect(error).toHaveBeenCalledTimes(1)
        expect(error).toHaveBeenCalledWith(
          "NOT YOURS: another program answers at 127.0.0.1:54329, most likely the laptop database of another copy of this starter (another project folder) that is still running. Stop it there (Ctrl+C in that terminal), then try again here.",
        )
      }
      expect(migrate).not.toHaveBeenCalled()
      expect(seed).not.toHaveBeenCalled()
      expect(command).not.toHaveBeenCalled()
    } finally {
      error.mockRestore()
    }
  })

  it("says so, runs nothing and stops what it started, when your laptop's database answers but takes no connections", async () => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL
    const stop = vi.fn(async () => {})
    const migrate = vi.fn(migrated)
    const seed = vi.fn(seeded)
    const command = vi.fn(async () => 0)
    const checkDatabase = vi.fn(async () => 'Connection terminated unexpectedly')
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      for (const name of ['migrate', 'migrate:create', 'seed', 'dev']) {
        error.mockClear()
        stop.mockClear()
        expect(await run([name], { loadEnv: noLoadEnv, ensureDatabase: async () => ({ started: true, stop }), checkDatabase, migrate, seed, command }), name).toBe(1)
        expect(error).toHaveBeenCalledWith(
          "NOT RUNNING: your laptop's database at 127.0.0.1:54329 takes no connections (Connection terminated unexpectedly). If `npm run dev` runs in another terminal, stop it there with Ctrl+C and start it again. Then try again.",
        )
        expect(stop).toHaveBeenCalledTimes(1)
      }
      expect(checkDatabase).toHaveBeenCalledWith(LOCAL_DATABASE_URL)
      expect(migrate).not.toHaveBeenCalled()
      expect(seed).not.toHaveBeenCalled()
      expect(command).not.toHaveBeenCalled()
    } finally {
      error.mockRestore()
    }
  })

  it('a runner that Node stopped halfway (exit code 13, no error of its own) gets a plain message, not only Node\'s warning', async () => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL
    const ensureDatabase = async () => ({ started: false, stop: async () => {} })
    const halfway = async () => ({ status: 13, stdout: '' })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(await run(['migrate'], { loadEnv: noLoadEnv, ensureDatabase, migrate: halfway })).toBe(1)
      expect(error).toHaveBeenCalledWith(
        'MIGRATIONS: FAILED. The migration stopped halfway without an error of its own: it lost its connection to the database, or never got one. If `npm run dev` runs in another terminal, stop it there with Ctrl+C and start it again. Then run `npm run migrate` again: it only runs what is still missing.',
      )
      error.mockClear()
      expect(await run(['seed'], { loadEnv: noLoadEnv, ensureDatabase, seed: halfway })).toBe(1)
      expect(error).toHaveBeenCalledWith(
        'SEED: FAILED. The seed stopped halfway without an error of its own: it lost its connection to the database, or never got one. If `npm run dev` runs in another terminal, stop it there with Ctrl+C and start it again. Then run `npm run seed` again: it only creates what is still missing.',
      )
    } finally {
      error.mockRestore()
    }
  })

  it('never starts a database at another address on this computer: says nothing answers there', async () => {
    process.env.DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:5432/postgres'
    const ensureDatabase = vi.fn(async () => ({ started: true, stop: async () => {} }))
    const migrate = vi.fn(migrated)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(await run(['migrate'], { loadEnv: noLoadEnv, answersAt: async () => false, ensureDatabase, migrate })).toBe(1)
      expect(error).toHaveBeenCalledWith(
        "NOT RUNNING: nothing answers at 127.0.0.1:5432, the database address in .env.local. Start that database, or use your laptop's own database instead (the DATABASE_URL line from .env.example). Then try again.",
      )
      expect(ensureDatabase).not.toHaveBeenCalled()
      expect(migrate).not.toHaveBeenCalled()
    } finally {
      error.mockRestore()
    }
  })

  it('never probes or starts anything for a Neon address, and still refuses the live one before anything else', async () => {
    process.env.DATABASE_URL = 'postgres://u:p@ep-live-1-pooler.eu-central-1.aws.neon.tech/db'
    // Even with the laptop's address next to it: the live one is refused first.
    process.env.DATABASE_URL_UNPOOLED = LOCAL_DATABASE_URL
    const answersAt = vi.fn(async () => false)
    const ensureDatabase = vi.fn(async () => ({ started: true, stop: async () => {} }))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(await run(['migrate'], { loadEnv: noLoadEnv, answersAt, ensureDatabase, readMarker: async () => 'ep-live-1' })).toBe(1)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('REFUSED: This is the live database'))
      expect(answersAt).not.toHaveBeenCalled()
      expect(ensureDatabase).not.toHaveBeenCalled()
    } finally {
      error.mockRestore()
    }
  })
})

describe("your laptop's database (scripts/lib/localDatabase.mjs)", () => {
  it('is the address .env.example holds, on its own port', () => {
    expect(LOCAL_DATABASE_URL).toBe('postgres://postgres:postgres@127.0.0.1:54329/postgres')
  })

  it('recognises an address on this computer, and nothing else', () => {
    expect(localAddress(LOCAL_DATABASE_URL)).toEqual({ host: '127.0.0.1', port: 54329 })
    expect(localAddress('postgres://postgres:postgres@localhost/postgres')).toEqual({ host: 'localhost', port: 5432 })
    expect(localAddress('postgres://u:p@ep-a-pooler.eu-central-1.aws.neon.tech/db')).toBeNull()
    expect(localAddress('not an address')).toBeNull()
    expect(localAddress(undefined)).toBeNull()
  })

  it('answers() is true while something listens on the port, and false once nothing does', async () => {
    const server = net.createServer((socket) => socket.destroy())
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as net.AddressInfo
    expect(await answers({ host: '127.0.0.1', port })).toBe(true)
    await new Promise((resolve) => server.close(resolve))
    expect(await answers({ host: '127.0.0.1', port })).toBe(false)
  })
})

describe('runnerSpawnOptions (how npm run migrate and npm run seed start their runner)', () => {
  it('starts the runner in the project folder, whatever folder the guard was started from', () => {
    const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
    const options = runnerSpawnOptions({ PATH: '/bin' })
    expect(options.cwd.replace(/[\\/]$/, '')).toBe(projectRoot.replace(/[\\/]$/, ''))
    expect(options.env).toEqual({ PATH: '/bin', NODE_OPTIONS: '--no-deprecation' })
    expect(options.stdio).toEqual(['inherit', 'pipe', 'inherit'])
  })
})
