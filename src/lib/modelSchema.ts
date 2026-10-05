import type { PostgresAdapterArgs } from '@payloadcms/db-postgres'

/** Database restrictions cover concurrent requests as well as the friendly collection hooks. */
export const restrictLinkedDeletion: NonNullable<PostgresAdapterArgs['beforeSchemaInit']>[number] = ({ adapter, schema }) => {
  // Payload normally clears these links on deletion. The course model requires explicit unlinking.
  for (const [tableName, target] of [['time_slots', 'clinics'], ['bookings', 'time_slots'], ['workshops_rels', 'topics']]) {
    const table = adapter.rawTables[tableName]
    if (!table) throw new Error(`Missing model table: ${tableName}`)
    for (const column of Object.values(table.columns)) {
      if (column.reference?.table === target) {
        column.reference.onDelete = 'restrict'
        // A time slot without a clinic, or a booking without a time slot, makes no sense, so the
        // database refuses an empty link too ("not null"). workshops_rels is different: it is Payload's
        // table of many-to-many links, where one row can hold a link to some OTHER collection instead,
        // leaving this column empty on purpose.
        if (tableName !== 'workshops_rels') column.notNull = true
      }
    }
    for (const key of Object.values(table.foreignKeys ?? {})) {
      if (key.foreignColumns.some(column => column.table === target)) key.onDelete = 'restrict'
    }
  }
  return schema
}
