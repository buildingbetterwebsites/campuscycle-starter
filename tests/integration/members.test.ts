// The optional members' area (src/lib/membersArea.ts), on the test database. It ships switched off:
// while MEMBERS_AREA is not "on", every request to the members collection is refused (also code that
// skips the access rules, and every account address of Payload's API), the account pages are 404, and
// nothing of it shows. Switched on, an editor makes member accounts, a member logs in and sees only
// their own bookings, and a member is never an editor. Two members, A and B, check that one never sees
// the other's bookings.
import { randomUUID } from 'node:crypto'
import { renderToString } from 'react-dom/server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleEndpoints, type Payload, type PayloadRequest } from 'payload'
import config from '../setup/config'
import { getTestPayload, resetCollections } from '../setup/payload'
import { refuseUnlessThrowAwayTestDatabase } from '../setup/safety'

// Outside a running Next.js server there is no request. The test keeps the browser's cookies in `jar`:
// the log-in action sets its cookie there, and the pages read it from the request's headers. Both are
// vi.fn(), so a test can check that a page did not ask for the request at all.
const jar = vi.hoisted(() => new Map<string, string>())
const request = vi.hoisted(() => ({
  headers: vi.fn(async () =>
    new Headers({
      cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; '),
      // A different made-up device address for each request, so the booking rate limit never counts.
      'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
    }),
  ),
  cookies: vi.fn(async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  })),
}))
vi.mock('next/headers', () => ({ headers: request.headers, cookies: request.cookies }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
// The menu asks Next.js which address is open; there is none here.
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/',
}))

import ClinicPage from '../../src/app/(site)/clinics/[slug]/page'
import BookedPage from '../../src/app/(site)/clinics/[slug]/booked/page'
import AccountPage from '../../src/app/(site)/account/page'
import LoginPage from '../../src/app/(site)/account/login/page'
import { signIn, signOut } from '../../src/app/(site)/account/actions'
import { Header } from '../../src/components/site/Header'
import { editorsOnly, isEditor } from '../../src/access'
import { formatSlotTime } from '../../src/lib/format'
import { membersAreaOn, NO_MATCH_MESSAGE, signedInMember } from '../../src/lib/membersArea'
import { createBooking } from '../../src/tasks/book-slot/createBooking'
import { bookingRef } from '../../src/tasks/book-slot/receipt'
import { saveBooking } from '../../src/tasks/book-slot/saveBooking'

// These tests delete every member, booking, slot and clinic: never on a real database.
refuseUnlessThrowAwayTestDatabase()

const clean = ['bookings', 'timeSlots', 'clinics', 'throttle', 'members']
const editor = { collection: 'users', id: 1, email: 'editor@campuscycle.example' }
const PASSWORD = 'test-password-0123456789'
const DAY = 24 * 60 * 60 * 1000
const COOKIE = 'payload-token'

// React writes ' as &#x27; in HTML; turn it back, so the tests compare plain text.
const text = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/<!-- -->/g, '')

// What Next.js's notFound() and redirect() throw: an error whose "digest" says what to do.
async function digestOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return String((error as { digest?: string }).digest)
  }
  return 'no error thrown'
}

// How the booking's member field shows in /admin right now: hidden on the record, and out of the
// bookings list's Columns and Filters lists.
type FieldAdmin = { hidden?: boolean; disableListColumn?: boolean; disableListFilter?: boolean }
function memberFieldAdmin(p: Payload): FieldAdmin {
  const field = p.collections.bookings.config.fields.find((one) => 'name' in one && one.name === 'member')
  const admin = field?.admin as FieldAdmin | undefined
  return { hidden: admin?.hidden, disableListColumn: admin?.disableListColumn, disableListFilter: admin?.disableListFilter }
}

// The clinic page and one booking's confirmation page, as HTML, the way the server renders them.
const clinicPage = async () => text(renderToString(await ClinicPage({ params: Promise.resolve({ slug: 'test-clinic' }) })))
const bookedPage = async (bookingId: number) =>
  text(renderToString(await BookedPage({ params: Promise.resolve({ slug: 'test-clinic' }), searchParams: Promise.resolve({ ref: bookingRef(bookingId) }) })))

/** One field of a rendered form, by its id, so a test can read what it was filled in with. */
function field(html: string, id: string): string {
  return [...html.matchAll(/<input[^>]*>/g)].map(([tag]) => tag).find((tag) => tag.includes(`id="${id}"`)) ?? ''
}

// Every rendered form carries a fresh random code (requestId), so two renders of the same page always
// differ in that one place. This blanks it, so the rest can be compared word for word.
const sameEachTime = (html: string) => html.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, 'the-form-code')

// A request to Payload's REST API, the way /api/... answers it on the running site.
function api(method: string, path: string, { body, token }: { body?: unknown; token?: string } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (token) headers.set('Authorization', `JWT ${token}`)
  return handleEndpoints({
    config,
    // Payload matches the route on the path alone; the query (?depth=...) travels in the request's address.
    path: path.split('?')[0],
    request: new Request(`http://localhost${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
  })
}

function loginForm(email: string, password: string) {
  const data = new FormData()
  data.append('email', email)
  data.append('password', password)
  return data
}

describe("the members' area", () => {
  let p: Payload
  // The number of members, read straight from the database: while the area is off, Payload's own count
  // is refused too.
  const memberCount = async () => (await p.db.count({ collection: 'members', where: {} })).totalDocs

  const switchOn = () => void (process.env.MEMBERS_AREA = 'on')
  const switchOff = () => void delete process.env.MEMBERS_AREA

  beforeAll(async () => {
    p = await getTestPayload()
  })
  beforeEach(async () => {
    switchOff()
    jar.clear()
    await resetCollections(clean)
  })
  afterEach(() => switchOff())
  afterAll(() => resetCollections(clean))

  // Two members, A and B, made by an editor with the area on.
  async function twoMembers() {
    switchOn()
    const options = { overrideAccess: false, user: editor }
    const a = await p.create({ collection: 'members', data: { email: 'a@campuscycle.example', password: PASSWORD, name: 'Member A' }, ...options })
    const b = await p.create({ collection: 'members', data: { email: 'b@campuscycle.example', password: PASSWORD, name: 'Member B' }, ...options })
    return { a, b }
  }

  // A clinic with two slots; A booked the first, B the second, and someone without an account the first.
  async function bookings(a: number, b: number) {
    const clinic = await p.create({ collection: 'clinics', data: { name: 'Test clinic', slug: 'test-clinic', day: 'Saturday', startTime: '15:00', endTime: '17:00', summary: 'Test instance.' } })
    const first = await p.create({ collection: 'timeSlots', data: { clinic: clinic.id, startsAt: new Date(Date.now() + 5 * DAY).toISOString(), places: 5 } })
    const second = await p.create({ collection: 'timeSlots', data: { clinic: clinic.id, startsAt: new Date(Date.now() + 9 * DAY).toISOString(), places: 5 } })
    const booking = (timeSlot: number, member: number | undefined, name: string) =>
      p.create({ collection: 'bookings', data: { timeSlot, member, name, email: 'test@campuscycle.example' }, overrideAccess: true })
    return {
      clinic,
      first,
      second,
      ofA: await booking(first.id, a, 'Booking of A'),
      ofB: await booking(second.id, b, 'Booking of B'),
      anonymous: await booking(first.id, undefined, 'Booking without account'),
    }
  }

  describe('switched off (MEMBERS_AREA not set)', () => {
    it('is off unless MEMBERS_AREA is exactly "on"', () => {
      expect(membersAreaOn()).toBe(false)
      for (const value of ['ON', 'true', '1', 'yes', ' on']) {
        process.env.MEMBERS_AREA = value
        expect(membersAreaOn()).toBe(false)
      }
      switchOn()
      expect(membersAreaOn()).toBe(true)
    })

    it('refuses to create a member, even for code that skips the access rules', async () => {
      await expect(p.create({ collection: 'members', data: { email: 'a@campuscycle.example', password: PASSWORD }, overrideAccess: true })).rejects.toThrow(/not allowed/)
      await expect(p.create({ collection: 'members', data: { email: 'a@campuscycle.example', password: PASSWORD }, overrideAccess: false, user: editor })).rejects.toThrow(/not allowed/)
      await expect(p.find({ collection: 'members', overrideAccess: true })).rejects.toThrow(/not allowed/)
      await expect(p.count({ collection: 'members' })).rejects.toThrow(/not allowed/)
      expect(await memberCount()).toBe(0)
    })

    it("refuses every account address of Payload's API, and creates no member", async () => {
      const account = { email: 'a@campuscycle.example', password: PASSWORD }
      const calls: [string, string, unknown?][] = [
        ['POST', '/api/members/first-register', account],
        ['POST', '/api/members', account],
        ['POST', '/api/members/login', account],
        ['POST', '/api/members/forgot-password', { email: account.email }],
        ['GET', '/api/members/me'],
        ['POST', '/api/members/refresh-token'],
        ['GET', '/api/members/init'],
        ['POST', '/api/members/logout'],
        ['POST', '/api/members/reset-password', { token: 'made-up', password: PASSWORD }],
        ['POST', '/api/members/unlock', { email: account.email }],
        ['POST', '/api/members/verify/made-up'],
        ['GET', '/api/members'],
        ['GET', '/api/members/1'],
      ]
      for (const [method, path, body] of calls) {
        const response = await api(method, path, { body })
        expect(response.status, `${method} ${path}`).toBe(403)
      }
      expect(await memberCount()).toBe(0)
    })

    it('refuses a member who logged in before the area was switched off, everywhere', async () => {
      const { a } = await twoMembers()
      const { token } = await p.login({ collection: 'members', data: { email: a.email, password: PASSWORD } })
      const { ofA } = await bookings(a.id, a.id)
      switchOff()
      for (const [method, path] of [['GET', '/api/members/me'], ['POST', '/api/members/refresh-token'], ['GET', `/api/members/${a.id}`], ['GET', '/api/bookings'], ['GET', `/api/bookings/${ofA.id}`]]) {
        expect((await api(method, path, { token })).status, `${method} ${path}`).toBe(403)
      }
      // The log-in cookie is not a log-in any more: the account pages and the booking form ignore it.
      jar.set(COOKIE, token!)
      expect(await signedInMember(p, new Headers({ cookie: `${COOKIE}=${token}` }))).toBeNull()
      expect((await p.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) })).user).toBeNull()
      // An editor still reads that booking: it holds the member's id, and reading it never asks the
      // members collection.
      const read = await p.findByID({ collection: 'bookings', id: ofA.id, depth: 2, overrideAccess: false, user: editor })
      expect(read.member).toBe(a.id)
    })

    it('has no pages and no menu link, and is hidden in /admin', async () => {
      expect(await digestOf(AccountPage())).toBe('NEXT_HTTP_ERROR_FALLBACK;404')
      expect(await digestOf(LoginPage({ searchParams: Promise.resolve({}) }))).toBe('NEXT_HTTP_ERROR_FALLBACK;404')
      expect(await digestOf(signIn(null, loginForm('a@campuscycle.example', PASSWORD)))).toBe('NEXT_HTTP_ERROR_FALLBACK;404')
      expect(await digestOf(signOut())).toBe('NEXT_HTTP_ERROR_FALLBACK;404')

      // The menu is exactly the five links it always had.
      const menu = renderToString(await Header())
      expect(menu).not.toContain('My bookings')
      expect(menu).not.toContain('/account')
      expect(menu.match(/<li>/g)).toHaveLength(5)

      const members = p.collections.members.config
      const hidden = members.admin.hidden as (args: { user: unknown }) => boolean
      expect(hidden({ user: editor })).toBe(true)
      // Not on the record, and not offered as a column or a filter in the bookings list.
      expect(memberFieldAdmin(p)).toEqual({ hidden: true, disableListColumn: true, disableListFilter: true })
    })

    it('the booking form saves no member, whatever the form or an old cookie says', async () => {
      const { a, b } = await twoMembers()
      const { token } = await p.login({ collection: 'members', data: { email: a.email, password: PASSWORD } })
      const { first } = await bookings(a.id, b.id)
      switchOff()
      jar.set(COOKIE, token!)
      const data = new FormData()
      for (const [name, value] of Object.entries({ clinic: 'test-clinic', requestId: randomUUID(), name: 'Test Person', email: 'test@campuscycle.example', timeSlot: String(first.id), member: String(b.id) })) data.append(name, value)
      expect(await digestOf(saveBooking(null, data))).toMatch(/^NEXT_REDIRECT;/)
      const saved = (await p.find({ collection: 'bookings', where: { name: { equals: 'Test Person' } }, depth: 0 })).docs
      expect(saved).toHaveLength(1)
      expect(saved[0].member ?? null).toBeNull()
    })

    it('leaves the clinic page and the confirmation exactly as they are, even with an old member cookie', async () => {
      const { a, b } = await twoMembers()
      const { ofA } = await bookings(a.id, b.id)
      const { token } = await p.login({ collection: 'members', data: { email: a.email, password: PASSWORD } })
      switchOff()

      // The same two pages, once with the member's cookie and once without: word for word the same.
      const withCookie = { clinic: sameEachTime(await clinicPage()), booked: sameEachTime(await bookedPage(ofA.id)) }
      jar.set(COOKIE, token!)
      const afterLogIn = { clinic: sameEachTime(await clinicPage()), booked: sameEachTime(await bookedPage(ofA.id)) }
      expect(afterLogIn).toEqual(withCookie)

      // And neither page says anything about an account.
      for (const html of [afterLogIn.clinic, afterLogIn.booked]) {
        expect(html).not.toContain('You are logged in as')
        expect(html).not.toContain('This booking is in your account.')
        expect(html).not.toContain('My bookings')
        expect(html).not.toContain('/account')
      }
      // The form's own fields are empty, as they are for everyone else.
      expect(field(afterLogIn.clinic, 'name')).not.toContain('value="Member A"')
      expect(field(afterLogIn.clinic, 'email')).not.toContain(`value="${a.email}"`)
    })

    it('reads nothing of the request on the header, the clinic page and /booked, with or without an old cookie', async () => {
      const { a, b } = await twoMembers()
      const { ofA } = await bookings(a.id, b.id)
      const { token } = await p.login({ collection: 'members', data: { email: a.email, password: PASSWORD } })
      switchOff()
      for (const cookie of [undefined, token!]) {
        jar.clear()
        if (cookie) jar.set(COOKIE, cookie)
        request.headers.mockClear()
        request.cookies.mockClear()
        await Header()
        expect(request.headers, 'the header').not.toHaveBeenCalled()
        await clinicPage()
        expect(request.headers, 'the clinic page').not.toHaveBeenCalled()
        await bookedPage(ofA.id)
        expect(request.headers, '/booked').not.toHaveBeenCalled()
        expect(request.cookies).not.toHaveBeenCalled()
      }
    })

    it('createBooking itself saves no member while the area is off, even when it is given one', async () => {
      const { a, b } = await twoMembers()
      const { first } = await bookings(a.id, b.id)
      switchOff()
      const data = new FormData()
      for (const [name, value] of Object.entries({ clinic: 'test-clinic', requestId: randomUUID(), name: 'Test Person', email: 'test@campuscycle.example', timeSlot: String(first.id) })) data.append(name, value)
      const result = await createBooking(data, { payload: p, ip: '198.51.100.250', now: new Date(), member: a.id })
      expect(result.ok).toBe(true)
      const saved = await p.findByID({ collection: 'bookings', id: (result as { bookingId: number }).bookingId, depth: 0 })
      expect(saved.member ?? null).toBeNull()
    })
  })

  describe('switched on (MEMBERS_AREA=on)', () => {
    it('only editors make member accounts: nobody can sign up, and a member cannot make another', async () => {
      const { a } = await twoMembers()
      const newcomer = { email: 'c@campuscycle.example', password: PASSWORD }
      expect((await api('POST', '/api/members', { body: newcomer })).status).toBe(403)
      // Payload's "first account" address would let anyone make an account: it stays closed.
      await resetCollections(['members'])
      expect((await api('POST', '/api/members/first-register', { body: newcomer })).status).toBe(403)
      expect(await memberCount()).toBe(0)
      const again = await twoMembers()
      await expect(p.create({ collection: 'members', data: newcomer, overrideAccess: false, user: { ...again.a, collection: 'members' } })).rejects.toThrow(/not allowed/)
      expect(await memberCount()).toBe(2)
      expect(a.id).not.toBe(again.a.id)
    })

    it('member A logs in at /account/login, and /account lists only their own bookings', async () => {
      const { a, b } = await twoMembers()
      const { first, second } = await bookings(a.id, b.id)

      // Without a log-in, /account sends the user to the log-in page.
      expect(await digestOf(AccountPage())).toMatch(/^NEXT_REDIRECT;\w+;\/account\/login;/)

      expect(await digestOf(signIn(null, loginForm('A@campuscycle.example ', PASSWORD)))).toMatch(/^NEXT_REDIRECT;\w+;\/account;/)
      expect(jar.get(COOKIE)).toBeTruthy()
      // Logged in, the log-in page sends the member on to /account.
      expect(await digestOf(LoginPage({ searchParams: Promise.resolve({}) }))).toMatch(/^NEXT_REDIRECT;\w+;\/account;/)

      const page = text(renderToString(await AccountPage()))
      expect(page).toContain('You are logged in as Member A.')
      expect(page).toContain(formatSlotTime(first.startsAt))
      expect(page).toContain('Test clinic')
      // B's booking (the second slot) and the booking without an account are not A's.
      expect(page).not.toContain(formatSlotTime(second.startsAt))
      expect(page.match(/<li /g)).toHaveLength(1)
      expect(page).not.toMatch(/Booking of B|Booking without account|test@campuscycle/)
      expect(page).toContain('Log out')
    })

    it("a wrong password and an unknown e-mail address get the same message, and log nobody in", async () => {
      const { a } = await twoMembers()
      expect(await signIn(null, loginForm(a.email, 'not-the-password'))).toEqual({ message: NO_MATCH_MESSAGE, email: a.email })
      expect(await signIn(null, loginForm('nobody@campuscycle.example', PASSWORD))).toEqual({ message: NO_MATCH_MESSAGE, email: 'nobody@campuscycle.example' })
      expect(NO_MATCH_MESSAGE).toBe("That e-mail and password don't match.")
      // Empty fields are named, and the typed address comes back; the password never does.
      expect(await signIn(null, loginForm('', ''))).toEqual({
        message: 'You are not logged in. Fill in the 2 fields marked below.',
        errors: { email: 'Enter your e-mail address.', password: 'Enter your password.' },
        email: '',
      })
      expect(await signIn(null, loginForm(a.email, ''))).toMatchObject({ errors: { password: 'Enter your password.' }, email: a.email })
      expect(jar.size).toBe(0)
      // The log-in page shows the form, with persistent labels.
      const page = text(renderToString(await LoginPage({ searchParams: Promise.resolve({}) })))
      expect(page).toContain('<label')
      // Both fields say in words that they are needed, the way the booking form's fields do.
      expect(page).toMatch(/for="email"[^>]*>Your e-mail address <span[^>]*>\(required\)<\/span>/)
      expect(page).toMatch(/for="password"[^>]*>Your password <span[^>]*>\(required\)<\/span>/)
      expect(page).toMatch(/autocomplete="current-password"/i)
    })

    it("through the API, member A reads only A's bookings and own account, never users or throttle", async () => {
      const { a, b } = await twoMembers()
      const { ofA, ofB, anonymous } = await bookings(a.id, b.id)
      const { token } = await p.login({ collection: 'members', data: { email: a.email, password: PASSWORD } })

      const list = await api('GET', '/api/bookings', { token })
      expect(list.status).toBe(200)
      const own = ((await list.json()) as { docs: { id: number; member?: number }[] }).docs
      expect(own.map((doc) => doc.id)).toEqual([ofA.id])
      expect(own[0].member).toBe(a.id)
      expect((await api('GET', `/api/bookings/${ofA.id}`, { token })).status).toBe(200)
      for (const id of [ofB.id, anonymous.id]) {
        const response = await api('GET', `/api/bookings/${id}`, { token })
        expect(response.status).toBe(404)
        expect(await response.text()).not.toMatch(/Booking of B|Booking without account/)
      }
      for (const path of ['/api/users', '/api/throttle']) expect((await api('GET', path, { token })).status, path).toBe(403)
      // Members: only A's own record.
      const members = (await (await api('GET', '/api/members', { token })).json()) as { docs: { id: number }[] }
      expect(members.docs.map((doc) => doc.id)).toEqual([a.id])
      expect((await api('GET', `/api/members/${b.id}`, { token })).status).toBe(404)
      const me = (await (await api('GET', '/api/members/me', { token })).json()) as { user: { id: number } | null }
      expect(me.user?.id).toBe(a.id)
      // No changing bookings, not even A's own.
      expect((await api('PATCH', `/api/bookings/${ofA.id}`, { token, body: { note: 'changed' } })).status).toBe(403)
      expect((await api('DELETE', `/api/bookings/${ofA.id}`, { token })).status).toBe(403)
      expect((await api('POST', '/api/bookings', { token, body: { timeSlot: ofA.timeSlot, name: 'x', email: 'x@campuscycle.example' } })).status).toBe(403)
    })

    it("a member can neither see, make nor remove the editors' document locks; an editor still can", async () => {
      const { a, b } = await twoMembers()
      const { clinic } = await bookings(a.id, b.id)
      // A real editor account, so the editor's side goes through the same REST API as the member's.
      const email = `editor-${randomUUID()}@campuscycle.example`
      const realEditor = await p.create({ collection: 'users', data: { email, password: PASSWORD } })
      const locks = 'payload-locked-documents'
      try {
        const editorToken = (await p.login({ collection: 'users', data: { email, password: PASSWORD } })).token
        const memberToken = (await p.login({ collection: 'members', data: { email: a.email, password: PASSWORD } })).token
        const lockOf = (user: { relationTo: string; value: number }) => ({ document: { relationTo: 'clinics', value: clinic.id }, user })

        // The editor opens the clinic in /admin: Payload records the lock, and the editor reads it back.
        const made = await api('POST', `/api/${locks}`, { token: editorToken, body: lockOf({ relationTo: 'users', value: realEditor.id }) })
        expect(made.status).toBe(201)
        const lock = ((await made.json()) as { doc: { id: number } }).doc
        expect((await api('GET', `/api/${locks}`, { token: editorToken })).status).toBe(200)

        // Member A sees none of it, and cannot lock a record or remove the editor's lock.
        const seen = await api('GET', `/api/${locks}?depth=2`, { token: memberToken })
        expect(seen.status).toBe(403)
        expect(await seen.text()).not.toContain(email)
        expect((await api('GET', `/api/${locks}/${lock.id}`, { token: memberToken })).status).toBe(403)
        expect((await api('POST', `/api/${locks}`, { token: memberToken, body: lockOf({ relationTo: 'members', value: a.id }) })).status).toBe(403)
        expect((await api('PATCH', `/api/${locks}/${lock.id}`, { token: memberToken, body: { globalSlug: 'site-facts' } })).status).toBe(403)
        expect((await api('DELETE', `/api/${locks}/${lock.id}`, { token: memberToken })).status).toBe(403)
        expect((await p.db.count({ collection: locks, where: {} })).totalDocs).toBe(1)

        // The editor closes the record: the lock goes.
        expect((await api('DELETE', `/api/${locks}/${lock.id}`, { token: editorToken })).status).toBe(200)
      } finally {
        await p.db.deleteMany({ collection: locks, where: {} })
        // Straight from the database: the users collection refuses to delete its last editor.
        await p.db.deleteMany({ collection: 'users', where: { id: { equals: realEditor.id } } })
      }
    })

    it('a member is never an editor and never opens /admin', async () => {
      const { a, b } = await twoMembers()
      const req = { user: { ...a, collection: 'members' } } as unknown as PayloadRequest
      expect(isEditor({ req })).toBe(false)
      expect(editorsOnly({ req })).toBe(false)
      expect(p.collections.members.config.access.admin?.({ req })).toBe(false)
      expect(p.collections.users.config.access.admin?.({ req })).toBe(false)
      // A changes their own name, never B's account.
      const asA = { overrideAccess: false, user: { ...a, collection: 'members' } }
      await expect(p.update({ collection: 'members', id: a.id, data: { name: 'A, renamed' }, ...asA })).resolves.toHaveProperty('name', 'A, renamed')
      await expect(p.update({ collection: 'members', id: b.id, data: { name: 'Changed by A' }, ...asA })).rejects.toThrow()
      await expect(p.delete({ collection: 'members', id: a.id, ...asA })).rejects.toThrow(/not allowed/)
      expect((await p.findByID({ collection: 'members', id: b.id })).name).toBe('Member B')
    })

    it('a booking made while logged in belongs to that member, never to one the form names', async () => {
      const { a, b } = await twoMembers()
      const { first } = await bookings(a.id, b.id)
      const send = async (name: string) => {
        const data = new FormData()
        for (const [field, value] of Object.entries({ clinic: 'test-clinic', requestId: randomUUID(), name, email: 'test@campuscycle.example', timeSlot: String(first.id), member: String(b.id) })) data.append(field, value)
        expect(await digestOf(saveBooking(null, data))).toMatch(/^NEXT_REDIRECT;/)
        return (await p.find({ collection: 'bookings', where: { name: { equals: name } }, depth: 0 })).docs[0]
      }
      // Without a log-in: no member, also not the one the form names.
      expect((await send('Sent without a log-in')).member ?? null).toBeNull()
      // Logged in as A: A's booking, although the form names B.
      await digestOf(signIn(null, loginForm(a.email, PASSWORD)))
      expect((await send('Sent by A')).member).toBe(a.id)
      expect(text(renderToString(await AccountPage())).match(/<li /g)).toHaveLength(2)
    })

    it('tells a logged-in member that the booking goes to their account, and fills in their details', async () => {
      const { a, b } = await twoMembers()
      const { ofA, ofB } = await bookings(a.id, b.id)
      await digestOf(signIn(null, loginForm(a.email, PASSWORD)))

      const page = await clinicPage()
      expect(page).toContain('You are logged in as Member A. This booking will be saved to your account.')
      expect(field(page, 'name')).toContain('value="Member A"')
      expect(field(page, 'email')).toContain(`value="${a.email}"`)
      // The practice-project notice stays where it was.
      expect(page).toContain('This is a practice project: use made-up details; no one will contact you.')

      // Their own booking says so, with the way to the rest of them.
      const own = await bookedPage(ofA.id)
      expect(own).toContain('This booking is in your account.')
      expect(own).toMatch(/<a[^>]*href="\/account"[^>]*>My bookings<\/a>/)
      expect(own).toContain('Your booking is saved.')

      // Someone else's booking never does, although it is in an account.
      const other = await bookedPage(ofB.id)
      expect(other).not.toContain('This booking is in your account.')
      expect(other).toContain('Your booking is saved.')
    })

    it('leaves the name field empty for a member whose account has no name, never the e-mail address', async () => {
      const { a, b } = await twoMembers()
      await bookings(a.id, b.id)
      const nameless = await p.create({ collection: 'members', data: { email: 'c@campuscycle.example', password: PASSWORD }, overrideAccess: false, user: editor })
      await digestOf(signIn(null, loginForm(nameless.email, PASSWORD)))
      const page = await clinicPage()
      expect(page).toContain('You are logged in as c@campuscycle.example. This booking will be saved to your account.')
      expect(field(page, 'name')).not.toContain('value="c@campuscycle.example"')
      expect(field(page, 'name')).not.toMatch(/value="[^"]+"/)
      expect(field(page, 'email')).toContain('value="c@campuscycle.example"')
    })

    it('says none of that to someone who is not logged in', async () => {
      const { a, b } = await twoMembers()
      const { ofA } = await bookings(a.id, b.id)
      const page = await clinicPage()
      expect(page).not.toContain('You are logged in as')
      expect(field(page, 'name')).not.toContain('value="Member A"')
      expect(field(page, 'email')).not.toContain(`value="${a.email}"`)
      expect(await bookedPage(ofA.id)).not.toContain('This booking is in your account.')
      expect(b.id).toBeGreaterThan(0)
    })

    it('logging out ends the log-in: the old cookie no longer works', async () => {
      const { a } = await twoMembers()
      await digestOf(signIn(null, loginForm(a.email, PASSWORD)))
      const token = jar.get(COOKIE)!
      expect(await signedInMember(p, new Headers({ cookie: `${COOKIE}=${token}` }))).toMatchObject({ id: a.id })
      expect(await digestOf(signOut())).toMatch(/^NEXT_REDIRECT;\w+;\/account\/login\?signed-out;/)
      expect(jar.has(COOKIE)).toBe(false)
      // A copy of the old cookie is refused: its log-in was ended on the server too.
      expect(await signedInMember(p, new Headers({ cookie: `${COOKIE}=${token}` }))).toBeNull()
      jar.set(COOKIE, token)
      expect(await digestOf(AccountPage())).toMatch(/^NEXT_REDIRECT;\w+;\/account\/login;/)
      // The log-in page then says so.
      jar.clear()
      expect(text(renderToString(await LoginPage({ searchParams: Promise.resolve({ 'signed-out': '' }) })))).toContain('You are logged out.')
    })

    it('shows "Log in" to nobody in particular, and the member with a way out once they are logged in', async () => {
      const { a } = await twoMembers()

      // Nobody logged in: a sixth link that leads to the log-in page, and no sign of an account.
      const out = text(renderToString(await Header()))
      expect(out).toMatch(/<a[^>]*href="\/account\/login"[^>]*>Log in<\/a>/)
      expect(out.match(/<li>/g)).toHaveLength(6)
      expect(out).not.toContain('Log out')
      expect(out).not.toContain('My bookings')

      // Logged in: "My bookings", the member's own name, and a way out, on every page.
      await digestOf(signIn(null, loginForm(a.email, PASSWORD)))
      const inside = text(renderToString(await Header()))
      expect(inside).toMatch(/<a[^>]*href="\/account"[^>]*>My bookings<\/a>/)
      expect(inside.match(/<li>/g)).toHaveLength(6)
      expect(inside).toContain('Member A')
      expect(inside).toMatch(/<button[^>]*type="submit"[^>]*>Log out<\/button>/)
      // As tall as the menu's links (44 px, min-h-11), so it is as easy to hit on a phone.
      expect(inside).toMatch(/<button[^>]*class="[^"]*\bmin-h-11\b[^"]*"[^>]*>Log out<\/button>/)
      expect(inside).not.toContain('Log in<')
    })

    it('a member look-up that fails (the database is down) shows the header as for nobody logged in', async () => {
      const { a } = await twoMembers()
      await digestOf(signIn(null, loginForm(a.email, PASSWORD)))
      const auth = vi.spyOn(p, 'auth').mockRejectedValueOnce(new Error('database down'))
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        const header = text(renderToString(await Header()))
        expect(auth).toHaveBeenCalledTimes(1)
        expect(header).toMatch(/<a[^>]*href="\/account\/login"[^>]*>Log in<\/a>/)
        expect(header).not.toContain('Log out')
        expect(logged).toHaveBeenCalledWith('Could not look up the logged-in member:', expect.objectContaining({ message: 'database down' }))
      } finally {
        auth.mockRestore()
        logged.mockRestore()
      }
      // The next page works as before.
      expect(text(renderToString(await Header()))).toContain('Log out')
    })

    it('shows members and bookings.member in /admin', async () => {
      switchOn()
      const hidden = p.collections.members.config.admin.hidden as (args: { user: unknown }) => boolean
      expect(hidden({ user: editor })).toBe(false)
      expect(memberFieldAdmin(p)).toEqual({ hidden: false, disableListColumn: false, disableListFilter: false })
    })
  })
})
