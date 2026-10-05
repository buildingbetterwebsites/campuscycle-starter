// Two people booking the last place at the same moment, and the same form arriving twice at once.
// PGlite (the in-memory test database) answers one query at a time, so it can never show a race: these
// tests run only on a real Postgres (CI sets CI_REAL_POSTGRES=1 next to its Postgres service).
import { randomUUID } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'
import pg from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, resetCollections } from '../setup/payload'
import { refuseUnlessThrowAwayTestDatabase } from '../setup/safety'
import { createBooking } from '../../src/tasks/book-slot/createBooking'

const FULL = 'This slot is full. Choose another time.'
const clean = ['bookings', 'timeSlots', 'clinics', 'throttle']
const editor = { collection: 'users', id: 1, email: 'editor@campuscycle.example' }

describe.runIf(process.env.CI_REAL_POSTGRES === '1')('booking at the same moment (real Postgres)', () => {
  let p: Payload
  let clinicId: number

  const form = (fields: Record<string, string>) => {
    const data = new FormData()
    const all = { clinic: 'test-clinic', requestId: randomUUID(), name: 'Test Person', email: 'test@campuscycle.example', ...fields }
    for (const [name, value] of Object.entries(all)) data.append(name, value)
    return data
  }
  const slot = async (places = 2) =>
    p.create({ collection: 'timeSlots', data: { clinic: clinicId, startsAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(), places } })
  const count = async (slotId: number) => (await p.count({ collection: 'bookings', where: { timeSlot: { equals: slotId } } })).totalDocs

  beforeAll(async () => {
    refuseUnlessThrowAwayTestDatabase()
    p = await getTestPayload()
  })
  beforeEach(async () => {
    await resetCollections(clean)
    clinicId = (await p.create({ collection: 'clinics', data: { name: 'Test clinic', slug: 'test-clinic', day: 'Saturday', startTime: '15:00', endTime: '17:00', summary: 'Test instance.' } })).id
  })
  afterAll(() => resetCollections(clean))

  /**
   * Runs `sends` while a separate connection holds the slot's lock, and releases it only once `count`
   * of them wait for that lock: so they really arrive together, whatever the timing. (Without the places
   * rule's lock, every send counts the bookings before it waits, so all of them are saved.)
   */
  async function together<T>(slotId: number, count: number, sends: () => Promise<T>): Promise<T> {
    const holder = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL })
    await holder.connect()
    try {
      await holder.query('begin')
      await holder.query('select id from time_slots where id = $1 for update', [slotId])
      const running = sends()
      let waiting = 0
      for (let attempt = 0; attempt < 200 && waiting < count; attempt++) {
        await setTimeout(20)
        // Inside a transaction Postgres keeps showing the first look at pg_stat_activity; clear it, so
        // each look sees the sends that started waiting since.
        await holder.query('select pg_stat_clear_snapshot()')
        const { rows } = await holder.query("select count(*)::int as n from pg_stat_activity where wait_event_type = 'Lock' and datname = current_database()")
        waiting = rows[0].n
      }
      expect(waiting, 'every send waits at the places rule\'s lock').toBe(count)
      await holder.query('commit')
      return await running
    } finally {
      await holder.query('rollback').catch(() => undefined)
      await holder.end()
    }
  }

  it('five people book a slot with 2 places at once: exactly 2 are saved, 3 hear that it is full', async () => {
    const target = await slot(2)
    const results = await together(target.id, 5, () =>
      Promise.all(
        Array.from({ length: 5 }, (_, i) => createBooking(form({ timeSlot: String(target.id) }), { payload: p, ip: `198.51.100.${i + 1}`, now: new Date() })),
      ),
    )
    expect(results.filter((result) => result.ok)).toHaveLength(2)
    expect(results.filter((result) => !result.ok && result.message === FULL)).toHaveLength(3)
    expect(await count(target.id)).toBe(2)
  })

  it('the same form sent three times at once saves one booking, and all three answers name that booking', async () => {
    const target = await slot(2)
    const requestId = randomUUID()
    // All three find no earlier booking, and wait at the places rule's lock; once it is released they
    // save one after the other, so the second and third run into the first one's requestId.
    const results = await together(target.id, 3, () =>
      Promise.all(
        Array.from({ length: 3 }, () => createBooking(form({ timeSlot: String(target.id), requestId }), { payload: p, ip: '198.51.100.20', now: new Date() })),
      ),
    )
    const ids = results.map((result) => (result.ok ? result.bookingId : result.message))
    expect(new Set(ids).size).toBe(1)
    expect(typeof ids[0]).toBe('number')
    expect(await count(target.id)).toBe(1)
  })

  it('two editors move a booking each into the last place at once: one move is saved, the other is refused', async () => {
    const target = await slot(1)
    const from = await slot(2)
    const a = await p.create({ collection: 'bookings', data: { timeSlot: from.id, name: 'Test Person', email: 'test@campuscycle.example' } })
    const b = await p.create({ collection: 'bookings', data: { timeSlot: from.id, name: 'Test Person', email: 'test@campuscycle.example' } })
    const moves = await Promise.allSettled(
      [a, b].map((booking) => p.update({ collection: 'bookings', id: booking.id, data: { timeSlot: target.id }, overrideAccess: false, user: editor })),
    )
    expect(moves.filter((move) => move.status === 'fulfilled')).toHaveLength(1)
    const refused = moves.find((move) => move.status === 'rejected')
    expect(refused && String(refused.reason)).toContain(FULL)
    expect(await count(target.id)).toBe(1)
  })
})
