import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { getTestPayload, resetCollections } from '../setup/payload'

const collections = ['bookings', 'timeSlots', 'clinics', 'workshops', 'topics', 'repairs', 'pages']
export const workshopData = { title: 'Test workshop', slug: 'test-workshop', level: 'beginner' as const, day: 'Tuesday' as const, startTime: '18:30', price: 15, groupSize: 6, summary: 'Test instance.' }
export const clinicData = { name: 'Test clinic', slug: 'test-clinic', day: 'Saturday' as const, startTime: '15:00', endTime: '17:00', summary: 'Test instance. Code K7Q2.' }

describe('the content model', () => {
  beforeEach(() => resetCollections(collections))
  afterAll(() => resetCollections(collections))

  it('stores many-to-many membership once and reads both directions', async () => {
    const p = await getTestPayload()
    const a = await p.create({ collection: 'topics', data: { name: 'Tyres', slug: 'tyres' } })
    const b = await p.create({ collection: 'topics', data: { name: 'Maintenance', slug: 'maintenance' } })
    const first = await p.create({ collection: 'workshops', data: { ...workshopData, topics: [a.id, b.id] } })
    await p.create({ collection: 'workshops', data: { ...workshopData, slug: 'second', topics: [b.id] } })
    const found = await p.findByID({ collection: 'topics', id: b.id, depth: 1 })
    expect(found.workshops?.docs).toHaveLength(2)
    expect((await p.findByID({ collection: 'workshops', id: first.id, depth: 1 })).topics).toHaveLength(2)
    await p.update({ collection: 'workshops', id: first.id, data: { topics: [a.id], title: 'Changed title' } })
    expect((await p.findByID({ collection: 'topics', id: b.id })).workshops?.docs).toHaveLength(1)
  })

  it('keeps required relations, editor reverse bookings, and learner additions separate', async () => {
    const p = await getTestPayload()
    const clinic = await p.create({ collection: 'clinics', data: clinicData })
    // The generated type requires places even though Payload supplies its default at runtime.
    // @ts-expect-error Deliberately omit places to exercise the runtime default.
    const slot = await p.create({ collection: 'timeSlots', data: { clinic: clinic.id, startsAt: '2026-10-10T13:00:00Z' } })
    expect(slot.places).toBe(2)
    const booking = await p.create({ collection: 'bookings', data: { timeSlot: slot.id, name: 'Test Person', email: 'test@campuscycle.example' } })
    const editor = { collection: 'users' as const, id: 1, email: 'editor@campuscycle.example' }
    const found = await p.findByID({ collection: 'timeSlots', id: slot.id, depth: 1, user: editor })
    expect(found.bookings?.docs?.map(b => typeof b === 'object' ? b.id : b)).toEqual([booking.id])
    expect((await p.findByID({ collection: 'clinics', id: clinic.id })).timeSlots?.docs).toHaveLength(1)
    // The learners' own additions (W5, W6) are not in the starter. bookings.member is: it belongs to
    // the optional members' area, which ships switched off (tests/integration/members.test.ts).
    for (const [collection, field] of [['clinics', 'whatToBring'], ['bookings', 'repairs'], ['repairs', 'bookings']] as const) {
      expect(p.collections[collection].config.flattenedFields.some(f => f.name === field)).toBe(false)
    }
  })

  it('rejects invalid references, duplicate slugs and invalid numeric values', async () => {
    const p = await getTestPayload()
    await p.create({ collection: 'workshops', data: workshopData })
    await expect(p.create({ collection: 'workshops', data: workshopData })).rejects.toThrow()
    await expect(p.create({ collection: 'workshops', data: { ...workshopData, slug: 'bad-reference', topics: [999999] } })).rejects.toThrow()
    for (const data of [{ price: -1 }, { groupSize: 1.5 }, { groupSize: 0 }]) {
      await expect(p.create({ collection: 'workshops', data: { ...workshopData, slug: 'bad-number', ...data } })).rejects.toThrow()
    }
    await expect(p.create({ collection: 'timeSlots', data: { clinic: 999999, startsAt: '2026-10-10T13:00:00Z', places: 2 } })).rejects.toThrow(/clinic no longer exists/)
    await expect(p.create({ collection: 'bookings', data: { timeSlot: 999999, name: 'Test', email: 'test@campuscycle.example' } })).rejects.toThrow()
    await expect(p.create({ collection: 'repairs', data: { name: 'Test', price: -1 } })).rejects.toThrow()
  })

  it('requires explicit unlinking and does not delete a clinic or slot with dependent records', async () => {
    const p = await getTestPayload()
    const topic = await p.create({ collection: 'topics', data: { name: 'Test', slug: 'test' } })
    const workshop = await p.create({ collection: 'workshops', data: { ...workshopData, topics: [topic.id] } })
    await expect(p.delete({ collection: 'topics', id: topic.id })).rejects.toThrow('This topic is still used by workshops (see its Workshops list). Remove it from each workshop, then delete the topic.')
    await p.update({ collection: 'workshops', id: workshop.id, data: { topics: [] } })
    await p.delete({ collection: 'topics', id: topic.id })
    const clinic = await p.create({ collection: 'clinics', data: clinicData })
    const slot = await p.create({ collection: 'timeSlots', data: { clinic: clinic.id, startsAt: '2026-10-10T13:00:00Z', places: 2 } })
    const booking = await p.create({ collection: 'bookings', data: { timeSlot: slot.id, name: 'Test', email: 'test@campuscycle.example' } })
    await expect(p.delete({ collection: 'clinics', id: clinic.id })).rejects.toThrow('This clinic still has time slots. Open Time Slots and move each one to another clinic or delete it (move or delete a slot\'s bookings first). Then delete the clinic.')
    await expect(p.delete({ collection: 'timeSlots', id: slot.id })).rejects.toThrow('This time slot still has bookings. Open Bookings and move each one to another time slot or delete it, then delete the time slot.')
    await p.delete({ collection: 'bookings', id: booking.id })
    await p.delete({ collection: 'timeSlots', id: slot.id })
    await p.delete({ collection: 'clinics', id: clinic.id })
  })

  it('rejects fractional places and capacity reductions below existing bookings', async () => {
    const p = await getTestPayload()
    const clinic = await p.create({ collection: 'clinics', data: clinicData })
    for (const places of [0, -1, 1.5]) {
      await expect(p.create({ collection: 'timeSlots', data: { clinic: clinic.id, startsAt: '2026-10-10T13:00:00Z', places } })).rejects.toMatchObject({ data: { errors: [{ path: 'places', message: 'Enter a whole number of at least 1.' }] } })
    }
    const slot = await p.create({ collection: 'timeSlots', data: { clinic: clinic.id, startsAt: '2026-10-10T13:00:00Z', places: 2 } })
    expect(slot.label).toContain('15:00')
    for (const name of ['Test One', 'Test Two']) await p.create({ collection: 'bookings', data: { timeSlot: slot.id, name, email: 'test@campuscycle.example' } })
    const editor = { collection: 'users', id: 1 }
    await expect(p.update({ collection: 'timeSlots', id: slot.id, data: { places: 1 }, overrideAccess: false, user: editor })).rejects.toThrow('This time slot already has 2 bookings, so it needs at least 2 places. Choose a higher number, or move or delete bookings first.')
    expect((await p.findByID({ collection: 'timeSlots', id: slot.id })).places).toBe(2)
    await expect(p.update({ collection: 'timeSlots', id: slot.id, data: { places: 2 }, overrideAccess: false, user: editor })).resolves.toHaveProperty('places', 2)
    await expect(p.update({ collection: 'timeSlots', id: slot.id, data: { clinic: 999999 } })).rejects.toThrow(/clinic no longer exists/)
  })

  it('rejects a slug that is not lowercase letters, digits and hyphens, and explains a duplicate', async () => {
    const p = await getTestPayload()
    for (const slug of ['Repair a puncture', 'repair_a_puncture', 'Repair-A-Puncture', '-repair', 'repair-', 'repair--a']) {
      await expect(p.create({ collection: 'topics', data: { name: 'Test', slug } })).rejects.toMatchObject({ data: { errors: [{ path: 'slug', message: 'Use only lowercase letters, digits and hyphens, for example repair-a-puncture.' }] } })
    }
    await p.create({ collection: 'topics', data: { name: 'Test', slug: 'repair-a-puncture-2' } })
    await expect(p.create({ collection: 'topics', data: { name: 'Test', slug: 'repair-a-puncture-2' } })).rejects.toThrow('Another record already uses this slug. Choose a different one.')
  })

  it('explains a workshop image that no longer exists', async () => {
    const p = await getTestPayload()
    await expect(p.create({ collection: 'workshops', data: { ...workshopData, image: 999999 } })).rejects.toThrow('This image no longer exists. Choose another image.')
  })
})

// The hooks above give the friendly messages. These tests go AROUND the hooks, with plain SQL through
// the test's own connection pool, to prove the database itself still refuses: that is what protects the
// data when two requests race each other, or when code forgets to go through Payload.
describe('database restrictions without the hooks', () => {
  beforeEach(() => resetCollections(collections))
  afterAll(() => resetCollections(collections))

  async function deleteWithSql(table: 'clinics' | 'time_slots' | 'topics', id: number) {
    const p = await getTestPayload()
    const pool = (p.db as unknown as PostgresAdapter).pool
    // The table names are a fixed list in this file; the id stays a query parameter.
    return pool.query(`delete from ${table} where id = $1`, [id]).then(() => ({ code: 'deleted' }), (error: { code?: string, constraint?: string }) => error)
  }

  // Postgres 16 reports a refused ON DELETE RESTRICT as 23503 (foreign_key_violation); Postgres 17,
  // which PGlite runs, reports 23001 (restrict_violation). Both mean "a linked record still exists".
  // The constraint name proves WHICH link refused the deletion.
  function refusedBy(constraint: string) {
    return { code: expect.stringMatching(/^(23503|23001)$/), constraint }
  }

  it('refuses to delete a clinic that still has a time slot (SQLSTATE 23503 or 23001)', async () => {
    const p = await getTestPayload()
    const clinic = await p.create({ collection: 'clinics', data: clinicData })
    await p.create({ collection: 'timeSlots', data: { clinic: clinic.id, startsAt: '2026-10-10T13:00:00Z', places: 2 } })
    expect(await deleteWithSql('clinics', clinic.id)).toMatchObject(refusedBy('time_slots_clinic_id_clinics_id_fk'))
    expect((await p.count({ collection: 'clinics' })).totalDocs).toBe(1)
  })

  it('refuses to delete a time slot that still has a booking (SQLSTATE 23503 or 23001)', async () => {
    const p = await getTestPayload()
    const clinic = await p.create({ collection: 'clinics', data: clinicData })
    const slot = await p.create({ collection: 'timeSlots', data: { clinic: clinic.id, startsAt: '2026-10-10T13:00:00Z', places: 2 } })
    await p.create({ collection: 'bookings', data: { timeSlot: slot.id, name: 'Test Person', email: 'test@campuscycle.example' } })
    expect(await deleteWithSql('time_slots', slot.id)).toMatchObject(refusedBy('bookings_time_slot_id_time_slots_id_fk'))
    expect((await p.count({ collection: 'timeSlots' })).totalDocs).toBe(1)
  })

  it('refuses to delete a topic that a workshop still links to (SQLSTATE 23503 or 23001)', async () => {
    const p = await getTestPayload()
    const topic = await p.create({ collection: 'topics', data: { name: 'Test topic', slug: 'test-topic' } })
    const workshop = await p.create({ collection: 'workshops', data: { ...workshopData, topics: [topic.id] } })
    expect(await deleteWithSql('topics', topic.id)).toMatchObject(refusedBy('workshops_rels_topics_fk'))
    expect((await p.findByID({ collection: 'workshops', id: workshop.id, depth: 0 })).topics).toEqual([topic.id])
  })

  it('still deletes a parent with nothing linked to it (the restriction is not a blanket ban)', async () => {
    const p = await getTestPayload()
    const clinic = await p.create({ collection: 'clinics', data: clinicData })
    expect(await deleteWithSql('clinics', clinic.id)).toEqual({ code: 'deleted' })
  })
})
