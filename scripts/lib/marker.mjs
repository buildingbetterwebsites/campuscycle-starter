// Records which Neon endpoint IS production, inside the database itself. The build gate (scripts/
// build.mjs) writes this every time it migrates production; the same build gate (for previews) and
// the local guard (scripts/guard.mjs) read it to tell a proven copy of production from the live
// database itself. It talks to Postgres directly with `pg`, over the migration's own connection - on
// purpose NOT through Payload, so it stays outside Payload's own migrations and schema and can never
// be touched by `payload migrate` on an ordinary branch.
import pg from 'pg'

import { withVerifiedSsl } from './ssl.mjs'

// Schema-qualified everywhere (create/insert/select), matching the to_regclass probe below: an
// unqualified name is looked up through the connection's search_path, which your own database
// (or a future migration) could change - qualifying it means the marker can never silently miss its
// own table, which would make the guard fail OPEN (read back `null`, as if nothing had ever run) on a
// database that in fact already has one.
const TABLE = 'public.starter_production_marker'

// Neon can take a few seconds to wake a scaled-to-zero database back up; a short default timeout
// would make that look like "could not reach the database" when it is really just still starting.
const CONNECTION_TIMEOUT_MS = 10_000

function connect(url) {
  return new pg.Client({ connectionString: withVerifiedSsl(url), connectionTimeoutMillis: CONNECTION_TIMEOUT_MS })
}

/** The endpoint id last written by writeMarker, or `null` if writeMarker has never run against this database. */
export async function readMarker(url) {
  const client = connect(url)
  await client.connect()
  try {
    // to_regclass gives the table's internal id if it exists, or SQL NULL if it does not - a plain
    // `select * from` would instead throw on a database where writeMarker has never run yet.
    const exists = await client.query(`select to_regclass('${TABLE}') as t`)
    if (!exists.rows[0].t) return null
    const row = await client.query(`select endpoint from ${TABLE} where id = 1`)
    return row.rows[0]?.endpoint ?? null
  } finally {
    await client.end()
  }
}

/** Records `id` as this database's endpoint, creating the table on first use and overwriting any earlier value. */
export async function writeMarker(url, id) {
  const client = connect(url)
  await client.connect()
  try {
    await client.query(
      `create table if not exists ${TABLE} (id int primary key, endpoint text not null, updated_at timestamptz not null default now())`,
    )
    // A single row, always id = 1: "insert, or update if it is already there" (upsert), so writing
    // twice never leaves two rows behind.
    await client.query(
      `insert into ${TABLE} (id, endpoint) values (1, $1) on conflict (id) do update set endpoint = excluded.endpoint, updated_at = now()`,
      [id],
    )
  } finally {
    await client.end()
  }
}
