// Example task 2, "book a clinic slot", on the test database: the booking function itself
// (createBooking: the checks, the save and its answers), the places rule on the bookings collection,
// and the two pages a user sees: the clinic's page with its form, and the confirmation.
// The race between two people booking the last place at the same moment is in booking-race.test.ts:
// it needs a real Postgres.
import { randomUUID } from 'node:crypto'
import { renderToString } from 'react-dom/server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleEndpoints, ValidationError, type Payload } from 'payload'
import config from '../setup/config'
import { getTestPayload, resetCollections, resetSiteFacts } from '../setup/payload'
import { refuseUnlessThrowAwayTestDatabase } from '../setup/safety'
import { trackSteps } from '../setup/elements'
import { tabTitle } from '../setup/title'
import { createBooking } from '../../src/tasks/book-slot/createBooking'
import { allowRequest } from '../../src/tasks/book-slot/guards'
import { bookingRef } from '../../src/tasks/book-slot/receipt'
import ClinicPage, { generateMetadata as clinicMetadata } from '../../src/app/(site)/clinics/[slug]/page'
import BookedPage from '../../src/app/(site)/clinics/[slug]/booked/page'

// These tests delete every booking, slot and clinic: never on a real database.
refuseUnlessThrowAwayTestDatabase()

const clean = ['bookings', 'timeSlots', 'clinics', 'repairs', 'throttle']
const FULL = 'This slot is full. Choose another time.'
const NOT_SAVED = 'Your booking was not saved. Please try again.'
const TOO_MANY = 'Too many bookings from this device. Try again in an hour.'
const SERVER_PROBLEM = 'Your booking was not saved because of a problem on our side. Please try again in a minute.'
const CONFIRMATION = 'Your booking is saved. This is a practice project: use made-up details; no one will contact you.'
const NOTICE = 'This is a practice project: use made-up details; no one will contact you.'
const EMAIL_MESSAGE = 'Enter your e-mail address in the right form, like name@example.com.'
const CANT_SHOW = "We can't show this booking confirmation."

const editor = { collection: 'users', id: 1, email: 'editor@campuscycle.example' }
const DAY = 24 * 60 * 60 * 1000

// React writes ' as &#x27; and & as &amp; in HTML; turn them back, so the tests compare plain text.
const text = (html: string) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/<!-- -->/g, '')

// What Next.js's notFound() throws: an error whose "digest" says what to do.
async function digestOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return String((error as { digest?: string }).digest)
  }
  return 'no error thrown'
}

describe('example task 2: book a clinic slot', () => {
  let p: Payload
  let clinicId: number
  let otherClinicId: number
  // A different made-up address for every request, so the rate limit (5 an hour per address) only
  // counts where a test means it to.
  let address = 0
  const freshAddress = () => `198.51.100.${++address}`

  async function slot(startsAt: Date, places = 2, clinic = clinicId) {
    return p.create({ collection: 'timeSlots', data: { clinic, startsAt: startsAt.toISOString(), places } })
  }
  const inDays = (days: number) => new Date(Date.now() + days * DAY)

  // The form as the browser sends it: the fields the user filled in, plus the hidden ones.
  function form(fields: Record<string, string | string[]>) {
    const data = new FormData()
    const all = { clinic: 'test-clinic', requestId: randomUUID(), name: 'Test Person', email: 'test@campuscycle.example', note: '', ...fields }
    for (const [name, value] of Object.entries(all)) for (const one of [value].flat()) data.append(name, one)
    return data
  }
  const book = (fields: Record<string, string | string[]>, ip = freshAddress()) => createBooking(form(fields), { payload: p, ip, now: new Date() })
  const rows = async () => (await p.find({ collection: 'bookings', depth: 0, limit: 100, sort: 'id' })).docs

  beforeAll(async () => {
    p = await getTestPayload()
  })
  beforeEach(async () => {
    await resetCollections(clean)
    await resetSiteFacts()
    clinicId = (await p.create({ collection: 'clinics', data: { name: 'Test clinic', slug: 'test-clinic', day: 'Saturday', startTime: '15:00', endTime: '17:00', summary: 'Test instance: bring your bicycle.' } })).id
    otherClinicId = (await p.create({ collection: 'clinics', data: { name: 'Other clinic', slug: 'other-clinic', day: 'Saturday', startTime: '15:00', endTime: '17:00', summary: 'Test instance.' } })).id
  })
  afterAll(() => resetCollections(clean))

  describe('createBooking', () => {
    it('saves a valid booking once and answers ok with its id', async () => {
      const target = await slot(inDays(6))
      const result = await book({ timeSlot: String(target.id), name: '  Test Person ', note: 'Front brake squeaks.' })
      expect(result).toEqual({ ok: true, bookingId: expect.any(Number) })
      const saved = await rows()
      expect(saved).toHaveLength(1)
      expect(saved[0]).toMatchObject({ id: result.ok && result.bookingId, timeSlot: target.id, name: 'Test Person', email: 'test@campuscycle.example', note: 'Front brake squeaks.' })
    })

    it('refuses a third booking on a slot with 2 places, with the exact message on the time field', async () => {
      const target = await slot(inDays(6))
      // A second slot with room, so the clinic page still shows the form (and the full slot in it).
      await slot(inDays(7))
      expect((await book({ timeSlot: String(target.id) })).ok).toBe(true)
      expect((await book({ timeSlot: String(target.id) })).ok).toBe(true)
      const third = await book({ timeSlot: String(target.id), name: 'Third Person' })
      // No time stays chosen: the one the user picked is full now.
      expect(third).toMatchObject({ ok: false, message: FULL, field: 'timeSlot', values: { name: 'Third Person', timeSlot: '' } })
      expect(await rows()).toHaveLength(2)
      // The page read again (saveBooking.ts refreshes it after this answer) shows that slot as Full.
      const html = text(renderToString(await ClinicPage({ params: Promise.resolve({ slug: 'test-clinic' }) })))
      expect(html).toMatch(new RegExp(`<input[^>]*disabled=""[^>]*value="${target.id}"`))
      expect(html).not.toMatch(new RegExp(`<input[^>]*checked=""[^>]*value="${target.id}"`))
    })

    it('a slot whose places cannot be read counts as full, never as open without a limit', async () => {
      const target = await slot(inDays(6))
      // The places rule reads the slot inside the save (with req); there it gets no number of places.
      const original = p.findByID.bind(p)
      const read = vi.spyOn(p, 'findByID').mockImplementation((async (args: { req?: unknown; collection: string }) => {
        const doc = await original(args as never)
        return args.req && args.collection === 'timeSlots' && doc ? { ...doc, places: undefined } : doc
      }) as never)
      try {
        expect(await book({ timeSlot: String(target.id) })).toMatchObject({ ok: false, message: FULL })
      } finally {
        read.mockRestore()
      }
      expect(await rows()).toHaveLength(0)
    })

    it('a filled trap field saves nothing and says only that the booking was not saved; a clean retry saves exactly once', async () => {
      const target = await slot(inDays(6))
      const fields = { timeSlot: String(target.id), name: 'Test Person', email: 'test@campuscycle.example', note: 'A note' }
      const trapped = await book({ ...fields, extra: 'https://spam.example' })
      // Not ok: no saved state and no confirmation. The words never mention spam or the trap.
      expect(trapped).toEqual({ ok: false, message: NOT_SAVED, values: { ...fields, repairs: [] } })
      expect(await rows()).toHaveLength(0)
      // The form sends again without the trap value (the page clears only that): saved, once.
      const retry = await book({ ...fields, extra: '' })
      expect(retry.ok).toBe(true)
      expect(await rows()).toHaveLength(1)
    })

    it('refuses the sixth request from one address within an hour, stores only a hash of the address, and still lets other addresses book', async () => {
      const target = await slot(inDays(6), 10)
      const ip = '203.0.113.7'
      for (let i = 0; i < 5; i++) expect((await book({ timeSlot: String(target.id) }, ip)).ok).toBe(true)
      expect(await book({ timeSlot: String(target.id), name: 'Sixth Person' }, ip)).toMatchObject({ ok: false, message: TOO_MANY, values: { name: 'Sixth Person' } })
      // A sixth send that would not be saved anyway (a typing mistake) gets its own message, not "Too many".
      expect(await book({ timeSlot: String(target.id), email: 'nope' }, ip)).toMatchObject({ field: 'email' })
      expect(await rows()).toHaveLength(5)
      expect((await book({ timeSlot: String(target.id) }, '203.0.113.8')).ok).toBe(true)
      const stored = (await p.find({ collection: 'throttle', depth: 0, limit: 20 })).docs.map((row) => row.key)
      expect(stored).toHaveLength(6)
      for (const key of stored) expect(key).toMatch(/^[0-9a-f]{64}$/)
      expect(JSON.stringify(stored)).not.toContain('203.0.113')
    })

    it('typing mistakes never use up the limit: six failed sends, then a booking still goes through', async () => {
      const target = await slot(inDays(6))
      const ip = '203.0.113.30'
      for (let i = 0; i < 6; i++) expect(await book({ timeSlot: String(target.id), email: `mistake-${i}` }, ip)).toMatchObject({ field: 'email' })
      expect(await book({ timeSlot: '' }, ip)).toMatchObject({ field: 'timeSlot' })
      expect(await book({ timeSlot: String(target.id) }, ip)).toMatchObject({ ok: true })
      expect((await p.count({ collection: 'throttle' })).totalDocs).toBe(1)
    })

    it('a booking sent again at the limit shows the saved booking, not "Too many"', async () => {
      const target = await slot(inDays(6), 10)
      const ip = '203.0.113.31'
      const requestId = randomUUID()
      for (let i = 0; i < 4; i++) expect((await book({ timeSlot: String(target.id) }, ip)).ok).toBe(true)
      const fifth = await book({ timeSlot: String(target.id), requestId }, ip)
      expect(fifth.ok).toBe(true)
      expect(await book({ timeSlot: String(target.id), requestId }, ip)).toEqual(fifth)
      expect(await rows()).toHaveLength(5)
    })

    it('forgets requests older than the window: they are deleted on the next call and block nobody', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
      for (let i = 0; i < 5; i++) expect(await allowRequest('203.0.113.9', 5, 60, { payload: p, now: twoHoursAgo })).toBe(true)
      expect(await allowRequest('203.0.113.9', 5, 60, { payload: p, now: twoHoursAgo })).toBe(false)
      expect(await allowRequest('203.0.113.9', 5, 60, { payload: p })).toBe(true)
      expect((await p.count({ collection: 'throttle' })).totalDocs).toBe(1)
    })

    it('saves only the whitelisted fields: member=1, repairs=… and any other extra field are ignored', async () => {
      const target = await slot(inDays(6))
      const result = await book({ timeSlot: String(target.id), member: '1', repairs: ['1', '2'], createdAt: '2000-01-01T00:00:00Z', id: '999' })
      expect(result.ok).toBe(true)
      const [saved] = await rows()
      // member exists for the optional members' area, but the form can never fill it in.
      expect(saved.member ?? null).toBeNull()
      expect(saved).not.toHaveProperty('repairs')
      expect(saved.id).not.toBe(999)
      expect(saved.createdAt).not.toMatch(/^2000/)
    })

    it('an e-mail address the database would refuse is refused on the e-mail field, and the other values come back', async () => {
      const target = await slot(inDays(6))
      // Without @, without a dot after it, a one-letter ending, two dots in a row, a letter such as ä.
      for (const email of ['test.campuscycle.example', 'test@campuscycle', 'a@b.c', 'x@y..com', 'a..b@x.be', 'jan@exämple.be']) {
        const result = await book({ timeSlot: String(target.id), email, note: 'Keep me' })
        expect(result).toMatchObject({ ok: false, field: 'email', errors: { email: EMAIL_MESSAGE }, values: { email, note: 'Keep me', timeSlot: String(target.id) } })
      }
      expect(await rows()).toHaveLength(0)
      // Ordinary addresses still pass.
      expect((await book({ timeSlot: String(target.id), email: 'first.last+tag@sub.example.be' })).ok).toBe(true)
    })

    it('if the database still refuses the e-mail address, the e-mail field is marked (not "a problem on our side")', async () => {
      const target = await slot(inDays(6))
      const original = p.create.bind(p)
      const create = vi.spyOn(p, 'create').mockImplementation(((args: { collection: string }) =>
        args.collection === 'bookings'
          ? Promise.reject(new ValidationError({ collection: 'bookings', errors: [{ path: 'email', message: 'Please enter a valid email address.' }] }))
          : original(args as never)) as never)
      try {
        expect(await book({ timeSlot: String(target.id) })).toMatchObject({ ok: false, field: 'email', errors: { email: EMAIL_MESSAGE } })
      } finally {
        create.mockRestore()
      }
    })

    it('checks every field at once: a missing name, a name over 100 characters and a note over 500 characters', async () => {
      const target = await slot(inDays(6))
      const result = await book({ timeSlot: '', name: 'x'.repeat(101), email: '', note: 'y'.repeat(501) })
      expect(result.ok).toBe(false)
      if (result.ok) return
      // The first problem in the form's order: the time comes first on the page.
      expect(result.field).toBe('timeSlot')
      expect(Object.keys(result.errors ?? {})).toEqual(['timeSlot', 'name', 'email', 'note'])
      expect(await book({ timeSlot: String(target.id), name: '   ' })).toMatchObject({ field: 'name' })
      expect((await book({ timeSlot: String(target.id), name: 'x'.repeat(100), note: 'y'.repeat(500) })).ok).toBe(true)
    })

    it('refuses a slot in the past, a slot of another clinic and a slot that does not exist', async () => {
      const past = await slot(new Date(Date.now() - 60 * 60 * 1000))
      const elsewhere = await slot(inDays(6), 2, otherClinicId)
      for (const timeSlot of [String(past.id), String(elsewhere.id), '987654', 'abc']) {
        expect(await book({ timeSlot })).toMatchObject({ ok: false, field: 'timeSlot' })
      }
      expect(await rows()).toHaveLength(0)
    })

    it('a replay of the same form (same requestId) answers with the same booking and saves no second one', async () => {
      const target = await slot(inDays(6))
      const fields = { timeSlot: String(target.id), requestId: randomUUID() }
      const first = await book(fields)
      const again = await book(fields)
      expect(first.ok).toBe(true)
      expect(again).toEqual(first)
      expect(await rows()).toHaveLength(1)
      // The answer got lost, the slot (1 place) is full now with this booking, and the user sends again:
      // the same booking, not "full".
      const single = await slot(inDays(8), 1)
      const lostFields = { timeSlot: String(single.id), requestId: randomUUID() }
      const saved = await book(lostFields)
      expect(await book(lostFields)).toEqual(saved)
      expect((await p.count({ collection: 'bookings', where: { timeSlot: { equals: single.id } } })).totalDocs).toBe(1)
      // The same form sent again for another time: not the same booking, so it is not passed off as one.
      const other = await slot(inDays(7))
      expect(await book({ ...fields, timeSlot: String(other.id) })).toMatchObject({ ok: false, message: expect.stringMatching(/Reload the page/) })
      expect(await rows()).toHaveLength(2)
    })

    it('an unexpected failure gives the plain "problem on our side" message, never the internal error', async () => {
      const target = await slot(inDays(6))
      // The database "fails" when the booking itself is saved; everything before that works.
      const original = p.create.bind(p)
      const create = vi.spyOn(p, 'create').mockImplementation(((args: { collection: string }) =>
        args.collection === 'bookings' ? Promise.reject(new Error('relation "bookings" does not exist (secret detail)')) : original(args as never)) as never)
      const logged = vi.spyOn(p.logger, 'error').mockImplementation(() => undefined)
      try {
        const result = await book({ timeSlot: String(target.id), name: 'Kept Name' })
        expect(result).toEqual({ ok: false, message: SERVER_PROBLEM, values: expect.objectContaining({ name: 'Kept Name' }) })
        expect(JSON.stringify(result)).not.toMatch(/relation|secret/)
        // The details go to the server's log, for whoever runs the site.
        expect(logged).toHaveBeenCalled()
      } finally {
        create.mockRestore()
        logged.mockRestore()
      }
    })
  })

  describe('a slot deleted while someone books it', () => {
    it('answers on the time field that the slot no longer exists, not "a problem on our side"', async () => {
      const target = await slot(inDays(6))
      // The checks find the slot; an editor deletes it just before the booking is saved.
      const original = p.create.bind(p)
      const create = vi.spyOn(p, 'create').mockImplementation((async (args: { collection: string }) => {
        if (args.collection === 'bookings') await p.delete({ collection: 'timeSlots', id: target.id })
        return original(args as never)
      }) as never)
      try {
        const result = await book({ timeSlot: String(target.id), name: 'Kept Name' })
        const gone = 'This time slot no longer exists. Choose another time slot.'
        expect(result).toEqual({ ok: false, message: gone, field: 'timeSlot', errors: { timeSlot: gone }, values: expect.objectContaining({ name: 'Kept Name', timeSlot: '' }) })
        expect(await rows()).toHaveLength(0)
      } finally {
        create.mockRestore()
      }
    })
  })

  describe('the places rule on the bookings collection', () => {
    it('refuses an anonymous POST /api/bookings through Payload\'s REST handler', async () => {
      const target = await slot(inDays(6))
      const response = await handleEndpoints({ config, path: '/api/bookings', request: new Request('http://localhost/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeSlot: target.id, name: 'Test Person', email: 'test@campuscycle.example' }),
      }) })
      expect(response.status).toBe(403)
      expect(await rows()).toHaveLength(0)
    })

    it('an editor cannot move a booking into a full slot, can move it into a slot with room, and can edit it in place in a full slot', async () => {
      const full = await slot(inDays(6))
      const roomy = await slot(inDays(7))
      const a = await book({ timeSlot: String(full.id) })
      await book({ timeSlot: String(full.id) })
      const c = await book({ timeSlot: String(roomy.id) })
      if (!a.ok || !c.ok) throw new Error('setup failed')
      const asEditor = { overrideAccess: false, user: editor, depth: 0 }
      await expect(p.update({ collection: 'bookings', id: c.bookingId, data: { timeSlot: full.id }, ...asEditor })).rejects.toThrow(FULL)
      // Editing a booking in its own full slot does not count it twice.
      await expect(p.update({ collection: 'bookings', id: a.bookingId, data: { note: 'Changed by an editor' }, ...asEditor })).resolves.toHaveProperty('note', 'Changed by an editor')
      await expect(p.update({ collection: 'bookings', id: a.bookingId, data: { timeSlot: full.id, name: 'Same slot' }, ...asEditor })).resolves.toHaveProperty('name', 'Same slot')
      // Moving out of the full slot frees a place, so c can then move in.
      await expect(p.update({ collection: 'bookings', id: a.bookingId, data: { timeSlot: roomy.id }, ...asEditor })).resolves.toHaveProperty('timeSlot', roomy.id)
      await expect(p.update({ collection: 'bookings', id: c.bookingId, data: { timeSlot: full.id }, ...asEditor })).resolves.toHaveProperty('timeSlot', full.id)
    })

    it('still refuses lowering a slot\'s places below its bookings', async () => {
      const target = await slot(inDays(6), 3)
      await book({ timeSlot: String(target.id) })
      await book({ timeSlot: String(target.id) })
      await expect(p.update({ collection: 'timeSlots', id: target.id, data: { places: 1 }, overrideAccess: false, user: editor })).rejects.toThrow(/already has 2 bookings/)
    })
  })

  describe('the pages', () => {
    const clinicPage = async (slug = 'test-clinic') => text(renderToString(await ClinicPage({ params: Promise.resolve({ slug }) })))
    const bookedPage = async (ref?: string, slug = 'test-clinic') =>
      text(renderToString(await BookedPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(ref === undefined ? {} : { ref }) })))

    it('the clinic page shows the clinic, its future slots in Brussels time with the places left, the price list above the form, and the form', async () => {
      // Saturday 9 October 2027: 13:00 UTC is 15:00 in Brussels (summer time).
      const first = await slot(new Date('2027-10-09T13:00:00Z'))
      const second = await slot(new Date('2027-10-09T13:30:00Z'))
      const third = await slot(new Date('2027-10-09T14:00:00Z'), 1)
      await slot(new Date(Date.now() - DAY))
      await book({ timeSlot: String(second.id), name: 'Private Booker', email: 'private@campuscycle.example', note: 'Private note' })
      await book({ timeSlot: String(third.id) })
      await p.create({ collection: 'repairs', data: { name: 'Check', price: 10 } })
      await p.create({ collection: 'repairs', data: { name: 'Full service', price: 45, description: 'Everything checked and adjusted.' } })
      const html = await clinicPage()
      expect(html).toContain('<h1')
      expect(html).toContain('Test clinic')
      expect(html).toContain('Saturday 15:00–17:00')
      expect(html).toContain('Test instance: bring your bicycle.')
      expect(html).toContain('Saturday 9 October, 15:00')
      expect(html).toMatch(/Saturday 9 October, 15:00.*2 places left/s)
      expect(html).toMatch(/Saturday 9 October, 15:30.*1 place left/s)
      expect(html).toMatch(/Saturday 9 October, 16:00.*Full/s)
      // The past slot is not offered.
      expect(html.match(/name="timeSlot"/g)).toHaveLength(3)
      // A full slot stays visible but cannot be chosen.
      expect(html).toMatch(new RegExp(`<input[^>]*disabled=""[^>]*value="${third.id}"|<input[^>]*value="${third.id}"[^>]*disabled=""`))
      expect(html).toMatch(new RegExp(`<input(?![^>]*disabled)[^>]*value="${first.id}"`))
      // The price list, from the repair records, above the form; a description only where one exists.
      expect(html).toMatch(/Check.*EUR 10.*Full service.*Everything checked and adjusted\..*EUR 45.*<form/s)
      // The form: the time group, persistent labels with required/optional in words, the notice, the button.
      expect(html).toMatch(/<fieldset[^>]*>.*<legend[^>]*>.*Choose a time/s)
      // The error box's links: "#timeSlot" goes to the whole group (its legend stays in view), and a
      // field keeps room above it for its label when a link scrolls to it.
      expect(html).toMatch(/<fieldset[^>]*id="timeSlot"[^>]*class="[^"]*scroll-mt-6/)
      expect(html).toMatch(/<fieldset[^>]*id="timeSlot"[^>]*tabindex="-1"|<fieldset[^>]*tabindex="-1"[^>]*id="timeSlot"/i)
      for (const field of ['name', 'email']) expect(html).toMatch(new RegExp(`<input[^>]*class="[^"]*scroll-mt-16[^"]*"[^>]*id="${field}"`))
      expect(html).toMatch(/<textarea[^>]*class="[^"]*scroll-mt-28[^"]*"[^>]*id="note"/)
      expect(html).toMatch(/<label[^>]*for="name"[^>]*>.*Your name.*\(required\)/s)
      expect(html).toMatch(/<label[^>]*for="email"[^>]*>.*Your e-mail address.*\(required\)/s)
      expect(html).toMatch(/<label[^>]*for="note"[^>]*>.*Note.*\(optional\)/s)
      expect(html).toMatch(/<input[^>]*type="email"/)
      expect(html).toContain(NOTICE)
      expect(html).toMatch(new RegExp(`${NOTICE.replace(/[.:;]/g, '.')}.*<button[^>]*type="submit"[^>]*>Book this slot`, 's'))
      // A fresh random requestId for this form, and the hidden trap field out of the keyboard's way.
      expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="requestId"[^>]*value="[0-9a-f-]{36}"/)
      expect(html).toMatch(/<div[^>]*aria-hidden="true"[^>]*>.*<input[^>]*name="extra"[^>]*tabindex="-1"|<div[^>]*aria-hidden="true"[^>]*>.*<input[^>]*tabindex="-1"[^>]*name="extra"/s)
      // Never anything from a booking: no name, no e-mail address, no note.
      expect(html).not.toMatch(/Private Booker|private@campuscycle|Private note|Test Person|test@campuscycle/)
      expect(html).not.toMatch(/student project/i)
      expect(await tabTitle(clinicMetadata({ params: Promise.resolve({ slug: 'test-clinic' }) }))).toBe('Test clinic · Campus Cycle')
    })

    it('the clinic page says so when there are no future slots, and when every slot is full', async () => {
      expect(await clinicPage()).toContain('There are no upcoming time slots yet. Check back soon.')
      const only = await slot(inDays(6), 1)
      await book({ timeSlot: String(only.id) })
      const html = await clinicPage()
      expect(html).toContain('Every time slot is full.')
      expect(html).not.toContain('Book this slot')
    })

    it('an unknown clinic gives the 404 page', async () => {
      expect(await digestOf(ClinicPage({ params: Promise.resolve({ slug: 'no-such-clinic' }) }))).toBe('NEXT_HTTP_ERROR_FALLBACK;404')
      expect(await digestOf(BookedPage({ params: Promise.resolve({ slug: 'no-such-clinic' }), searchParams: Promise.resolve({}) }))).toBe('NEXT_HTTP_ERROR_FALLBACK;404')
    })

    it('the confirmation shows the exact text, the clinic and the time for a signed link, and nothing from any booking', async () => {
      const target = await slot(new Date('2027-10-09T13:00:00Z'))
      const result = await book({ timeSlot: String(target.id), name: 'Private Booker', email: 'private@campuscycle.example' })
      if (!result.ok) throw new Error('setup failed')
      const html = await bookedPage(bookingRef(result.bookingId))
      expect(html).toContain(CONFIRMATION)
      expect(html).not.toMatch(/student project/i)
      expect(html).toContain('Test clinic')
      expect(html).toContain('Saturday 9 October, 15:00')
      expect(html).not.toMatch(/Private Booker|private@campuscycle/)
      expect(html).not.toContain(CANT_SHOW)
    })

    it('counts the analytics step "booking_saved" once per booking, and only on a real confirmation', async () => {
      const target = await slot(new Date('2027-10-09T13:00:00Z'))
      const result = await book({ timeSlot: String(target.id) })
      if (!result.ok) throw new Error('setup failed')
      const steps = async (ref?: string) =>
        trackSteps(await BookedPage({ params: Promise.resolve({ slug: 'test-clinic' }), searchParams: Promise.resolve(ref === undefined ? {} : { ref }) }))
      expect(await steps(bookingRef(result.bookingId))).toEqual([{ event: 'booking_saved', once: String(result.bookingId) }])
      expect(await steps()).toEqual([])
      expect(await steps(`${result.bookingId}.${'0'.repeat(32)}`)).toEqual([])
    })

    it('a missing, tampered or other clinic\'s link shows "can\'t show" and no booking data, and never claims a save', async () => {
      const target = await slot(new Date('2027-10-09T13:00:00Z'))
      const elsewhere = await slot(new Date('2027-10-16T13:00:00Z'), 2, otherClinicId)
      const mine = await book({ timeSlot: String(target.id) })
      const theirs = await createBooking(form({ clinic: 'other-clinic', timeSlot: String(elsewhere.id) }), { payload: p, ip: freshAddress(), now: new Date() })
      if (!mine.ok || !theirs.ok) throw new Error('setup failed')
      const good = bookingRef(mine.bookingId)
      const [, signature] = good.split('.')
      const tampered = [
        undefined,
        '',
        String(mine.bookingId),
        `${mine.bookingId}.${signature.replace(/^./, (c) => (c === '0' ? '1' : '0'))}`,
        `${theirs.bookingId}.${signature}`,
        `${mine.bookingId + 1000}.${signature}`,
        bookingRef(theirs.bookingId),
      ]
      for (const ref of tampered) {
        const html = await bookedPage(ref)
        expect(html, String(ref)).toContain(CANT_SHOW)
        expect(html, String(ref)).not.toContain('Your booking is saved')
        expect(html, String(ref)).not.toMatch(/9 October|16 October|Test Person/)
        expect(html, String(ref)).toContain('href="/clinics/test-clinic"')
      }
    })
  })
})
