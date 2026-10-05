import { describe, expect, it } from 'vitest'
import { databaseEnvironment } from '../../scripts/lib/databaseEnv.mjs'
import { migrationEnv } from '../../scripts/lib/migrationEnv.mjs'

const POOLED = 'postgres://u:p@ep-a-pooler.eu-central-1.aws.neon.tech/db'
const DIRECT = 'postgres://u:p@ep-a.eu-central-1.aws.neon.tech/db'

// The build gives each runner (scripts/migrate.mjs, scripts/seed.mjs) exactly one database address.
describe('migrationEnv', () => {
  it('sets DATABASE_URL to the chosen address, removes both STORAGE_* names and keeps the rest', () => {
    const variables = { PATH: '/bin', DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT, STORAGE_URL: POOLED, STORAGE_URL_UNPOOLED: DIRECT }
    const env = migrationEnv(variables, DIRECT)
    expect(env).toEqual({ PATH: '/bin', DATABASE_URL: DIRECT, DATABASE_URL_UNPOOLED: DIRECT })
    // Really gone, not just set to undefined (which some tools pass on as the text "undefined").
    expect('STORAGE_URL' in env).toBe(false)
    expect('STORAGE_URL_UNPOOLED' in env).toBe(false)
    // The build's own variables are left alone.
    expect(variables.STORAGE_URL).toBe(POOLED)
    expect(variables.DATABASE_URL).toBe(POOLED)
  })

  it('the Vercel case with only the STORAGE_* names: the runner gets the direct address and no conflict', () => {
    const env = migrationEnv({ STORAGE_URL: POOLED, STORAGE_URL_UNPOOLED: DIRECT }, DIRECT)
    expect(env).toEqual({ DATABASE_URL: DIRECT })
    // Without removing STORAGE_URL, the runner would see DATABASE_URL (direct) next to STORAGE_URL
    // (pooled), two different addresses, and refuse to start.
    expect(databaseEnvironment(env)).toEqual({ pooledUrl: DIRECT, directUrl: '' })
  })

  it('never leaves the runner two conflicting addresses, whichever names the build had', () => {
    const cases = [
      { DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT },
      { STORAGE_URL: POOLED },
      { STORAGE_URL: POOLED, STORAGE_URL_UNPOOLED: DIRECT },
      { DATABASE_URL: POOLED, STORAGE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT, STORAGE_URL_UNPOOLED: DIRECT },
    ]
    for (const variables of cases) {
      for (const url of [POOLED, DIRECT]) {
        expect(databaseEnvironment(migrationEnv(variables, url)).pooledUrl).toBe(url)
      }
    }
  })
})
