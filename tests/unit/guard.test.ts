import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import { check, run, runnerSpawnOptions } from '../../scripts/guard.mjs'
import { MIGRATIONS_VERIFIED } from '../../scripts/lib/migrationResult.mjs'
import { SEED_VERIFIED } from '../../scripts/lib/seedResult.mjs'

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
      expect(await run(['seed'], { loadEnv: noLoadEnv, seed })).toBe(0)
      expect(seed).toHaveBeenCalledTimes(1)
      expect(error).not.toHaveBeenCalled()

      // Exit code 0 without the final line: the runner stopped early, so this is a failure.
      expect(await run(['seed'], { loadEnv: noLoadEnv, seed: async () => ({ status: 0, stdout: 'SEED: created 20, kept 0\n' }) })).toBe(1)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('SEED: FAILED.'))
      expect(error).toHaveBeenCalledWith(expect.stringContaining('npm run seed'))

      error.mockClear()
      expect(await run(['seed'], { loadEnv: noLoadEnv, seed: async () => ({ status: 5, stdout: '' }) })).toBe(5)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('SEED: FAILED.'))
    } finally {
      error.mockRestore()
    }
  })

  it('npm run seed -- --again passes --again on to the seed runner', async () => {
    process.env.DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:5999/postgres'
    const seed = vi.fn(seeded)
    expect(await run(['seed', '--again'], { loadEnv: noLoadEnv, seed })).toBe(0)
    expect(seed).toHaveBeenCalledWith(['--again'])
    seed.mockClear()
    expect(await run(['seed'], { loadEnv: noLoadEnv, seed })).toBe(0)
    expect(seed).toHaveBeenCalledWith([])
  })

  it('run(["seed"]) is REFUSED when the marker proves this is the live database - not run unchecked', async () => {
    process.env.DATABASE_URL = 'postgres://u:p@ep-live-1.eu-central-1.aws.neon.tech/db'
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const seed = vi.fn(seeded)
    try {
      const code = await run(['seed'], { loadEnv: noLoadEnv, readMarker: async () => 'ep-live-1', seed })
      expect(code).toBe(1)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('This is the live database'))
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
      const code = await run(['migrate'], { loadEnv: noLoadEnv, readMarker: async () => 'ep-live-1' })
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
        const code = await run([command], { loadEnv: noLoadEnv })
        expect(code).toBe(1)
        expect(error).toHaveBeenCalledWith(expect.stringContaining('REFUSED:'))
        expect(error).toHaveBeenCalledWith(expect.stringContaining('DATABASE_URL'))
        expect(error).toHaveBeenCalledWith(expect.stringContaining('.env.local'))
        // Phrased around the actual command a student typed, not the flatter
        // (and for migrate:create, slightly odd-reading) "no database to migrate:create".
        expect(error).toHaveBeenCalledWith(expect.stringContaining(`\`npm run ${command}\``))
        expect(error).toHaveBeenCalledWith(expect.stringContaining('to work on'))
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
      const code = await run(['nonsense'], { loadEnv: noLoadEnv })
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
        const code = await run([command], { loadEnv: noLoadEnv, readMarker: async () => 'ep-live-1', migrate, seed })
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
      const code = await run(['migrate'], { loadEnv: noLoadEnv, readMarker, migrate: async () => ({ status: 0, stdout: `${MIGRATIONS_VERIFIED}\n` }) })
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
      const code = await run(['dev'], { loadEnv: noLoadEnv, readMarker: async () => null })
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
    expect(await run(['migrate'], { loadEnv: noLoadEnv, migrate })).toBe(0)
    const variables = migrate.mock.calls[0][0]
    expect(variables.DATABASE_URL).toBe(direct)
    expect(variables).not.toHaveProperty('STORAGE_URL')
    expect(variables).not.toHaveProperty('STORAGE_URL_UNPOOLED')

    // Only the pooled address: the migration uses that one.
    delete process.env.STORAGE_URL_UNPOOLED
    expect(await run(['migrate'], { loadEnv: noLoadEnv, migrate })).toBe(0)
    expect(migrate.mock.calls[1][0].DATABASE_URL).toBe(pooled)
  })

  it('npm run migrate succeeds only when the runner exits 0 AND prints its check line', async () => {
    delete process.env.DATABASE_URL
    process.env.STORAGE_URL = 'postgres://postgres:postgres@127.0.0.1:5999/postgres' // not Neon: allowed
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(await run(['migrate'], { loadEnv: noLoadEnv, migrate: async () => ({ status: 0, stdout: `Migrating: a\n${MIGRATIONS_VERIFIED}\n` }) })).toBe(0)
      expect(error).not.toHaveBeenCalled()

      expect(await run(['migrate'], { loadEnv: noLoadEnv, migrate: async () => ({ status: 0, stdout: '' }) })).toBe(1)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('MIGRATIONS: FAILED.'))

      error.mockClear()
      expect(await run(['migrate'], { loadEnv: noLoadEnv, migrate: async () => ({ status: 3, stdout: '' }) })).toBe(3)
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
        expect(await run([command], { loadEnv: noLoadEnv, migrate, seed }), command).toBe(1)
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
      expect(await run(['migrate'], { loadEnv: noLoadEnv })).toBe(1)
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('delete one of the two lines (DATABASE_URL_UNPOOLED or STORAGE_URL_UNPOOLED)'),
      )
    } finally {
      error.mockRestore()
    }
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
