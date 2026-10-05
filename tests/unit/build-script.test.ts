import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import { build, plan, runnerFailure, runnerOptions } from '../../scripts/build.mjs'
import { MIGRATIONS_VERIFIED } from '../../scripts/lib/migrationResult.mjs'
import { SEED_VERIFIED } from '../../scripts/lib/seedResult.mjs'

const POOLED = 'postgres://u:p@ep-a-pooler.eu-central-1.aws.neon.tech/db'
const DIRECT = 'postgres://u:p@ep-a.eu-central-1.aws.neon.tech/db'
const P_POOLED = 'postgres://u:p@ep-p-pooler.eu-central-1.aws.neon.tech/db'
const P_DIRECT = 'postgres://u:p@ep-p.eu-central-1.aws.neon.tech/db'

// What the migration runner returns when it really finished: exit code 0 AND its final check line.
const verified = () => ({ status: 0, stdout: `Migrating: x\n${MIGRATIONS_VERIFIED}\n` })
// What the seed runner returns when it really finished: exit code 0 AND its own final line. Every
// production build below gets this stand-in, so no test ever starts the real seed runner.
const seeded = () => ({ status: 0, stdout: `SEED: created 20, kept 0\n${SEED_VERIFIED}\n` })

// `plan(env)` names the ordered pipeline for a given Vercel environment WITHOUT running anything or
// touching a database - it is the shape of the build, not the runtime decision (that is decideBuild,
// which also needs to know the actual database's state). This is what a test can assert cheaply.
describe('plan', () => {
  it('production: migrate, write the marker, seed, then build', () => {
    expect(plan('production')).toEqual(['migrate', 'write-marker', 'seed', 'next build'])
  })

  it('preview: (maybe) migrate, then build - never writes a marker or seeds', () => {
    expect(plan('preview')).toEqual(['migrate', 'next build'])
  })

  it('any other environment (a student\'s own machine, or none at all): build only, no migration', () => {
    expect(plan('local')).toEqual(['next build'])
    expect(plan(undefined)).toEqual(['next build'])
  })
})

// `plan()` alone never proved the ORCHESTRATION was correct - only its static shape. `build()`
// takes every dependency that touches a database or spawns a process as an injectable override, so
// these tests drive the real branching with fakes instead of a real database and a real `next build`.
describe('build', () => {
  // Every test below reaches at least one `console.log('MIGRATIONS: ...')` / `console.log('SEED: ...')`
  // - silence it here rather than in each test; a few tests still grab `log` to
  // assert on it.
  let log: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    log = vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    log.mockRestore()
  })

  it('a failed PREVIEW migration still reaches `next build`; the exit code is next build\'s', async () => {
    const calls: string[] = []
    const migrate = vi.fn(() => ({ status: 1, stdout: '' }))
    const run = vi.fn((command: string) => {
      calls.push(command)
      if (command.includes('next build')) return 42
      return 0
    })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const code = await build({
        env: 'preview',
        databaseUrl: P_POOLED,
        unpooledUrl: P_DIRECT,
        readMarker: async () => 'ep-a', // a marker from a DIFFERENT endpoint proves this is a copy
        writeMarker: async () => {
          throw new Error('writeMarker must never be called for a preview')
        },
        migrate,
        run,
      })
      expect(code).toBe(42) // next build's own exit code, not the migration's
      expect(migrate).toHaveBeenCalledTimes(1)
      expect(calls.filter((c) => c.includes('next build'))).toHaveLength(1)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('FAILED ON THE PREVIEW DATABASE'))
      // The fix-path wording itself, not just the headline - a regression that
      // drops "Reset from parent" (for example reverting to the old "Fix: in Neon, reset ...") must
      // fail this test.
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Reset from parent'))
    } finally {
      error.mockRestore()
    }
  })

  it('a PREVIEW migration that exits 0 without the check line is a failed one: warning, then `next build`', async () => {
    const run = vi.fn(() => 0)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const code = await build({
        env: 'preview',
        databaseUrl: P_POOLED,
        unpooledUrl: P_DIRECT,
        readMarker: async () => 'ep-a',
        writeMarker: async () => {},
        migrate: () => ({ status: 0, stdout: '' }),
        run,
      })
      expect(code).toBe(0)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('FAILED ON THE PREVIEW DATABASE'))
      expect(run).toHaveBeenCalledWith(expect.stringContaining('next build'))
    } finally {
      error.mockRestore()
    }
  })

  it('a failed PRODUCTION migration stops before writeMarker and the seed; the build fails', async () => {
    const calls: string[] = []
    const writeMarker = vi.fn()
    const seed = vi.fn(seeded)
    const run = vi.fn((command: string) => {
      calls.push(command)
      return 0
    })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const code = await build({
        env: 'production',
        seed,
        databaseUrl: POOLED,
        unpooledUrl: DIRECT,
        readMarker: async () => null,
        writeMarker,
        migrate: () => ({ status: 7, stdout: '' }),
        run,
      })
      expect(code).toBe(7) // the migration's own exit code
      expect(writeMarker).not.toHaveBeenCalled()
      expect(seed).not.toHaveBeenCalled()
      expect(calls.some((c) => c.includes('next build'))).toBe(false)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('MIGRATIONS: FAILED.'))
    } finally {
      error.mockRestore()
    }
  })

  it('a PRODUCTION migration that exits 0 WITHOUT the check line fails the build (the account-test case)', async () => {
    const writeMarker = vi.fn()
    const seed = vi.fn(seeded)
    const run = vi.fn(() => 0)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const code = await build({
        env: 'production',
        seed,
        databaseUrl: POOLED,
        unpooledUrl: DIRECT,
        readMarker: async () => null,
        writeMarker,
        migrate: () => ({ status: 0, stdout: 'Reading migration files\n' }),
        run,
      })
      expect(code).toBe(1)
      expect(writeMarker).not.toHaveBeenCalled()
      expect(seed).not.toHaveBeenCalled()
      expect(run).not.toHaveBeenCalled() // no `next build`
      expect(error).toHaveBeenCalledWith(expect.stringContaining('MIGRATIONS: FAILED.'))
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Redeploy'))
    } finally {
      error.mockRestore()
    }
  })

  it('a PRODUCTION migration stopped by the time limit (no exit code) also fails the build', async () => {
    const run = vi.fn(() => 0)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const code = await build({
        env: 'production',
        seed: seeded,
        databaseUrl: POOLED,
        unpooledUrl: DIRECT,
        readMarker: async () => null,
        writeMarker: async () => {},
        migrate: () => ({ status: null, stdout: '' }),
        run,
      })
      expect(code).toBe(1)
      expect(run).not.toHaveBeenCalled()
    } finally {
      error.mockRestore()
    }
  })

  it('reads the marker with the UNPOOLED url, and the migration runs on the unpooled url', async () => {
    const readMarker = vi.fn(async () => null)
    const migrate = vi.fn(verified)
    await build({
      env: 'production',
      seed: seeded,
      databaseUrl: POOLED,
      unpooledUrl: DIRECT,
      readMarker,
      writeMarker: async () => {},
      migrate,
      run: () => 0,
    })
    expect(readMarker).toHaveBeenCalledWith(DIRECT)
    expect(migrate).toHaveBeenCalledWith(DIRECT)
  })

  it('writeMarker gets the UNPOOLED url and its endpoint id', async () => {
    const writeMarker = vi.fn(async () => {})
    await build({
      env: 'production',
      seed: seeded,
      databaseUrl: POOLED,
      unpooledUrl: DIRECT,
      readMarker: async () => null,
      writeMarker,
      migrate: verified,
      run: () => 0,
    })
    expect(writeMarker).toHaveBeenCalledWith(DIRECT, 'ep-a')
  })

  it('a marker-read error stops the build with a plain message, before running anything', async () => {
    const run = vi.fn(() => 0)
    const migrate = vi.fn(verified)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const code = await build({
        env: 'production',
        seed: seeded,
        databaseUrl: POOLED,
        unpooledUrl: DIRECT,
        readMarker: async () => {
          throw new Error('connection timeout')
        },
        writeMarker: async () => {},
        migrate,
        run,
      })
      expect(code).toBe(1)
      expect(run).not.toHaveBeenCalled()
      expect(migrate).not.toHaveBeenCalled()
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Could not reach your database'))
      expect(error).toHaveBeenCalledWith(expect.stringContaining('connection timeout'))
    } finally {
      error.mockRestore()
    }
  })

  it('a preview connected to the LIVE database STOPS the build entirely - never reaches `next build`', async () => {
    const run = vi.fn(() => 0)
    const migrate = vi.fn(verified)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const code = await build({
        env: 'preview',
        databaseUrl: POOLED,
        unpooledUrl: DIRECT,
        readMarker: async () => 'ep-a', // this preview's OWN marker names its own endpoint
        writeMarker: async () => {},
        migrate,
        run,
      })
      expect(code).toBe(1)
      expect(run).not.toHaveBeenCalled()
      expect(migrate).not.toHaveBeenCalled()
      expect(error).toHaveBeenCalledWith(expect.stringContaining('STOPPED'))
    } finally {
      error.mockRestore()
    }
  })

  // A failing writeMarker AFTER a successful migration used to be uncaught and
  // printed a raw stack. The migration already changed the schema - the build must still stop (so the
  // failure is visible now, not as a confusing "not running" on some later preview), but with a plain
  // message, not a crash.
  it('a writeMarker failure after a successful migration is caught, printed plainly, and fails the build', async () => {
    const run = vi.fn(() => 0)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const code = await build({
        env: 'production',
        seed: seeded,
        databaseUrl: POOLED,
        unpooledUrl: DIRECT,
        readMarker: async () => null,
        writeMarker: async () => {
          throw new Error('connection reset')
        },
        migrate: verified,
        run,
      })
      expect(code).toBe(1)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('ran, but could not record which database is the live one'))
      expect(error).toHaveBeenCalledWith(expect.stringContaining('connection reset'))
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Redeploy'))
      // Never reached the seed or `next build`.
      expect(run).not.toHaveBeenCalled()
    } finally {
      error.mockRestore()
    }
  })

  // Ties the real orchestration to plan()'s own shape, the seed step included, so
  // moving the seed before writeMarker, or dropping a step, fails THIS test.
  it('production, happy path: the recorded order equals plan(\'production\') exactly, seed included', async () => {
    const order: string[] = []
    const readMarker = async () => null
    const writeMarker = async () => {
      order.push('write-marker')
    }
    const migrate = () => {
      order.push('migrate')
      return verified()
    }
    const seed = (databaseUrl: string) => {
      order.push('seed')
      expect(databaseUrl).toBe(DIRECT) // the same database the migrations just ran on
      return seeded()
    }
    const run = (command: string) => {
      if (command.includes('next build')) order.push('next build')
      return 0
    }
    const code = await build({
      env: 'production',
      seed,
      databaseUrl: POOLED,
      unpooledUrl: DIRECT,
      readMarker,
      writeMarker,
      migrate,
      run,
    })
    expect(code).toBe(0)
    expect(order).toEqual(plan('production'))
  })

  it('preview, happy path: the recorded order equals plan(\'preview\') exactly - never writes a marker or seeds', async () => {
    const order: string[] = []
    const writeMarker = vi.fn()
    const migrate = () => {
      order.push('migrate')
      return verified()
    }
    const run = (command: string) => {
      if (command.includes('next build')) order.push('next build')
      return 0
    }
    const seed = vi.fn(seeded)
    const code = await build({
      env: 'preview',
      databaseUrl: P_POOLED,
      unpooledUrl: P_DIRECT,
      readMarker: async () => 'ep-a', // a marker from a different endpoint proves this is a copy
      writeMarker,
      migrate,
      seed,
      run,
    })
    expect(code).toBe(0)
    expect(order).toEqual(plan('preview'))
    expect(writeMarker).not.toHaveBeenCalled()
    expect(seed).not.toHaveBeenCalled() // a preview never seeds
  })

  // The seed is judged like the migrations: exit code 0 alone is not enough, the runner must also end
  // with its own final line (scripts/lib/seedResult.mjs).
  it('a PRODUCTION seed that exits 0 WITHOUT its final line fails the build before `next build`', async () => {
    const run = vi.fn(() => 0)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const code = await build({
        env: 'production',
        seed: () => ({ status: 0, stdout: 'SEED: created 20, kept 0\n' }),
        databaseUrl: POOLED,
        unpooledUrl: DIRECT,
        readMarker: async () => null,
        writeMarker: async () => {},
        migrate: verified,
        run,
      })
      expect(code).toBe(1)
      expect(run).not.toHaveBeenCalled()
      expect(error).toHaveBeenCalledWith(expect.stringContaining('SEED: FAILED.'))
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Redeploy'))
      // A new site's first editor is created in the same step, so the message says where to look.
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining(
          'only the example content (and, on a new site, the first editor account) may be missing. Check FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD in Vercel if the error above mentions them.',
        ),
      )
    } finally {
      error.mockRestore()
    }
  })

  it('a failing PRODUCTION seed stops the build with the seed\'s own exit code, or 1 after a time-out', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const cases = [
        { result: { status: 4, stdout: '' }, expected: 4 },
        { result: { status: null, stdout: '' }, expected: 1 },
        { result: { status: 1, stdout: `${SEED_VERIFIED}\n` }, expected: 1 },
      ]
      for (const { result, expected } of cases) {
        const run = vi.fn(() => 0)
        const code = await build({
          env: 'production',
          seed: () => result,
          databaseUrl: POOLED,
          unpooledUrl: DIRECT,
          readMarker: async () => null,
          writeMarker: async () => {},
          migrate: verified,
          run,
        })
        expect(code).toBe(expected)
        expect(run).not.toHaveBeenCalled()
      }
    } finally {
      error.mockRestore()
    }
  })
})

// Vercel's Neon connection can name the addresses STORAGE_URL / STORAGE_URL_UNPOOLED instead of
// DATABASE_URL / DATABASE_URL_UNPOOLED. The build must treat both the same way.
describe('build with the STORAGE_URL names', () => {
  let log: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    log = vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    log.mockRestore()
  })

  it('production with STORAGE_* only: same marker read, migration address and endpoint id as with DATABASE_*', async () => {
    const seen: Record<string, unknown[]> = {}
    for (const variables of [
      { DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT },
      { STORAGE_URL: POOLED, STORAGE_URL_UNPOOLED: DIRECT },
    ]) {
      const readMarker = vi.fn(async () => null)
      const migrate = vi.fn(verified)
      const writeMarker = vi.fn(async () => {})
      const code = await build({ env: 'production', variables, readMarker, writeMarker, migrate, seed: seeded, run: () => 0 })
      expect(code).toBe(0)
      seen[Object.keys(variables)[0]] = [readMarker.mock.calls, migrate.mock.calls, writeMarker.mock.calls]
    }
    expect(seen.STORAGE_URL).toEqual(seen.DATABASE_URL)
    expect(seen.STORAGE_URL).toEqual([[[DIRECT]], [[DIRECT]], [[DIRECT, 'ep-a']]])
  })

  it('a preview with STORAGE_* pointing at the LIVE database stops, exactly as with DATABASE_*', async () => {
    const run = vi.fn(() => 0)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const code = await build({
        env: 'preview',
        variables: { STORAGE_URL: POOLED, STORAGE_URL_UNPOOLED: DIRECT },
        readMarker: async () => 'ep-a',
        writeMarker: async () => {},
        migrate: verified,
        run,
      })
      expect(code).toBe(1)
      expect(run).not.toHaveBeenCalled()
      expect(error).toHaveBeenCalledWith(expect.stringContaining('STOPPED'))
    } finally {
      error.mockRestore()
    }
  })

  it('production with neither name: the usual NOT CONFIGURED YET message', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const code = await build({ env: 'production', variables: {}, readMarker: async () => null, migrate: verified, seed: seeded, run: () => 0 })
      expect(code).toBe(1)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('NOT CONFIGURED YET: there is no database'))
    } finally {
      error.mockRestore()
    }
  })

  it('two different addresses under the two names: DATABASE SET UP WRONG, nothing runs, no address printed', async () => {
    const run = vi.fn(() => 0)
    const migrate = vi.fn(verified)
    const readMarker = vi.fn(async () => null)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const code = await build({
        env: 'production',
        seed: seeded,
        variables: { DATABASE_URL: POOLED, STORAGE_URL: P_POOLED },
        readMarker,
        migrate,
        run,
      })
      expect(code).toBe(1)
      expect(readMarker).not.toHaveBeenCalled()
      expect(migrate).not.toHaveBeenCalled()
      expect(run).not.toHaveBeenCalled()
      expect(error).toHaveBeenCalledWith(expect.stringContaining('DATABASE SET UP WRONG: Conflicting DATABASE_URL and STORAGE_URL: they hold two different database addresses.'))
      expect(error).toHaveBeenCalledWith(expect.stringContaining('In Vercel'))
      expect(error).not.toHaveBeenCalledWith(expect.stringContaining('neon.tech'))
    } finally {
      error.mockRestore()
    }
  })
})

// How the build starts each runner (scripts/migrate.mjs, scripts/seed.mjs).
describe('runnerOptions and runnerFailure', () => {
  it('starts the runner in the project folder, with the one chosen address and room for long output', () => {
    const options = runnerOptions({ PATH: '/bin', STORAGE_URL: POOLED, STORAGE_URL_UNPOOLED: DIRECT }, DIRECT)
    const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
    expect(options.cwd.replace(/[\\/]$/, '')).toBe(projectRoot.replace(/[\\/]$/, ''))
    expect(options.timeout).toBe(120_000)
    expect(options.maxBuffer).toBe(10 * 1024 * 1024)
    expect(options.encoding).toBe('utf8')
    // The address through migrationEnv: DATABASE_URL set, both STORAGE_* names really removed.
    expect(options.env).toEqual({ PATH: '/bin', DATABASE_URL: DIRECT, NODE_OPTIONS: '--no-deprecation' })
  })

  it('says in plain words when a runner was stopped after the time limit', () => {
    const timedOut = Object.assign(new Error('spawnSync node ETIMEDOUT'), { code: 'ETIMEDOUT' })
    expect(runnerFailure('SEED', timedOut)).toBe('SEED: the runner took longer than 2 minutes, so it was stopped.')
    expect(runnerFailure('MIGRATIONS', new Error('spawnSync node ENOENT'))).toBe(
      'MIGRATIONS: the runner could not finish: spawnSync node ENOENT',
    )
  })
})
