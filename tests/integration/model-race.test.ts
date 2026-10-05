import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import pg from 'pg'
import { setTimeout } from 'node:timers/promises'
import { getTestPayload, resetCollections } from '../setup/payload'

// PGlite serialises transactions. Only a real, isolated Postgres can establish these race results.
describe.runIf(process.env.CI_REAL_POSTGRES === '1')('database deletion restrictions under concurrent writes', () => {
  const clean = ['bookings', 'timeSlots', 'clinics', 'workshops', 'topics']
  beforeEach(() => resetCollections(clean))
  afterAll(() => resetCollections(clean))

  for (const parent of ['clinics', 'time_slots', 'topics'] as const) {
    it(`keeps ${parent} and its link when a child is being created during deletion`, async () => {
      const p = await getTestPayload()
      let id: number
      let insert: string
      let values: unknown[]
      if (parent === 'topics') {
        const topic = await p.create({ collection: 'topics', data: { name: 'Test topic', slug: 'test-topic' } })
        const workshop = await p.create({ collection: 'workshops', data: { title: 'Test workshop', slug: 'test-workshop', level: 'beginner', day: 'Tuesday', startTime: '18:30', price: 15, groupSize: 6, summary: 'Test instance.' } })
        id = topic.id
        insert = 'insert into workshops_rels (parent_id, path, topics_id) values ($1, $2, $3)'
        values = [workshop.id, 'topics', id]
      } else {
        const clinic = await p.create({ collection: 'clinics', data: { name: 'Test clinic', slug: 'test-clinic', day: 'Saturday', startTime: '15:00', endTime: '17:00', summary: 'Test instance.' } })
        if (parent === 'clinics') {
          id = clinic.id
          insert = 'insert into time_slots (clinic_id, starts_at, places) values ($1, $2, $3)'
          values = [id, '2026-10-10T13:00:00Z', 2]
        } else {
          const slot = await p.create({ collection: 'timeSlots', data: { clinic: clinic.id, startsAt: '2026-10-10T13:00:00Z', places: 2 } })
          id = slot.id
          insert = 'insert into bookings (time_slot_id, name, email) values ($1, $2, $3)'
          values = [id, 'Test Person', 'test@campuscycle.example']
        }
      }
      const writer = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL })
      const remover = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL })
      await writer.connect()
      await remover.connect()
      try {
        await writer.query('begin')
        await writer.query(insert, values)
        const { rows: [backend] } = await remover.query('select pg_backend_pid() as id')
        // Table names above are a fixed list. Values remain parameterised.
        const deletion = remover.query(`delete from ${parent} where id = $1`, [id]).then(() => ({ code: 'deleted' }), (error: { code: string }) => error)
        let blocked = false
        for (let attempt = 0; attempt < 100; attempt++) {
          const { rows: [activity] } = await writer.query('select wait_event_type from pg_stat_activity where pid = $1', [backend.id])
          if (activity?.wait_event_type === 'Lock') { blocked = true; break }
          await setTimeout(20)
        }
        await writer.query('commit')
        expect(blocked).toBe(true)
        // Postgres 16 says 23503 (foreign_key_violation), Postgres 17 says 23001 (restrict_violation).
        expect(['23503', '23001']).toContain((await deletion).code)
        expect((await writer.query(`select id from ${parent} where id = $1`, [id])).rowCount).toBe(1)
      } finally {
        await writer.query('rollback')
        await writer.end()
        await remover.end()
      }
    })
  }
})
