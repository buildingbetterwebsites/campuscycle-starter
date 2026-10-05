// The browser checks' database guard (tests/e2e/databaseGuard.ts): they write test records, so they
// refuse the live database always, and any database that is not on this computer unless
// E2E_ALLOW_REMOTE=1 says so on purpose. The refusal never shows the password.
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { e2eDatabaseProblem, e2eSiteDatabaseProblem } from '../e2e/databaseGuard'

const NEON = 'postgresql://owner:s3cret-pass@ep-cool-river-123456-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
const NEON_ID = 'ep-cool-river-123456'
const REMOTE = 'postgres://owner:s3cret-pass@db.example.com:5432/site'
const LOCAL = 'postgres://postgres:postgres@127.0.0.1:5432/postgres'

const noMarker = async () => null
const liveMarker = async () => NEON_ID

describe('e2eDatabaseProblem', () => {
  it('allows a database on this computer, as in CI', async () => {
    expect(await e2eDatabaseProblem(LOCAL, {}, noMarker)).toBe(null)
    expect(await e2eDatabaseProblem('postgres://postgres@localhost:51904/bw_prod_3110', {}, noMarker)).toBe(null)
  })

  it('refuses the live Neon database, even with E2E_ALLOW_REMOTE=1', async () => {
    const problem = await e2eDatabaseProblem(NEON, { E2E_ALLOW_REMOTE: '1' }, liveMarker)
    expect(problem).toMatch(/^REFUSED: the database at ep-cool-river-123456-pooler\.eu-central-1\.aws\.neon\.tech is the live site's database/)
    expect(problem).not.toContain('s3cret-pass')
  })

  it('refuses a Neon database that is not the live one, unless E2E_ALLOW_REMOTE=1', async () => {
    const problem = await e2eDatabaseProblem(NEON, {}, noMarker)
    expect(problem).toMatch(/is not on this computer.*E2E_ALLOW_REMOTE=1/)
    expect(problem).not.toContain('s3cret-pass')
    expect(await e2eDatabaseProblem(NEON, { E2E_ALLOW_REMOTE: '1' }, noMarker)).toBe(null)
  })

  it('refuses any other remote host without the flag, naming only the host', async () => {
    const problem = await e2eDatabaseProblem(REMOTE, {}, noMarker)
    expect(problem).toBe(
      'REFUSED: the database at db.example.com is not on this computer. The browser checks write test records (and rename a table for a moment). If this really is a throwaway test database, set E2E_ALLOW_REMOTE=1 and run them again.',
    )
    expect(await e2eDatabaseProblem(REMOTE, { E2E_ALLOW_REMOTE: 'yes' }, noMarker)).not.toBe(null)
  })

  it('refuses when there is no address, or the live-database check cannot reach it', async () => {
    expect(await e2eDatabaseProblem(undefined, {}, noMarker)).toMatch(/^REFUSED: DATABASE_URL \(or STORAGE_URL\) is not set/)
    expect(await e2eDatabaseProblem('not a url', {}, noMarker)).toMatch(/^REFUSED/)
    const unreachable = await e2eDatabaseProblem(NEON, { E2E_ALLOW_REMOTE: '1' }, async () => {
      throw new Error('connect ETIMEDOUT with s3cret-pass')
    })
    expect(unreachable).toMatch(/^REFUSED: could not reach the database at ep-cool-river/)
    expect(unreachable).not.toContain('s3cret-pass')
  })

  // A cold start of the fixture (tsx loading Payload's config) can take several seconds on a busy
  // computer: the test waits as long as the run itself may take, not vitest's 5-second default.
  it('the fixture itself refuses before writing anything: a remote address ends it with exit 1', { timeout: 60_000 }, () => {
    const run = spawnSync(process.execPath, ['--import', 'tsx', 'tests/e2e/fixture.ts', 'create'], {
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: REMOTE, E2E_ALLOW_REMOTE: '', NODE_OPTIONS: '--no-deprecation' },
      timeout: 60_000,
    })
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('REFUSED: the database at db.example.com is not on this computer.')
    expect(run.stderr + run.stdout).not.toContain('s3cret-pass')
    expect(run.stdout).not.toContain('E2E_FIXTURE=')
  })
})

describe('e2eSiteDatabaseProblem: the database the site itself uses', () => {
  const noMarker = async () => null

  it('reads the address under STORAGE_URL too, as the site does', async () => {
    expect(await e2eSiteDatabaseProblem({ STORAGE_URL: LOCAL }, noMarker)).toBe(null)
    expect(await e2eSiteDatabaseProblem({ STORAGE_URL: REMOTE }, noMarker)).toMatch(/is not on this computer/)
  })

  it('refuses no address at all, and two different ones, before it connects', async () => {
    expect(await e2eSiteDatabaseProblem({}, noMarker)).toMatch(/^REFUSED: DATABASE_URL \(or STORAGE_URL\) is not set/)
    const two = await e2eSiteDatabaseProblem({ DATABASE_URL: LOCAL, STORAGE_URL: 'postgres://postgres@localhost:5999/other' }, noMarker)
    expect(two).toMatch(/^REFUSED: Conflicting DATABASE_URL and STORAGE_URL/)
  })
})
