// The booking form's server function (saveBooking.ts) on the test database: it opens the confirmation
// page after a save, and after a problem with the chosen time it has the clinic page read again, so the
// form shows every slot's places as they are now.
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, resetCollections } from '../setup/payload'
import { refuseUnlessThrowAwayTestDatabase } from '../setup/safety'

// Outside a running Next.js server there is no request: the test gives the headers, and records which
// pages saveBooking asks to read again.
const revalidated = vi.hoisted(() => [] as string[])
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => revalidated.push(path) }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}` }) }))
// A test can make createBooking give a chosen answer (answer.result); otherwise it runs for real.
const answer = vi.hoisted(() => ({ result: undefined as unknown }))
vi.mock('../../src/tasks/book-slot/createBooking', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/tasks/book-slot/createBooking')>()
  return { ...real, createBooking: (...args: Parameters<typeof real.createBooking>) => (answer.result ? Promise.resolve(answer.result) : real.createBooking(...args)) }
})

import { saveBooking } from '../../src/tasks/book-slot/saveBooking'

refuseUnlessThrowAwayTestDatabase()
const clean = ['bookings', 'timeSlots', 'clinics', 'throttle']

describe('saveBooking', () => {
  let p: Payload
  let slotId: number

  const form = (fields: Record<string, string> = {}) => {
    const data = new FormData()
    const all = { clinic: 'test-clinic', requestId: randomUUID(), name: 'Test Person', email: 'test@campuscycle.example', timeSlot: String(slotId), ...fields }
    for (const [name, value] of Object.entries(all)) data.append(name, value)
    return data
  }
  // What Next.js's redirect() throws: an error whose "digest" names the address.
  async function digestOf(promise: Promise<unknown>): Promise<string> {
    try {
      await promise
    } catch (error) {
      return String((error as { digest?: string }).digest)
    }
    return 'no error thrown'
  }

  beforeAll(async () => {
    p = await getTestPayload()
  })
  beforeEach(async () => {
    revalidated.length = 0
    await resetCollections(clean)
    const clinic = await p.create({ collection: 'clinics', data: { name: 'Test clinic', slug: 'test-clinic', day: 'Saturday', startTime: '15:00', endTime: '17:00', summary: 'Test instance.' } })
    slotId = (await p.create({ collection: 'timeSlots', data: { clinic: clinic.id, startsAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(), places: 1 } })).id
  })
  afterAll(() => resetCollections(clean))

  it('opens the signed confirmation page after a save', async () => {
    expect(await digestOf(saveBooking(null, form()))).toMatch(/^NEXT_REDIRECT;replace;\/clinics\/test-clinic\/booked\?ref=\d+\.[0-9a-f]{32};307;/)
    expect(revalidated).toEqual([])
  })

  it('after "This slot is full" it has the clinic page read again, and nothing stays chosen', async () => {
    await digestOf(saveBooking(null, form()))
    const result = await saveBooking(null, form({ name: 'Second Person' }))
    expect(result).toMatchObject({ ok: false, message: 'This slot is full. Choose another time.', values: { timeSlot: '', name: 'Second Person' } })
    expect(revalidated).toEqual(['/clinics/test-clinic'])
  })

  it('a problem with another field, or "choose a time", reads nothing again', async () => {
    expect(await saveBooking(null, form({ email: 'nope' }))).toMatchObject({ field: 'email' })
    expect(await saveBooking(null, form({ timeSlot: '' }))).toMatchObject({ field: 'timeSlot', errors: { timeSlot: 'Choose a time.' } })
    expect(revalidated).toEqual([])
  })

  it('after "This time has already started" it has the clinic page read again, so that time leaves the list', async () => {
    const clinic = (await p.find({ collection: 'clinics', where: { slug: { equals: 'test-clinic' } } })).docs[0]
    const started = await p.create({ collection: 'timeSlots', data: { clinic: clinic.id, startsAt: new Date(Date.now() - 60 * 1000).toISOString(), places: 2 } })
    const result = await saveBooking(null, form({ timeSlot: String(started.id) }))
    expect(result).toMatchObject({ ok: false, field: 'timeSlot', errors: { timeSlot: 'This time has already started. Choose a later time.' } })
    expect(revalidated).toEqual(['/clinics/test-clinic'])
  })

  it('a "full" answer for a form that names a clinic which does not exist reads nothing again', async () => {
    const full = 'This slot is full. Choose another time.'
    answer.result = { ok: false, message: full, field: 'timeSlot', errors: { timeSlot: full }, values: { timeSlot: '', name: '', email: '', note: '' } }
    try {
      expect(await saveBooking(null, form({ clinic: 'no-such-clinic' }))).toMatchObject({ message: full })
      expect(revalidated).toEqual([])
      // The same answer for a real clinic does read its page again.
      await saveBooking(null, form())
      expect(revalidated).toEqual(['/clinics/test-clinic'])
    } finally {
      answer.result = undefined
    }
  })

  it('an "already started" answer for a form that names a clinic which does not exist reads nothing again', async () => {
    const started = 'This time has already started. Choose a later time.'
    answer.result = { ok: false, message: 'Your booking was not saved. Check the field marked below.', field: 'timeSlot', errors: { timeSlot: started }, values: { timeSlot: '1', name: '', email: '', note: '' } }
    try {
      await saveBooking(null, form({ clinic: 'no-such-clinic' }))
      expect(revalidated).toEqual([])
    } finally {
      answer.result = undefined
    }
  })
})
