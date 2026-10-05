import type { CollectionSlug, PayloadRequest } from 'payload'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'

/**
 * Locks one time slot's row until the current database transaction ends.
 *
 * WHY: two things can happen to the same time slot at the same moment - an editor lowers its places
 * while a user books the last free place. Each one first counts the bookings, then saves. Without a
 * lock, both could count before either saves, and the slot would end up with more bookings than places.
 * With this lock, the second one waits until the first has finished, and then counts again.
 *
 * Everything that counts a slot's bookings before saving must call this first: the places check in
 * src/lib/modelIntegrity.ts, and the places rule of the booking form (src/tasks/book-slot/capacity.ts).
 *
 * `collection` is the collection whose record is locked: the time slots unless you say otherwise. The
 * places rule passes its own setting (src/tasks/book-slot/places.ts), so a team that points that rule
 * at, say, performances locks a performance instead.
 */
export async function lockTimeSlot(req: PayloadRequest, id: number | string, collection: CollectionSlug = 'timeSlots'): Promise<void> {
  const adapter = req.payload.db as unknown as PostgresAdapter

  // A lock only lasts as long as its transaction. Outside one, Postgres would take the lock and let
  // go of it straight away, so the "lock" would silently protect nothing. Refuse loudly instead.
  const transactionID = req.transactionID ? await req.transactionID : undefined
  const transaction = transactionID === undefined ? undefined : adapter.sessions[String(transactionID)]
  if (!transaction) {
    throw new Error('lockTimeSlot needs a database transaction: call it from a hook or operation that runs inside one.')
  }

  // Ask Payload which table holds the records, instead of typing the table name here: the name
  // follows the collection's settings (a `dbName` setting changes it), and this keeps working if those
  // ever change. Payload's list of tables is keyed by the collection slug in snake_case: timeSlots
  // becomes time_slots.
  const key = collection.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
  const tableName = adapter.tableNameMap.get(key)
  const table = tableName ? adapter.tables[tableName] : undefined
  if (!table) {
    throw new Error(`lockTimeSlot could not find the table of the collection "${collection}".`)
  }

  // "for update" is the lock: other transactions that want this same row wait here until ours ends.
  await transaction.db.execute(sql`select ${table.id} from ${table} where ${table.id} = ${id} for update`)
}
