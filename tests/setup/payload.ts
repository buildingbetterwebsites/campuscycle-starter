import { getPayload, type Payload } from 'payload'
import config from './config'
import { afterAll } from 'vitest'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import type { PoolClient } from 'pg'
import { refuseUnlessThrowAwayTestDatabase } from './safety'

let cached: Payload | undefined

// Each test file owns an instance. Release its connections before the next file starts.
afterAll(async () => {
  if (!cached) return
  // Payload 3.90.2 keeps its first connection checked out for reconnection monitoring.
  // Release that test-owned connection before ending the pool; destroy alone does not close it.
  // If a test run hangs here (for example after a Payload upgrade), this workaround is obsolete: it no
  // longer matches how Payload holds that connection. Check whether the new version releases it itself,
  // then update or remove the lines below.
  const pool = (cached.db as unknown as PostgresAdapter).pool
  const initial = (pool as typeof pool & { _clients: PoolClient[] })._clients[0]
  initial?.release()
  await pool.end()
  await cached.destroy()
})

/**
 * One Payload instance per test file, on the test database.
 *
 * `disableOnInit: true`: the app's `onInit` hook fails closed when no admin user
 * exists yet. Tests must not depend on that hook running, so it is switched off here.
 */
export async function getTestPayload(): Promise<Payload> {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  // The config also accepts STORAGE_URL; a different one would be refused as a second address.
  delete process.env.STORAGE_URL
  process.env.PAYLOAD_SECRET ??= 'test-secret-0123456789-0123456789'
  cached ??= await getPayload({ config, disableOnInit: true })
  return cached
}

/**
 * Deletes every record of the given collections, so each test starts clean.
 *
 * It goes straight to the database adapter, skipping the collection hooks on purpose: a test must be
 * able to start from zero editors (firstAdmin's tests do), which the "keep one editor" hook refuses.
 * List children before their parents (bookings before timeSlots), because the database still refuses
 * to delete a parent that has linked records.
 */
export async function resetCollections(slugs: string[]): Promise<void> {
  // Deleting every user on a real site would lock its editors out: only on a test database.
  if (slugs.includes('users')) refuseUnlessThrowAwayTestDatabase()
  const payload = await getTestPayload()
  for (const collection of slugs) {
    await payload.db.deleteMany({ collection: collection as never, where: { id: { exists: true } } })
  }
}

/**
 * Forgets that the example content was added (src/seed/exampleFlag.ts), so the next seed run adds it
 * again. Only for tests: on a real site, nothing ever removes the flag.
 */
export async function forgetExampleAdded(): Promise<void> {
  const payload = await getTestPayload()
  await (payload.db as unknown as PostgresAdapter).pool.query('drop table if exists public.starter_example_seeded')
}

/**
 * Empties the Site facts global (src/globals/SiteFacts.ts), so the next seed run fills it again. A
 * global is one row in its own table; without that row it reads as empty.
 */
export async function resetSiteFacts(): Promise<void> {
  refuseUnlessThrowAwayTestDatabase()
  const payload = await getTestPayload()
  await (payload.db as unknown as PostgresAdapter).pool.query('delete from public.site_facts')
}
