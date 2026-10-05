import { describe, expect, it } from 'vitest'
import { databaseEnvironment } from '../../scripts/lib/databaseEnv.mjs'

const POOLED = 'postgres://u:secret-password@ep-a-pooler.eu-central-1.aws.neon.tech/db'
const DIRECT = 'postgres://u:secret-password@ep-a.eu-central-1.aws.neon.tech/db'
const OTHER = 'postgres://u:other-password@ep-b-pooler.eu-central-1.aws.neon.tech/db'

describe('databaseEnvironment', () => {
  it('reads the DATABASE_URL names', () => {
    expect(databaseEnvironment({ DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT })).toEqual({ pooledUrl: POOLED, directUrl: DIRECT })
  })

  it('reads the STORAGE_URL names that Vercel\'s Neon connection can create instead', () => {
    expect(databaseEnvironment({ STORAGE_URL: POOLED, STORAGE_URL_UNPOOLED: DIRECT })).toEqual({ pooledUrl: POOLED, directUrl: DIRECT })
  })

  it('accepts both names when they hold the same address', () => {
    expect(databaseEnvironment({ DATABASE_URL: POOLED, STORAGE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT, STORAGE_URL_UNPOOLED: DIRECT })).toEqual({ pooledUrl: POOLED, directUrl: DIRECT })
  })

  it('refuses two different addresses, without ever repeating either one in the message', () => {
    for (const variables of [{ DATABASE_URL: POOLED, STORAGE_URL: OTHER }, { DATABASE_URL_UNPOOLED: DIRECT, STORAGE_URL_UNPOOLED: OTHER }]) {
      let message = ''
      let names: unknown
      try {
        databaseEnvironment(variables)
      } catch (error) {
        message = (error as Error).message
        names = (error as Error & { names?: string[] }).names
      }
      expect(message).toMatch(/^Conflicting (DATABASE_URL and STORAGE_URL|DATABASE_URL_UNPOOLED and STORAGE_URL_UNPOOLED): they hold two different database addresses\.$/)
      // The two names, for a message that says which line to delete.
      expect(names).toEqual(Object.keys(variables))
      expect(message).not.toMatch(/password|neon\.tech|postgres:/)
    }
  })

  it('ignores spaces around a pasted address, and treats a blank one as missing', () => {
    expect(databaseEnvironment({ DATABASE_URL: `  ${POOLED}\n`, STORAGE_URL: POOLED })).toEqual({ pooledUrl: POOLED, directUrl: '' })
    expect(databaseEnvironment({ DATABASE_URL: '   ', STORAGE_URL: POOLED })).toEqual({ pooledUrl: POOLED, directUrl: '' })
  })

  it('gives empty addresses when neither name is set', () => {
    expect(databaseEnvironment({})).toEqual({ pooledUrl: '', directUrl: '' })
  })
})
