// GET /api/course-check, as agreed with the course's checkers in docs/COURSE-CHECK-CONTRACT.md. The
// first part runs on the app's own config (before W5 and W6); the second on a copy of the site after
// W5 and W6 (tests/fixtures/config-after-w6.ts), in a database schema of its own that it drops again.
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import type { PoolClient } from 'pg'
import { getPayload, type Payload } from 'payload'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as route from '../../src/app/api/course-check/route'
import { hasRepairsRelation, hasWhatToBringList, type FieldShape, type TeamSection } from '../../src/lib/courseCheck'
import { courseCheckResponse } from '../../src/lib/courseCheckResponse'
import { allowRequest } from '../../src/tasks/book-slot/guards'
import { afterW6Config, collections as fixtureCollections, type Shape } from '../fixtures/config-after-w6'
import { getTestPayload } from '../setup/payload'
import { EXAMPLE } from '../setup/example'

// The repairs only while the site has them (tests/setup/example.ts): W6 links bookings to them, and
// a copy without them (npm run remove-example) skips the after-W6 tests below.
const clean = ['bookings', 'timeSlots', 'clinics', ...(EXAMPLE.repairs ? ['repairs'] : []), 'throttle']
const DAY = 24 * 60 * 60 * 1000

// A different made-up address for every request unless a test means to share one, so the limit of
// 30 a minute counts only where a test is about it.
let address = 0
const freshAddress = () => {
  address++
  return `198.18.${Math.floor(address / 250)}.${(address % 250) + 1}`
}

function request(query = '', ip = freshAddress(), method = 'GET'): Request {
  return new Request(`http://localhost/api/course-check${query}`, { method, headers: { 'x-forwarded-for': ip } })
}

/** The status, the two agreed headers and the body as text: everything a checker sees. */
async function seen(response: Response) {
  return {
    status: response.status,
    type: response.headers.get('content-type'),
    cache: response.headers.get('cache-control'),
    body: await response.text(),
  }
}

let slugCount = 0
async function addClinic(p: Payload, summary: string, extra: Record<string, unknown> = {}) {
  const slug = `clinic-${++slugCount}`
  return p.create({
    collection: 'clinics',
    data: { name: `Clinic ${slugCount}`, slug, day: 'Saturday', startTime: '15:00', endTime: '17:00', summary, ...extra } as never,
  })
}

async function addBooking(p: Payload, clinic: number, name: string, extra: Record<string, unknown> = {}) {
  const slot = await p.create({ collection: 'timeSlots', data: { clinic, startsAt: new Date(Date.now() + 7 * DAY).toISOString(), places: 10 } })
  return p.create({
    collection: 'bookings',
    data: { timeSlot: slot.id, name, email: 'mina.peeters@campuscycle.example', note: 'Back brake rubs.', ...extra } as never,
    overrideAccess: true,
  })
}

// The fixed answer bodies, letter for letter.
const INVALID = '{"error":"invalid_code"}'
const LIMITED = '{"error":"rate_limited"}'
const UNAVAILABLE = '{"error":"unavailable"}'
const ok = (clinic: boolean, whatToBring: string[] | null, booking: boolean) => ({
  status: 200,
  type: 'application/json',
  cache: 'no-store',
  body: JSON.stringify({ clinic, whatToBring, booking }),
})

// The team section (?include=team): the answer's `team`, after a 200 with the three agreed keys first.
async function teamOf(response: Response): Promise<TeamSection> {
  expect(response.status).toBe(200)
  const body = (await response.json()) as Record<string, unknown>
  expect(Object.keys(body)).toEqual(['clinic', 'whatToBring', 'booking', 'team'])
  return body.team as TeamSection
}

// The template's six content collections, in the config's order: users, media, pages, throttle and
// members are left out (src/lib/courseCheck.ts, isOwnCollection).
const TEMPLATE_SLUGS = [...(EXAMPLE.workshops ? ['topics', 'workshops'] : []), 'clinics', 'timeSlots', 'bookings', ...(EXAMPLE.repairs ? ['repairs'] : [])]
// The template's one many-to-many: workshops.topics, shown on the topics by the join `workshops`.
const TEMPLATE_MANY_TO_MANY = EXAMPLE.workshops ? [{ from: 'workshops', field: 'topics', to: 'topics', join: 'workshops' }] : []

describe('the course check, before W5 and W6 (the app as it ships)', () => {
  // The app as the starter ships it, without W5's and W6's fields (tests/fixtures/config-after-w6.ts,
  // 'shipped'), in a schema of its own: a learner's copy has those fields after W5 and W6, and these
  // tests keep testing the shipped app all the same. The same function the route runs, on that config;
  // the route file itself is tested below (HEAD, and the other methods).
  const schema = 'course_check_shipped'
  let base: Payload
  let p: Payload
  const answer = (incoming: Request) => courseCheckResponse(incoming, { payload: p })

  beforeAll(async () => {
    base = await getTestPayload()
    p = await openFixture(base, 'shipped', schema)
  }, 120_000)
  beforeEach(async () => {
    for (const slug of clean) await p.db.deleteMany({ collection: slug as never, where: { id: { exists: true } } })
  })
  afterEach(() => vi.restoreAllMocks())
  afterAll(() => closeFixture(base, p, schema))

  it('is the app without the W5 and W6 fields', async () => {
    const appSlugs = base.config.collections.map((collection) => collection.slug).filter((slug) => !slug.startsWith('payload-'))
    expect((await fixtureCollections('shipped')).map((collection) => collection.slug)).toEqual(appSlugs)
    expect(fieldsOf(p, 'clinics').some((field) => field.name === 'whatToBring')).toBe(false)
    expect(fieldsOf(p, 'bookings').some((field) => field.name === 'repairs')).toBe(false)
    if (EXAMPLE.repairs) expect((p.collections.repairs.config.flattenedFields as readonly FieldShape[]).some((field) => field.name === 'bookings')).toBe(false)
  })

  it('a clinic whose summary holds the code: clinic yes, no list (before W5), no booking (before W6)', async () => {
    await addClinic(p, 'Saturday repair clinic. Code BW-7F3K.')
    expect(await seen(await answer(request('?code=BW-7F3K')))).toEqual(ok(true, null, false))
    expect(await seen(await answer(request('?code=%20bw-7f3k%20')))).toEqual(ok(true, null, false))
  })

  it('the 4-to-8 form of code works the same way', async () => {
    await addClinic(p, 'Team code k7q2, Saturday.')
    expect(await seen(await answer(request('?code=K7Q2')))).toEqual(ok(true, null, false))
  })

  it("the course app's team code works the same way, and only as a whole token", async () => {
    await addClinic(p, 'Codes T29-7G6NX and XT29-7G6N and T29-7G6N-2.')
    expect(await seen(await answer(request('?code=T29-7G6N')))).toEqual(ok(false, null, false))
    await addClinic(p, 'Team T29-7G6N, Saturday.')
    expect(await seen(await answer(request('?code=T29-7G6N')))).toEqual(ok(true, null, false))
    expect(await seen(await answer(request('?code=%20t29-7g6n%20')))).toEqual(ok(true, null, false))
  })

  it('no clinic with the code: everything no', async () => {
    await addClinic(p, 'Saturday repair clinic. Code BW-7F3K.')
    expect(await seen(await answer(request('?code=BW-0000')))).toEqual(ok(false, null, false))
  })

  it('the code inside a longer word does not count, though the database finds it', async () => {
    await addClinic(p, 'Codes BW-7F3KX and XBW-7F3K and BW-7F3K-2.')
    expect(await seen(await answer(request('?code=BW-7F3K')))).toEqual(ok(false, null, false))
  })

  it('without a code it answers for the whole site: no clinic yet, then a clinic', async () => {
    for (const query of ['', '?code=', '?code=%20%20']) {
      expect(await seen(await answer(request(query))), query).toEqual(ok(false, null, false))
    }
    await addClinic(p, 'Saturday repair clinic.')
    for (const query of ['', '?code=', '?code=%20%20']) {
      expect(await seen(await answer(request(query))), query).toEqual(ok(true, null, false))
    }
  })

  it('a code in any other form answers 400 with the agreed body, before reading the database', async () => {
    // Neither the clinics and bookings (find) nor the rate limit (count, create) are read.
    const reads = [vi.spyOn(p, 'find'), vi.spyOn(p, 'count'), vi.spyOn(p, 'create')]
    for (const bad of ['%3Cb%3EK7Q2%3C%2Fb%3E', 'K7', 'K7Q2K7Q2K', 'K7%20Q2', 'x'.repeat(40), 'BW-7F3', 'BW_7F3K', 'T29-7G6NX', 'T2-7G6N']) {
      expect(await seen(await answer(request(`?code=${bad}`))), bad).toEqual({ status: 400, type: 'application/json', cache: 'no-store', body: INVALID })
    }
    for (const read of reads) expect(read).not.toHaveBeenCalled()
  })

  it('HEAD answers the same status and headers as GET, without a body', async () => {
    await addClinic(p, 'Code BW-7F3K.')
    for (const query of ['?code=BW-7F3K', '', '?code=K7']) {
      const get = await route.GET(request(query))
      const head = await route.HEAD(request(query, freshAddress(), 'HEAD'))
      // The route answers from the app's own database, with the three agreed keys.
      if (get.status === 200) expect(Object.keys(await get.clone().json()), query).toEqual(['clinic', 'whatToBring', 'booking'])
      expect(head.status, query).toBe(get.status)
      expect([...head.headers], query).toEqual([...get.headers])
      expect(await head.text(), query).toBe('')
    }
  })

  // These call the route's exported handlers directly. Two things are checked only against Next.js's
  // documented behaviour (and its source, node_modules/next/dist/server/route-modules/app-route), not by
  // a test: that Next.js sends OPTIONS to the exported handler instead of answering 204 itself, and that
  // it refuses a non-standard method (TRACE, a made-up one) before the route runs.
  it('every other method answers 405, OPTIONS too; the route reads the database on every request', async () => {
    const others = { POST: route.POST, PUT: route.PUT, PATCH: route.PATCH, DELETE: route.DELETE, OPTIONS: route.OPTIONS }
    for (const [method, handler] of Object.entries(others)) {
      const response = handler()
      expect(response.status, method).toBe(405)
      expect(response.headers.get('allow'), method).toBe('GET, HEAD')
      expect(await response.text(), method).toBe('')
    }
    // Exactly these: a method the file does not name would get Next.js's own answer instead.
    expect(Object.keys(route).sort()).toEqual(['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'dynamic'])
    expect(route.dynamic).toBe('force-dynamic')
  })

  it('the 31st check in a minute from one address answers 429 with Retry-After; others and the next minute are fine', async () => {
    const ip = '203.0.113.50'
    for (let i = 1; i <= 30; i++) expect((await answer(request('?code=BW-7F3K', ip))).status, `check ${i}`).toBe(200)
    const limited = await answer(request('?code=BW-7F3K', ip))
    expect(limited.headers.get('retry-after')).toBe('60')
    expect(await seen(limited)).toEqual({ status: 429, type: 'application/json', cache: 'no-store', body: LIMITED })
    // HEAD counts too, and says the same.
    expect((await answer(request('', ip, 'HEAD'))).status).toBe(429)
    // Another address is not limited.
    expect((await answer(request('?code=BW-7F3K'))).status).toBe(200)
    // A minute later the same address is fine again.
    const later = new Date(Date.now() + 61 * 1000)
    expect((await courseCheckResponse(request('?code=BW-7F3K', ip), { payload: p, now: later })).status).toBe(200)
  })

  it("has its own budget: checks neither use up nor wipe out the booking form's limit", async () => {
    const ip = '203.0.113.60'
    // Five bookings ten minutes ago reach the booking form's limit (5 an hour)...
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
    for (let i = 0; i < 5; i++) expect(await allowRequest(ip, 5, 60, { payload: p, now: tenMinutesAgo })).toBe(true)
    // ...a course check from the same address now...
    expect((await answer(request('?code=BW-7F3K', ip))).status).toBe(200)
    // ...leaves that limit in place: the check's one-minute window does not forget them.
    expect(await allowRequest(ip, 5, 60, { payload: p })).toBe(false)

    // And 30 checks from a new address leave its booking budget whole.
    const other = '203.0.113.61'
    for (let i = 0; i < 30; i++) expect((await answer(request('', other))).status).toBe(200)
    for (let i = 0; i < 5; i++) expect(await allowRequest(other, 5, 60, { payload: p })).toBe(true)
  })

  it('a database that cannot be read answers 503 with the agreed body, and logs the problem on the server', async () => {
    await addClinic(p, 'Code BW-7F3K.')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const problem = new Error('connect ECONNREFUSED 10.0.0.1:5432 (secret detail)')

    vi.spyOn(p, 'find').mockRejectedValueOnce(problem)
    expect(await seen(await answer(request('?code=BW-7F3K')))).toEqual({ status: 503, type: 'application/json', cache: 'no-store', body: UNAVAILABLE })
    expect(log).toHaveBeenCalledWith('The course check could not read the database:', problem)

    // The rate limit reads the database first: when that fails, the same answer.
    vi.spyOn(p, 'count').mockRejectedValueOnce(problem)
    expect(await seen(await answer(request('')))).toEqual({ status: 503, type: 'application/json', cache: 'no-store', body: UNAVAILABLE })
    expect(log).toHaveBeenCalledTimes(2)

    // The next request reads the database again.
    expect(await seen(await answer(request('?code=BW-7F3K')))).toEqual(ok(true, null, false))
  })

  it('never answers with a name, an e-mail address, a note or an id', async () => {
    const clinic = await addClinic(p, 'Code BW-7F3K.')
    await addBooking(p, clinic.id, 'Mina Peeters BW-7F3K')
    for (const query of ['?code=BW-7F3K', '']) {
      const body = await (await answer(request(query))).text()
      expect(Object.keys(JSON.parse(body)), query).toEqual(['clinic', 'whatToBring', 'booking'])
      expect(body, query).toBe(JSON.stringify({ clinic: true, whatToBring: null, booking: false }))
    }
  })

  it('adds the team section only for include=team; any other include leaves the three keys', async () => {
    await addClinic(p, 'Code BW-7F3K.')
    for (const query of ['?include=teams', '?include=', '?include=all&code=BW-7F3K', '?team=1']) {
      expect(Object.keys(await (await answer(request(query))).json()), query).toEqual(['clinic', 'whatToBring', 'booking'])
    }
    for (const query of ['?include=team', '?include=TEAM&code=BW-7F3K']) {
      expect((await teamOf(await answer(request(query)))).version, query).toBe(1)
    }
    // A wrong code is still a 400, before the database is read, with or without the team section.
    expect(await seen(await answer(request('?include=team&code=K7')))).toEqual({ status: 400, type: 'application/json', cache: 'no-store', body: INVALID })
  })

  it("team: the template's collections with their counts, its many-to-many, and no booking yet", async () => {
    const team = await teamOf(await answer(request('?include=team')))
    // A team's own collections (and their many-to-many links) come on top of the template's, marked so.
    const own = team.collections.filter((collection) => !TEMPLATE_SLUGS.includes(collection.slug))
    expect(team.collections.filter((collection) => TEMPLATE_SLUGS.includes(collection.slug))).toEqual(TEMPLATE_SLUGS.map((slug) => ({ slug, count: 0, fromTemplate: true })))
    for (const collection of own) expect(collection.fromTemplate, collection.slug).toBe(false)
    expect(team.manyToMany).toEqual(own.length === 0 ? TEMPLATE_MANY_TO_MANY : expect.arrayContaining(TEMPLATE_MANY_TO_MANY))
    expect(team.transactional).toEqual({ collection: 'bookings', status: 'ok', codeField: null, newest: null })

    const clinic = await addClinic(p, 'Code BW-7F3K.')
    await addBooking(p, clinic.id, 'Somebody')
    await new Promise((resolve) => setTimeout(resolve, 5))
    const newest = await addBooking(p, clinic.id, 'Somebody else')
    const after = await teamOf(await answer(request('?include=team')))
    expect(after.collections.find((collection) => collection.slug === 'bookings')?.count).toBe(2)
    expect(after.collections.find((collection) => collection.slug === 'timeSlots')?.count).toBe(2)
    expect(after.collections.find((collection) => collection.slug === 'clinics')?.count).toBe(1)
    expect(after.transactional).toEqual({
      collection: 'bookings', status: 'ok', codeField: null, newest: { id: String(newest.id), createdAt: new Date(newest.createdAt).toISOString() },
    })
  })

  it('team, with a code: the newest booking whose name holds the code as a whole token', async () => {
    const clinic = await addClinic(p, 'Code BW-7F3K.')
    const mine = await addBooking(p, clinic.id, 'Team K7Q2, test booking')
    await new Promise((resolve) => setTimeout(resolve, 5))
    await addBooking(p, clinic.id, 'Team K7Q2X')
    await addBooking(p, clinic.id, 'Somebody else')
    const team = await teamOf(await answer(request('?include=team&code=k7q2')))
    expect(team.transactional).toEqual({ collection: 'bookings', status: 'ok', codeField: 'name', newest: { id: String(mine.id), createdAt: new Date(mine.createdAt).toISOString() } })
    expect((await teamOf(await answer(request('?include=team&code=Z9Z9')))).transactional).toEqual({ collection: 'bookings', status: 'ok', codeField: 'name', newest: null })
  })

  it("team, with the course app's team code: the newest booking whose name holds it as a whole token", async () => {
    const clinic = await addClinic(p, 'Code BW-7F3K.')
    const mine = await addBooking(p, clinic.id, 'Team T29-7G6N, test booking')
    await new Promise((resolve) => setTimeout(resolve, 5))
    await addBooking(p, clinic.id, 'Team T29-7G6NX')
    await addBooking(p, clinic.id, 'Team T29-7G6N-2')
    const response = await answer(request('?include=team&code=t29-7g6n'))
    expect(response.status).toBe(200)
    expect((await teamOf(response)).transactional).toEqual({ collection: 'bookings', status: 'ok', codeField: 'name', newest: { id: String(mine.id), createdAt: new Date(mine.createdAt).toISOString() } })
  })

  it.runIf(EXAMPLE.repairs)("team: reads the team's own config: another collection, a name field that is not text, a missing collection", async () => {
    const clinic = await addClinic(p, 'Code BW-7F3K.')
    const repair = await p.create({ collection: 'repairs', data: { name: 'Flat tyre K7Q2', price: 10 } })
    await addBooking(p, clinic.id, 'Mina K7Q2')
    const withConfig = (transactional: { collection: string; nameField?: string }) => (incoming: Request) =>
      courseCheckResponse(incoming, { payload: p, teamConfig: { transactional } })
    const repairs = await teamOf(await withConfig({ collection: 'repairs', nameField: 'name' })(request('?include=team&code=K7Q2')))
    expect(repairs.transactional).toEqual({ collection: 'repairs', status: 'ok', codeField: 'name', newest: { id: String(repair.id), createdAt: new Date(repair.createdAt).toISOString() } })
    // `price` is a number: it is never searched, and the newest repair answers all the same.
    const byPrice = await teamOf(await withConfig({ collection: 'repairs', nameField: 'price' })(request('?include=team&code=K7Q2')))
    expect(byPrice.transactional).toEqual({ collection: 'repairs', status: 'ok', codeField: null, newest: { id: String(repair.id), createdAt: new Date(repair.createdAt).toISOString() } })
    const missing = await teamOf(await withConfig({ collection: 'orders' })(request('?include=team')))
    expect(missing.transactional).toEqual({ collection: 'orders', status: 'missing', codeField: null, newest: null })
  })

  it.runIf(EXAMPLE.repairs && EXAMPLE.workshops)('team: a collection that cannot be read answers null or unreadable, the rest still answers, and the log has the details', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const problem = new Error('relation "repairs" does not exist (secret detail)')
    const count = p.count.bind(p)
    vi.spyOn(p, 'count').mockImplementation(((args: Parameters<Payload['count']>[0]) => (args.collection === 'repairs' ? Promise.reject(problem) : count(args))) as never)
    const find = p.find.bind(p)
    vi.spyOn(p, 'find').mockImplementation(((args: Parameters<Payload['find']>[0]) => (args.collection === 'bookings' ? Promise.reject(problem) : find(args))) as never)
    const response = await answer(request('?include=team'))
    const body = await response.clone().text()
    const team = await teamOf(response)
    expect(team.collections.find((collection) => collection.slug === 'repairs')?.count).toBeNull()
    expect(team.collections.find((collection) => collection.slug === 'topics')?.count).toBe(0)
    expect(team.transactional).toEqual({ collection: 'bookings', status: 'unreadable', codeField: null, newest: null })
    expect(body.includes('secret detail')).toBe(false)
    expect(log).toHaveBeenCalledWith('The course check could not count the collection repairs:', problem)
    expect(log).toHaveBeenCalledWith('The course check could not read the collection bookings:', problem)
  })

  it('the route itself answers the team section from the app, with the starter config (bookings)', async () => {
    const team = await teamOf(await route.GET(request('?include=team')))
    expect(team.transactional.collection).toBe('bookings')
    expect(team.transactional.status).toBe('ok')
    const slugs = team.collections.map((collection) => collection.slug)
    expect(slugs).toEqual(expect.arrayContaining(TEMPLATE_SLUGS))
    for (const left of ['users', 'media', 'pages', 'throttle', 'members']) expect(slugs, left).not.toContain(left)
    for (const link of TEMPLATE_MANY_TO_MANY) expect(team.manyToMany).toContainEqual(link)
  })
})

// The site after W5 and W6: the same route file, reading a config with the two new fields.
async function openFixture(base: Payload, shape: Shape, schema: string): Promise<Payload> {
  const pool = (base.db as unknown as PostgresAdapter).pool
  await pool.query(`drop schema if exists ${schema} cascade`)
  await pool.query(`create schema ${schema}`)
  // The schema push (drizzle-kit) writes a progress line straight to the terminal; keep the test
  // output clean. A failed push still throws.
  const quiet = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  try {
    return await getPayload({ config: afterW6Config(shape, schema), key: `course-check-${schema}`, disableOnInit: true })
  } finally {
    quiet.mockRestore()
  }
}

async function closeFixture(base: Payload, fixture: Payload | undefined, schema: string): Promise<void> {
  if (fixture) {
    // The same clean-up as tests/setup/payload.ts: release Payload's first connection, then the rest.
    const pool = (fixture.db as unknown as PostgresAdapter).pool
    ;(pool as typeof pool & { _clients: PoolClient[] })._clients[0]?.release()
    await pool.end()
    await fixture.destroy()
  }
  await (base.db as unknown as PostgresAdapter).pool.query(`drop schema if exists ${schema} cascade`)
}

const fieldsOf = (p: Payload, slug: 'clinics' | 'bookings') => p.collections[slug].config.flattenedFields as readonly FieldShape[]

describe.runIf(EXAMPLE.repairs && EXAMPLE.workshops)('the course check after W5 and W6 (tests/fixtures/config-after-w6.ts)', () => {
  const schema = 'course_check_after_w6'
  let base: Payload
  let p: Payload
  let repairIds: number[]
  const check = async (query: string) => seen(await courseCheckResponse(request(query), { payload: p }))

  beforeAll(async () => {
    base = await getTestPayload()
    p = await openFixture(base, 'agreed', schema)
  }, 120_000)
  beforeEach(async () => {
    for (const slug of clean) await p.db.deleteMany({ collection: slug as never, where: { id: { exists: true } } })
    repairIds = []
    for (const name of ['Flat tyre', 'Brake check', 'Chain']) {
      repairIds.push((await p.create({ collection: 'repairs', data: { name, price: 10 } })).id as number)
    }
  })
  afterAll(() => closeFixture(base, p, schema))

  it('is the app with only the two W5/W6 fields added, in the agreed shapes', async () => {
    const appSlugs = base.config.collections.map((collection) => collection.slug).filter((slug) => !slug.startsWith('payload-'))
    expect((await fixtureCollections('agreed')).map((collection) => collection.slug)).toEqual(appSlugs)
    expect(hasWhatToBringList(fieldsOf(p, 'clinics'))).toBe(true)
    expect(hasRepairsRelation(fieldsOf(p, 'bookings'))).toBe(true)
    // Each field once, also when the app has it itself (a learner's copy after W5 and W6).
    for (const [slug, name] of [['clinics', 'whatToBring'], ['bookings', 'repairs']] as const) {
      expect(fieldsOf(p, slug).filter((field) => field.name === name), `${slug}.${name}`).toHaveLength(1)
    }
  })

  it("answers the clinic's list and yes for a booking with the code and two repairs", async () => {
    const clinic = await addClinic(p, 'Saturday repair clinic. Code BW-7F3K.', { whatToBring: [{ item: 'your bike' }, { item: 'a lock' }] })
    const booking = await addBooking(p, clinic.id as number, 'Mina BW-7F3K', { repairs: repairIds.slice(0, 2) })
    expect(await check('?code=bw-7f3k')).toEqual(ok(true, ['your bike', 'a lock'], true))
    // The reverse side W6 adds (repairs.bookings) shows the booking; the route itself never reads it.
    const repair = await p.findByID({ collection: 'repairs', id: repairIds[0], depth: 0 })
    expect((repair as unknown as { bookings: { docs: unknown[] } }).bookings.docs).toEqual([booking.id])
  })

  it("answers the same for the course app's team code, only as a whole token", async () => {
    const clinic = await addClinic(p, 'Team T29-7G6N, Saturday.', { whatToBring: [{ item: 'your bike' }] })
    await addBooking(p, clinic.id as number, 'Team T29-7G6NX', { repairs: repairIds.slice(0, 2) })
    expect(await check('?code=T29-7G6N')).toEqual(ok(true, ['your bike'], false))
    await addBooking(p, clinic.id as number, 'Team T29-7G6N', { repairs: repairIds.slice(0, 2) })
    expect(await check('?code=t29-7g6n')).toEqual(ok(true, ['your bike'], true))
  })

  it('answers no for a booking with only one repair, or without the code in its name', async () => {
    const clinic = await addClinic(p, 'Code BW-7F3K.', { whatToBring: [{ item: 'your bike' }] })
    await addBooking(p, clinic.id as number, 'Mina BW-7F3K', { repairs: [repairIds[0]] })
    await addBooking(p, clinic.id as number, 'Mina BW-7F3KX', { repairs: repairIds })
    await addBooking(p, clinic.id as number, 'Somebody else', { repairs: repairIds })
    expect(await check('?code=BW-7F3K')).toEqual(ok(true, ['your bike'], false))
  })

  it('reads the most recently updated clinic with the code, and [] for a list with no rows', async () => {
    const older = await addClinic(p, 'Code BW-7F3K.', { whatToBring: [{ item: 'your bike' }, { item: 'a lock' }] })
    await addClinic(p, 'Code BW-7F3K, the second one.', { whatToBring: [{ item: 'a pump' }] })
    await addClinic(p, 'No code here.', { whatToBring: [{ item: 'not this one' }] })
    expect(await check('?code=BW-7F3K')).toEqual(ok(true, ['a pump'], false))
    await new Promise((resolve) => setTimeout(resolve, 5))
    await p.update({ collection: 'clinics', id: older.id, data: { whatToBring: [{ item: 'a helmet' }, { item: 'your bike' }] } as never })
    expect(await check('?code=BW-7F3K')).toEqual(ok(true, ['a helmet', 'your bike'], false))
    await new Promise((resolve) => setTimeout(resolve, 5))
    await p.update({ collection: 'clinics', id: older.id, data: { whatToBring: [] } as never })
    expect(await check('?code=BW-7F3K')).toEqual(ok(true, [], false))
  })

  it('without a code: the newest clinic and any booking with two repairs', async () => {
    expect(await check('')).toEqual(ok(false, null, false))
    await addClinic(p, 'Last term.', { whatToBring: [{ item: 'an old list' }] })
    await new Promise((resolve) => setTimeout(resolve, 5))
    const clinic = await addClinic(p, 'Saturday repair clinic.', { whatToBring: [{ item: 'your bike' }, { item: 'a lock' }] })
    await addBooking(p, clinic.id as number, 'Somebody', { repairs: [repairIds[0]] })
    expect(await check('')).toEqual(ok(true, ['your bike', 'a lock'], false))
    await addBooking(p, clinic.id as number, 'Somebody else', { repairs: repairIds.slice(1) })
    expect(await check('')).toEqual(ok(true, ['your bike', 'a lock'], true))
  })

  it('never answers with a name, an e-mail address, a note or an id', async () => {
    const clinic = await addClinic(p, 'Code BW-7F3K.', { whatToBring: [{ item: 'your bike' }, { item: 'a lock' }] })
    const booking = await addBooking(p, clinic.id as number, 'Mina Peeters BW-7F3K', { repairs: repairIds })
    for (const query of ['?code=BW-7F3K', '']) {
      const body = (await check(query)).body
      const parsed = JSON.parse(body) as Record<string, unknown>
      expect(Object.keys(parsed), query).toEqual(['clinic', 'whatToBring', 'booking'])
      expect(parsed, query).toEqual({ clinic: true, whatToBring: ['your bike', 'a lock'], booking: true })
      for (const secret of ['Mina', 'mina.peeters', '@', 'Back brake', `"id"`, String(booking.id), String(clinic.id)]) {
        expect(body.includes(secret), `${query}: ${secret}`).toBe(false)
      }
    }
  })

  it("team: W6's many-to-many shows with its join, and the team section holds no name, e-mail address or note", async () => {
    const clinic = await addClinic(p, 'Code BW-7F3K.', { whatToBring: [{ item: 'your bike' }] })
    const booking = await addBooking(p, clinic.id as number, 'Mina Peeters BW-7F3K', { repairs: repairIds })
    for (const query of ['?include=team&code=BW-7F3K', '?include=team']) {
      const response = await courseCheckResponse(request(query), { payload: p })
      const body = await response.clone().text()
      const team = await teamOf(response)
      expect(team.manyToMany, query).toEqual([
        { from: 'workshops', field: 'topics', to: 'topics', join: 'workshops' },
        { from: 'bookings', field: 'repairs', to: 'repairs', join: 'bookings' },
      ])
      expect(team.collections.find((collection) => collection.slug === 'repairs')?.count, query).toBe(3)
      expect(team.transactional.newest, query).toEqual({ id: String(booking.id), createdAt: new Date(booking.createdAt).toISOString() })
      for (const secret of ['Mina', 'mina.peeters', '@', 'Back brake', 'Flat tyre', 'your bike']) {
        expect(JSON.stringify(team).includes(secret), `${query}: ${secret}`).toBe(false)
      }
      expect(body.includes('mina.peeters'), query).toBe(false)
    }
  })
})

describe.runIf(EXAMPLE.repairs)('the course check with the two fields in another shape', () => {
  const schema = 'course_check_other_shape'
  let base: Payload
  let p: Payload

  beforeAll(async () => {
    base = await getTestPayload()
    p = await openFixture(base, 'other', schema)
  }, 120_000)
  afterAll(() => closeFixture(base, p, schema))

  it('a textarea list answers null, and a link to one repair only answers no', async () => {
    const clinic = await addClinic(p, 'Code BW-7F3K.', { whatToBring: 'your bike, a lock' })
    const repair = await p.create({ collection: 'repairs', data: { name: 'Flat tyre', price: 10 } })
    await addBooking(p, clinic.id as number, 'Mina BW-7F3K', { repairs: repair.id })
    expect(await seen(await courseCheckResponse(request('?code=BW-7F3K'), { payload: p }))).toEqual(ok(true, null, false))
    expect(await seen(await courseCheckResponse(request(''), { payload: p }))).toEqual(ok(true, null, false))
  })
})
