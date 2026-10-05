import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { CollectionSlug } from 'payload'
import { handleEndpoints } from 'payload'
import sharp from 'sharp'
import config from '../setup/config'
import { getTestPayload, resetCollections } from '../setup/payload'
import { refuseUnlessThrowAwayTestDatabase } from '../setup/safety'

// These tests delete every user: never on a real database.
refuseUnlessThrowAwayTestDatabase()

const editor = { collection: 'users', id: 1, email: 'editor@campuscycle.example' }
const member = { collection: 'members', id: 2, email: 'member@campuscycle.example' }
const publicCollections: CollectionSlug[] = ['pages', 'topics', 'workshops', 'clinics', 'timeSlots', 'repairs', 'media']
const clean = ['bookings', 'timeSlots', 'clinics', 'workshops', 'topics', 'repairs', 'pages', 'throttle', 'users']
// The booking's private details used in these tests. None of them may ever reach a public reader.
const PRIVATE_DATA = /Private Test Person|private@campuscycle|Private test note/

describe('collection access', () => {
  beforeEach(() => resetCollections(clean))
  afterAll(() => resetCollections(clean))

  it('allows public content reads and refuses private reads for anonymous users and members', async () => {
    const p = await getTestPayload()
    for (const user of [undefined, member]) {
      for (const collection of publicCollections) {
        await expect(p.find({ collection, overrideAccess: false, user })).resolves.toHaveProperty('docs')
      }
      for (const collection of ['bookings', 'users', 'throttle'] as const) {
        await expect(p.find({ collection, overrideAccess: false, user })).rejects.toThrow(/not allowed/)
      }
    }
  })

  it('rejects public mutations before saving records, including account creation', async () => {
    const p = await getTestPayload()
    for (const user of [undefined, member]) {
      for (const collection of [...publicCollections, 'bookings', 'users', 'throttle'] as CollectionSlug[]) {
        await expect(p.create({ collection, data: {} as never, overrideAccess: false, user })).rejects.toThrow(/not allowed/)
        await expect(p.update({ collection, id: 1, data: {}, overrideAccess: false, user })).rejects.toThrow(/not allowed/)
        await expect(p.delete({ collection, id: 1, overrideAccess: false, user })).rejects.toThrow(/not allowed/)
      }
    }
  })

  it('keeps booking creation and every throttle operation closed to editors too', async () => {
    const p = await getTestPayload()
    await expect(p.create({ collection: 'bookings', data: {} as never, overrideAccess: false, user: editor })).rejects.toThrow(/not allowed/)
    await expect(p.create({ collection: 'throttle', data: { key: 'test' }, overrideAccess: false, user: editor })).rejects.toThrow(/not allowed/)
    await expect(p.find({ collection: 'throttle', overrideAccess: false, user: editor })).rejects.toThrow(/not allowed/)
    await expect(p.update({ collection: 'throttle', id: 1, data: { key: 'changed' }, overrideAccess: false, user: editor })).rejects.toThrow(/not allowed/)
    await expect(p.delete({ collection: 'throttle', id: 1, overrideAccess: false, user: editor })).rejects.toThrow(/not allowed/)
  })

  it('refuses anonymous booking creation through the REST handler', async () => {
    const p = await getTestPayload()
    const response = await handleEndpoints({ config, path: '/api/bookings', request: new Request('http://localhost/api/bookings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeSlot: 1, name: 'Test Person', email: 'test@campuscycle.example' }),
    }) })
    expect(response.status).toBe(403)
    expect((await p.count({ collection: 'bookings' })).totalDocs).toBe(0)
  })

  it('allows editor image uploads with required alt text and public reads', async () => {
    const p = await getTestPayload()
    const data = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'white' } }).png().toBuffer()
    const file = { data, name: 'test-model.png', mimetype: 'image/png', size: data.length }
    await expect(p.create({ collection: 'media', data: { alt: '' }, file, overrideAccess: false, user: editor })).rejects.toThrow(/Alt/)
    const media = await p.create({ collection: 'media', data: { alt: 'A plain white test image.' }, file, overrideAccess: false, user: editor })
    try {
      expect((await p.findByID({ collection: 'media', id: media.id, overrideAccess: false })).alt).toBe('A plain white test image.')
      await p.update({ collection: 'media', id: media.id, data: { alt: 'A white test square.' }, overrideAccess: false, user: editor })
    } finally { await p.delete({ collection: 'media', id: media.id, overrideAccess: false, user: editor }) }
  })

  it('allows editors to maintain content and private bookings', async () => {
    const p = await getTestPayload()
    const options = { overrideAccess: false, user: editor }
    const page = await p.create({ collection: 'pages', data: { title: 'Test page', slug: 'test-page' }, ...options })
    const topic = await p.create({ collection: 'topics', data: { name: 'Test topic', slug: 'test-topic' }, ...options })
    const workshop = await p.create({ collection: 'workshops', data: { title: 'Test workshop', slug: 'test-workshop', level: 'beginner', day: 'Tuesday', startTime: '18:30', price: 15, groupSize: 6, summary: 'Test instance.', topics: [topic.id] }, ...options })
    const clinic = await p.create({ collection: 'clinics', data: { name: 'Test clinic', slug: 'test-clinic', day: 'Saturday', startTime: '15:00', endTime: '17:00', summary: 'Test instance.' }, ...options })
    const slot = await p.create({ collection: 'timeSlots', data: { clinic: clinic.id, startsAt: '2026-10-10T13:00:00Z', places: 2 }, ...options })
    const repair = await p.create({ collection: 'repairs', data: { name: 'Test repair', price: 5 }, ...options })
    // A second editor account, so deleting `user` below never removes the last one (that is refused).
    await p.create({ collection: 'users', data: { email: 'editor@campuscycle.example', password: 'test-password-0123456789' }, ...options })
    const user = await p.create({ collection: 'users', data: { email: 'test@campuscycle.example', password: 'test-password-0123456789' }, ...options })
    const booking = await p.create({ collection: 'bookings', data: { timeSlot: slot.id, name: 'Test Person', email: 'private@campuscycle.example' }, overrideAccess: true })
    for (const [collection, id] of [['bookings', booking.id], ['timeSlots', slot.id], ['clinics', clinic.id], ['workshops', workshop.id], ['topics', topic.id], ['repairs', repair.id], ['pages', page.id], ['users', user.id]] as const) {
      expect((await p.findByID({ collection, id, ...options })).id).toBe(id)
      await expect(p.update({ collection, id, data: {}, ...options })).resolves.toHaveProperty('id', id)
      await expect(p.delete({ collection, id, ...options })).resolves.toHaveProperty('id', id)
    }
  })

  it('removes booking joins from public slot and clinic data even when Local API access is bypassed', async () => {
    const p = await getTestPayload()
    const clinic = await p.create({ collection: 'clinics', data: { name: 'Test clinic', slug: 'test-clinic', day: 'Saturday', startTime: '15:00', endTime: '17:00', summary: 'Test instance.' } })
    const slot = await p.create({ collection: 'timeSlots', data: { clinic: clinic.id, startsAt: '2026-10-10T13:00:00Z', places: 2 } })
    await p.create({ collection: 'bookings', data: { timeSlot: slot.id, name: 'Private Test Person', email: 'private@campuscycle.example', note: 'Private test note' } })
    for (const user of [undefined, member]) {
      for (const depth of [0, 1, 2, 10]) {
        for (const overrideAccess of [false, true]) {
          for (const [collection, id] of [['timeSlots', slot.id], ['clinics', clinic.id]] as const) {
            const result = await p.findByID({ collection, id, depth, overrideAccess, user })
            expect(result).not.toHaveProperty('bookings')
            for (const slotDoc of collection === 'clinics' ? (result as { timeSlots?: { docs?: unknown[] } }).timeSlots?.docs ?? [] : []) {
              if (typeof slotDoc === 'object') expect(slotDoc).not.toHaveProperty('bookings')
            }
            expect(JSON.stringify(result)).not.toMatch(PRIVATE_DATA)
          }
        }
      }
    }
  })

  it('shows an editor the slot\'s bookings with access checks switched on', async () => {
    const p = await getTestPayload()
    const clinic = await p.create({ collection: 'clinics', data: { name: 'Test clinic', slug: 'test-clinic', day: 'Saturday', startTime: '15:00', endTime: '17:00', summary: 'Test instance.' } })
    const slot = await p.create({ collection: 'timeSlots', data: { clinic: clinic.id, startsAt: '2026-10-10T13:00:00Z', places: 2 } })
    const booking = await p.create({ collection: 'bookings', data: { timeSlot: slot.id, name: 'Private Test Person', email: 'private@campuscycle.example' } })
    const found = await p.findByID({ collection: 'timeSlots', id: slot.id, overrideAccess: false, user: editor })
    expect(found.bookings?.docs?.map(b => typeof b === 'object' ? b.id : b)).toEqual([booking.id])
  })

  it('refuses queries that filter on bookings, so nobody can guess names or e-mail addresses', async () => {
    const p = await getTestPayload()
    const clinic = await p.create({ collection: 'clinics', data: { name: 'Test clinic', slug: 'test-clinic', day: 'Saturday', startTime: '15:00', endTime: '17:00', summary: 'Test instance.' } })
    const slot = await p.create({ collection: 'timeSlots', data: { clinic: clinic.id, startsAt: '2026-10-10T13:00:00Z', places: 2 } })
    await p.create({ collection: 'bookings', data: { timeSlot: slot.id, name: 'Private Test Person', email: 'private@campuscycle.example', note: 'Private test note' } })
    for (const user of [undefined, member]) {
      // A matching and a non-matching guess must look exactly the same: both are refused outright.
      for (const guess of ['private', 'nobody-has-this']) {
        const slotQuery = p.find({ collection: 'timeSlots', where: { 'bookings.email': { like: guess } }, overrideAccess: false, user })
        await expect(slotQuery).rejects.toMatchObject({ name: 'QueryError' })
        await expect(slotQuery.catch((error: Error) => error.message)).resolves.not.toMatch(PRIVATE_DATA)
      }
      // The same filter one level further, from clinics ('timeSlots.bookings.email'), is refused too,
      // but Payload 3.90.2 leaves some of its own checks unfinished when it refuses that one, which
      // the test runner reports as stray errors. The depth-2 test below covers clinics instead.
      await expect(p.find({ collection: 'timeSlots', where: { bookings: { exists: true } }, overrideAccess: false, user })).rejects.toMatchObject({ name: 'QueryError' })
    }
  })

  it('leaves bookings out of clinic and slot lists, even when the joins are asked for at depth 2', async () => {
    const p = await getTestPayload()
    const clinic = await p.create({ collection: 'clinics', data: { name: 'Test clinic', slug: 'test-clinic', day: 'Saturday', startTime: '15:00', endTime: '17:00', summary: 'Test instance.' } })
    const slot = await p.create({ collection: 'timeSlots', data: { clinic: clinic.id, startsAt: '2026-10-10T13:00:00Z', places: 2 } })
    await p.create({ collection: 'bookings', data: { timeSlot: slot.id, name: 'Private Test Person', email: 'private@campuscycle.example', note: 'Private test note' } })
    for (const user of [undefined, member]) {
      const clinics = await p.find({ collection: 'clinics', depth: 2, joins: { timeSlots: { limit: 10 } }, overrideAccess: false, user })
      expect(clinics.docs).toHaveLength(1)
      expect(JSON.stringify(clinics)).not.toMatch(PRIVATE_DATA)
      const slots = await p.find({ collection: 'timeSlots', depth: 2, joins: { bookings: { limit: 10 } }, overrideAccess: false, user })
      expect(slots.docs).toHaveLength(1)
      expect(slots.docs[0]).not.toHaveProperty('bookings')
      expect(JSON.stringify(slots)).not.toMatch(PRIVATE_DATA)
    }
  })

  it('refuses to delete the last editor, and allows it while another editor remains', async () => {
    const p = await getTestPayload()
    const options = { overrideAccess: false, user: editor }
    const first = await p.create({ collection: 'users', data: { email: 'first@campuscycle.example', password: 'test-password-0123456789' }, overrideAccess: true })
    await expect(p.delete({ collection: 'users', id: first.id, ...options })).rejects.toThrow(
      'You cannot delete the last editor: nobody could log in to /admin any more. Create another editor first if you want to replace this one.',
    )
    expect((await p.count({ collection: 'users' })).totalDocs).toBe(1)
    const second = await p.create({ collection: 'users', data: { email: 'second@campuscycle.example', password: 'test-password-0123456789' }, overrideAccess: true })
    await expect(p.delete({ collection: 'users', id: first.id, ...options })).resolves.toHaveProperty('id', first.id)
    // The bulk form (select every editor in /admin, then delete) must not get round the rule either.
    // It is refused as a whole, before anything is deleted.
    await p.create({ collection: 'users', data: { email: 'third@campuscycle.example', password: 'test-password-0123456789' }, overrideAccess: true })
    await expect(p.delete({ collection: 'users', where: { id: { exists: true } }, ...options })).rejects.toThrow('You cannot delete the last editor')
    expect((await p.count({ collection: 'users' })).totalDocs).toBe(2)
    // Deleting only some of them is fine.
    await expect(p.delete({ collection: 'users', where: { id: { equals: second.id } }, ...options })).resolves.toMatchObject({ errors: [] })
    expect((await p.count({ collection: 'users' })).totalDocs).toBe(1)
  })

  // The last-editor rule must not answer before the access rules do: someone who may not delete users
  // at all gets the usual "not allowed" (403), never a hint about how many editors there are.
  it('refuses an anonymous or member delete of the last editor as Forbidden, not with the last-editor message', async () => {
    const p = await getTestPayload()
    const only = await p.create({ collection: 'users', data: { email: 'only@campuscycle.example', password: 'test-password-0123456789' }, overrideAccess: true })
    for (const user of [undefined, member]) {
      const byId = p.delete({ collection: 'users', id: only.id, overrideAccess: false, user })
      await expect(byId).rejects.toThrow(/not allowed/)
      await expect(byId).rejects.not.toThrow(/last editor/)
      const bulk = p.delete({ collection: 'users', where: { id: { exists: true } }, overrideAccess: false, user })
      await expect(bulk).rejects.toThrow(/not allowed/)
    }
    const response = await handleEndpoints({ config, path: `/api/users/${only.id}`, request: new Request(`http://localhost/api/users/${only.id}`, { method: 'DELETE' }) })
    expect(response.status).toBe(403)
    expect(await response.text()).not.toMatch(/last editor/)
    expect((await p.count({ collection: 'users' })).totalDocs).toBe(1)
  })
})
