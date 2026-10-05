// Remembers, inside the database itself, that the example content was added, so the seed adds it only
// ONCE per database (see the top of src/seed/seed.ts for why).
//
// It is one row in a small table of its own, public.starter_example_seeded, written with plain SQL
// over the seed's own database connection. On purpose NOT a Payload collection: Payload's config and
// migrations never see it, nobody can change it in /admin, and it works the same way as the
// production marker the build keeps (scripts/lib/marker.mjs).
//
// A preview database is a copy of production, so it has this row too and is never seeded again.
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

// Schema-qualified ("public."), like the production marker: the table is always found, whatever
// search path the database connection uses.
const TABLE = 'public.starter_example_seeded'

function query(payload: Payload, text: string) {
  return (payload.db as unknown as PostgresAdapter).pool.query(text)
}

/** True when a seed run on this database has added the example content before and finished. */
export async function exampleWasAdded(payload: Payload): Promise<boolean> {
  // to_regclass gives NULL when the table does not exist yet (no seed has ever finished here); a plain
  // `select` would throw instead.
  const exists = await query(payload, `select to_regclass('${TABLE}') as t`)
  if (!exists.rows[0]?.t) return false
  const row = await query(payload, `select 1 from ${TABLE} where id = 1`)
  return (row.rowCount ?? 0) > 0
}

/** Records that the example content was added. Writing it twice changes nothing. */
export async function recordExampleAdded(payload: Payload): Promise<void> {
  await query(
    payload,
    `create table if not exists ${TABLE} (id int primary key, seeded_at timestamptz not null default now())`,
  )
  // One row, always id = 1. "do nothing" when it is there: the date of the first time is kept.
  await query(payload, `insert into ${TABLE} (id) values (1) on conflict (id) do nothing`)
}
