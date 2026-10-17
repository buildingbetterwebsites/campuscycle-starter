// Your laptop's database (`npm run db`, scripts/db.mjs) runs without database transactions.
//
// WHY: PGlite answers one connection at a time, and while one connection has a transaction open,
// every other connection waits until it ends. Payload saves inside a transaction, and every save from
// /admin (or the REST API) also checks whether someone else has the record open - with a read that
// does NOT go through that transaction but through a second connection. That read waits for the
// transaction, and the transaction waits for the read: saving a clinic in /admin hung on
// "Submitting..." forever, and the database answered nobody after that.
//
// The first test does exactly that save on a PGlite server started the way `npm run db` starts it,
// with the transaction setting the app's config uses for the laptop's database.
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { postgresAdapter, type PostgresAdapter } from '@payloadcms/db-postgres'
import type { PoolClient } from 'pg'
import { buildConfig, getPayload, type PayloadRequest, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { databaseTransactions, LOCAL_DATABASE_URL } from '../../scripts/lib/localDatabase.mjs'
import { lockTimeSlot } from '../../src/lib/slotLock'

const NEON = 'postgres://u:p@ep-live-1-pooler.eu-central-1.aws.neon.tech/db?sslmode=require'

/** Rejects when `promise` has not settled after `ms` milliseconds: a hang becomes a failure. */
function within<T>(ms: number, promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`no answer within ${ms} ms: the save hung`)), ms)),
  ])
}

describe("saving from /admin on your laptop's database (PGlite)", () => {
  let db: PGlite
  let server: PGLiteSocketServer
  let payload: Payload
  let hung = false

  beforeAll(async () => {
    db = await PGlite.create()
    // As scripts/db.mjs starts it, on any free port.
    server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0, maxConnections: 50 })
    await server.start()
    const port = (server as unknown as { port: number }).port
    const transactions = databaseTransactions(LOCAL_DATABASE_URL)
    const config = buildConfig({
      secret: 'test-secret-0123456789-0123456789',
      // As src/payload.config.ts records it, for src/lib/slotLock.ts.
      custom: { databaseTransactions: transactions },
      collections: [
        { slug: 'users', auth: true, fields: [] },
        {
          slug: 'clinics',
          // Saving a time slot or a booking locks the slot (src/lib/slotLock.ts); here a clinic stands in.
          hooks: { beforeChange: [async ({ data, originalDoc, req }) => { if (originalDoc) await lockTimeSlot(req, originalDoc.id, 'clinics' as never); return data }] },
          fields: [
            { name: 'name', type: 'text', required: true },
            // The W5 list: the student's save that hung added rows to it.
            { name: 'whatToBring', type: 'array', fields: [{ name: 'item', type: 'text', required: true }] },
          ],
        },
      ],
      db: postgresAdapter({
        pool: { connectionString: `postgres://postgres:postgres@127.0.0.1:${port}/postgres` },
        // A throwaway in-memory database: build its tables from the fields.
        push: true,
        // The setting the app's config chooses for the laptop's database (src/payload.config.ts).
        ...(transactions ? {} : { transactionOptions: false as const }),
      }),
      logger: { options: { level: 'error' } } as never,
    })
    payload = await getPayload({ config, key: 'laptop-database', disableOnInit: true })
  }, 60_000)

  afterAll(async () => {
    // After a hang the connections are stuck: closing them would wait forever too.
    if (!hung && payload) {
      const pool = (payload.db as unknown as PostgresAdapter).pool
      ;(pool as typeof pool & { _clients: PoolClient[] })._clients[0]?.release()
      await pool.end()
      await payload.destroy()
    }
    await server?.stop()
    if (!hung) await db?.close()
  })

  it('an update as /admin sends it (it checks the record lock) finishes, with array rows', async () => {
    // This test's own two collections, not the app's: the app's generated types do not describe them.
    type Clinic = { id: number; name: string; whatToBring?: { item: string }[] }
    const local = payload as unknown as {
      create: (args: object) => Promise<Clinic>
      update: (args: object) => Promise<Clinic>
    }
    try {
      const clinic = await within(10_000, local.create({ collection: 'clinics', data: { name: 'Test clinic' } }))
      // overrideLock: false is what /admin and the REST API use: Payload checks who has the record open.
      const updated = await within(
        10_000,
        local.update({
          collection: 'clinics',
          id: clinic.id,
          data: { whatToBring: [{ item: 'your bike' }, { item: 'a lock' }] },
          overrideLock: false,
        }),
      )
      expect(updated.whatToBring?.map((row) => row.item)).toEqual(['your bike', 'a lock'])
      // And the database still answers afterwards.
      const again = await within(10_000, local.update({ collection: 'clinics', id: clinic.id, data: { name: 'Renamed' }, overrideLock: false }))
      expect(again.name).toBe('Renamed')
    } catch (error) {
      if (String(error).includes('no answer within')) hung = true
      throw error
    }
  }, 40_000)
})

describe('which databases run without transactions', () => {
  it("only your laptop's database: the live and preview databases (Neon) and the tests' own keep them", () => {
    expect(databaseTransactions(LOCAL_DATABASE_URL)).toBe(false)
    expect(databaseTransactions(NEON)).toBe(true)
    // CI's Postgres and the tests' PGlite: on this computer, but not the laptop's database.
    expect(databaseTransactions('postgres://postgres:postgres@localhost:5432/postgres')).toBe(true)
    expect(databaseTransactions('postgres://postgres:postgres@127.0.0.1:61234/postgres')).toBe(true)
  })

  it('the app config follows it: transactions off for the laptop database, on for Neon', async () => {
    const original = process.env.DATABASE_URL
    try {
      for (const [url, expected] of [[LOCAL_DATABASE_URL, false], [NEON, true]] as const) {
        vi.resetModules()
        process.env.DATABASE_URL = url
        const config = await (await import('../../src/payload.config')).default
        expect(config.custom?.databaseTransactions, url).toBe(expected)
      }
    } finally {
      if (original === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = original
      vi.resetModules()
    }
  })

  it('the time slot lock stands aside when the database runs without transactions, and only then', async () => {
    // Without transactions, Payload sets transactionID to a promise of null (initTransaction).
    const req = (databaseTransactions: boolean, transactionID?: Promise<null>) =>
      ({ transactionID, payload: { db: { sessions: {} }, config: { custom: { databaseTransactions } } } }) as unknown as PayloadRequest
    await expect(lockTimeSlot(req(false, Promise.resolve(null)), 1)).resolves.toBeUndefined()
    await expect(lockTimeSlot(req(false), 1)).resolves.toBeUndefined()
    await expect(lockTimeSlot(req(true, Promise.resolve(null)), 1)).rejects.toThrow(/transaction/)
    await expect(lockTimeSlot(req(true), 1)).rejects.toThrow(/transaction/)
  })
})
