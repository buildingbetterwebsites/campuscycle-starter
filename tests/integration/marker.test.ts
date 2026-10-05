import pg from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { readMarker, writeMarker } from '../../scripts/lib/marker.mjs'

// The marker lives in its own table (`starter_production_marker`), outside anything Payload's
// migrations know about, on the SAME test database the rest of the suite uses (tests/setup/pglite.ts
// sets TEST_DATABASE_URL and migrates it before any test runs).
const url = () => process.env.TEST_DATABASE_URL

// Each test starts with no marker table, and the last one removes it again. On a database that lives
// on between runs (a real Postgres instead of the in-memory one), a marker left behind would make the
// next run's "gives null" test fail, and would make that database look like a live one to the guard.
async function dropMarkerTable() {
  const client = new pg.Client({ connectionString: url() })
  await client.connect()
  try {
    await client.query('drop table if exists public.starter_production_marker')
  } finally {
    await client.end()
  }
}

describe('readMarker / writeMarker', () => {
  beforeEach(dropMarkerTable)
  afterAll(dropMarkerTable)

  it('gives null before anything has ever written a marker', async () => {
    expect(await readMarker(url())).toBeNull()
  })

  it('creates the table on first write and reads back what was written', async () => {
    await writeMarker(url(), 'ep-a')
    expect(await readMarker(url())).toBe('ep-a')
  })

  it('upserts on a second write - the marker always names the one, current endpoint', async () => {
    await writeMarker(url(), 'ep-a')
    await writeMarker(url(), 'ep-b')
    expect(await readMarker(url())).toBe('ep-b')
  })
})
