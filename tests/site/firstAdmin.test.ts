import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, resetCollections } from '../setup/payload'
import { createFirstAdmin } from '../../src/lib/firstAdmin'
import { refuseUnlessThrowAwayTestDatabase } from '../setup/safety'

// These tests delete every user: never on a real database.
refuseUnlessThrowAwayTestDatabase()

const ORIGINAL_EMAIL = process.env.FIRST_ADMIN_EMAIL
const ORIGINAL_PASSWORD = process.env.FIRST_ADMIN_PASSWORD

beforeEach(async () => {
  await resetCollections(['users'])
  delete process.env.FIRST_ADMIN_EMAIL
  delete process.env.FIRST_ADMIN_PASSWORD
})

afterEach(() => {
  if (ORIGINAL_EMAIL === undefined) delete process.env.FIRST_ADMIN_EMAIL
  else process.env.FIRST_ADMIN_EMAIL = ORIGINAL_EMAIL
  if (ORIGINAL_PASSWORD === undefined) delete process.env.FIRST_ADMIN_PASSWORD
  else process.env.FIRST_ADMIN_PASSWORD = ORIGINAL_PASSWORD
})

// The last test in this file leaves an admin user behind (beforeEach only resets BEFORE each test).
// Other test files (for example smoke.test.ts) expect the shared test database to still be empty -
// leave it the way this file found it.
afterAll(async () => {
  await resetCollections(['users'])
})

describe('createFirstAdmin', () => {
  it('fails closed: no users and no FIRST_ADMIN_* set throws, rather than leaving sign-up open', async () => {
    const payload = await getTestPayload()
    await expect(createFirstAdmin(payload)).rejects.toThrow(/FIRST_ADMIN_EMAIL/)
  })

  it('creates exactly one user from FIRST_ADMIN_EMAIL / FIRST_ADMIN_PASSWORD', async () => {
    process.env.FIRST_ADMIN_EMAIL = 'admin@example.com'
    process.env.FIRST_ADMIN_PASSWORD = 'a-fine-password-1234'
    const payload = await getTestPayload()

    await createFirstAdmin(payload)

    const { totalDocs, docs } = await payload.find({ collection: 'users', overrideAccess: true })
    expect(totalDocs).toBe(1)
    expect(docs[0]?.email).toBe('admin@example.com')
  })

  it('running it twice keeps exactly one user (an already-started site restarting)', async () => {
    process.env.FIRST_ADMIN_EMAIL = 'admin@example.com'
    process.env.FIRST_ADMIN_PASSWORD = 'a-fine-password-1234'
    const payload = await getTestPayload()

    await createFirstAdmin(payload)
    await createFirstAdmin(payload)

    expect((await payload.count({ collection: 'users', overrideAccess: true })).totalDocs).toBe(1)
  })

  it('two instances starting at the same moment also keep exactly one user', async () => {
    process.env.FIRST_ADMIN_EMAIL = 'admin@example.com'
    process.env.FIRST_ADMIN_PASSWORD = 'a-fine-password-1234'
    const payload = await getTestPayload()

    // Both see zero users, both try to create the same one; whichever loses the unique-email
    // constraint must swallow that error rather than crash the site's start-up.
    await expect(Promise.all([createFirstAdmin(payload), createFirstAdmin(payload)])).resolves.toBeDefined()

    expect((await payload.count({ collection: 'users', overrideAccess: true })).totalDocs).toBe(1)
  })

  // A fake `payload` whose `count` always throws, so the missing-table tolerance (Postgres
  // 42P01 - the migrations have not run yet) is tested directly, without needing a real un-migrated
  // database. `createFirstAdmin` only ever calls `.count` before anything else on this path.
  function fakePayloadThatThrows(error: unknown): Payload {
    return { count: async () => { throw error } } as unknown as Payload
  }

  it('a missing-table error (Postgres 42P01) returns quietly - the migrations have not run yet', async () => {
    const payload = fakePayloadThatThrows({ cause: { code: '42P01' } })
    await expect(createFirstAdmin(payload)).resolves.toBeUndefined()
  })

  it('a missing-table error nested a few `.cause` levels deep is still recognised', async () => {
    const payload = fakePayloadThatThrows({ cause: { cause: { cause: { code: '42P01' } } } })
    await expect(createFirstAdmin(payload)).resolves.toBeUndefined()
  })

  it('any OTHER error code is rethrown, not swallowed', async () => {
    const payload = fakePayloadThatThrows({ cause: { code: 'ECONNREFUSED' } })
    await expect(createFirstAdmin(payload)).rejects.toMatchObject({ cause: { code: 'ECONNREFUSED' } })
  })

  it('an error with no .code at all is rethrown too', async () => {
    const payload = fakePayloadThatThrows(new Error('something else entirely'))
    await expect(createFirstAdmin(payload)).rejects.toThrow('something else entirely')
  })
})
