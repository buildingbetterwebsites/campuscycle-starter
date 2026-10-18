// The database rules in src/lib/modelSchema.ts (restrictLinkedDeletion), without a database: they
// change the table descriptions Payload builds before it talks to Postgres. A site that removed the
// example collections (npm run remove-example) has fewer tables, and must still start.
import { describe, expect, it } from 'vitest'
import { restrictLinkedDeletion } from '../../src/lib/modelSchema'

type Column = { reference?: { table: string; onDelete?: string }; notNull?: boolean }
type ForeignKey = { foreignColumns: { table: string }[]; onDelete?: string }
type Table = { columns: Record<string, Column>; foreignKeys?: Record<string, ForeignKey> }

function linkTo(target: string): Table {
  return {
    columns: { link: { reference: { table: target, onDelete: 'set null' } }, other: {} },
    foreignKeys: { link_fk: { foreignColumns: [{ table: target }], onDelete: 'set null' } },
  }
}

function run(rawTables: Record<string, Table>) {
  const schema = { marker: 'the schema' }
  const result = restrictLinkedDeletion({ adapter: { rawTables }, schema } as never)
  return { result, schema }
}

describe('restrictLinkedDeletion', () => {
  it('restricts deleting a linked clinic, time slot or topic, and makes the one-to-many links required', () => {
    const tables = { time_slots: linkTo('clinics'), bookings: linkTo('time_slots'), workshops_rels: linkTo('topics') }
    const { result, schema } = run(tables)
    expect(result).toBe(schema)
    for (const table of Object.values(tables)) {
      expect(table.columns.link.reference?.onDelete).toBe('restrict')
      expect(table.foreignKeys?.link_fk.onDelete).toBe('restrict')
      expect(table.columns.other).toEqual({})
    }
    expect(tables.time_slots.columns.link.notNull).toBe(true)
    expect(tables.bookings.columns.link.notNull).toBe(true)
    // A row of Payload's many-to-many table can link to another collection, so this one stays optional.
    expect(tables.workshops_rels.columns.link.notNull).toBeUndefined()
  })

  it('skips a table that is not there (the example collections removed), and still restricts the rest', () => {
    const tables = { time_slots: linkTo('clinics'), bookings: linkTo('time_slots') }
    expect(() => run(tables)).not.toThrow()
    expect(tables.time_slots.columns.link.reference?.onDelete).toBe('restrict')
    expect(tables.bookings.columns.link.notNull).toBe(true)
  })

  it('starts with none of them at all (a model of its own)', () => {
    const rooms = linkTo('features')
    expect(() => run({ rooms_rels: rooms })).not.toThrow()
    // A link it does not name keeps Payload's own rule.
    expect(rooms.columns.link.reference?.onDelete).toBe('set null')
  })
})
