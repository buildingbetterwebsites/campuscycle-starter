// What GET /api/course-check answers (src/app/api/course-check/route.ts), as agreed with the course's
// checkers in docs/COURSE-CHECK-CONTRACT.md. The rules without the database are in courseCheck.ts.
import { getPayload, type Payload, type Where } from 'payload'
import config from '@/payload.config'
import { allowRequest, clientKey } from '@/tasks/book-slot/guards'
import {
  answer,
  containsToken,
  countRepairs,
  hasRepairsRelation,
  readCode,
  readWhatToBring,
  type CourseCheckAnswer,
  type FieldShape,
} from './courseCheck'

// 30 checks a minute from one address. The key's prefix keeps this budget apart from the booking
// form's, which uses the same throttle collection.
const LIMIT = 30
const WINDOW_MINUTES = 1
// How many records each database read fetches at a time while looking for a match.
const PAGE_SIZE = 50

// Every answer, the errors too: no browser, proxy or CDN may keep a copy, so each check reads the
// site as it is at that moment.
const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }

function json(status: number, body: object, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } })
}

/** The answer to a method the route does not offer (anything but GET and HEAD). */
export function methodNotAllowed(): Response {
  return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' } })
}

/**
 * The route's answer to one GET request. `options` is for the tests: they pass their own Payload (the
 * after-W6 fixture) and pretend another time (`now`).
 */
export async function courseCheckResponse(request: Request, options: { payload?: Payload; now?: Date } = {}): Promise<Response> {
  // The code first: checking it needs no database, so a wrong code gets its 400 even while the
  // database sleeps.
  const code = readCode(new URL(request.url).searchParams.get('code'))
  if (code.kind === 'invalid') return json(400, { error: 'invalid_code' })

  try {
    const payload = options.payload ?? (await getPayload({ config }))
    // allowRequest counts first and then remembers this check, in two steps, so a few checks at the
    // very same moment can slip past the limit together (a little over 30 a minute). That is fine for
    // a limit like this one, which only keeps one address from flooding the route.
    if (!(await allowRequest(`course-check:${clientKey(request.headers)}`, LIMIT, WINDOW_MINUTES, { payload, now: options.now }))) {
      // allowRequest counts the last minute, so waiting a minute is always enough.
      return json(429, { error: 'rate_limited' }, { 'Retry-After': String(WINDOW_MINUTES * 60) })
    }
    return json(200, await findAnswer(payload, code.kind === 'code' ? code.code : null))
  } catch (error) {
    // The database could not be read (for example while Neon wakes up from a pause). The details go
    // to the server's log, for whoever runs the site; the checker only learns to try again.
    console.error('The course check could not read the database:', error)
    return json(503, { error: 'unavailable' })
  }
}

/**
 * The answer for one code, or for the whole site when `code` is null.
 *
 * It reads with overrideAccess: true, because bookings are private (only editors may read them). That
 * is safe here: nothing of a booking leaves this function except a yes or no, and of a clinic only its
 * public "What to bring" list. answer() builds the body from exactly three keys.
 */
export async function findAnswer(payload: Payload, code: string | null): Promise<CourseCheckAnswer> {
  const clinicFields = payload.collections.clinics.config.flattenedFields as readonly FieldShape[]
  const bookingFields = payload.collections.bookings.config.flattenedFields as readonly FieldShape[]

  const clinic = await newestClinic(payload, code)
  const booking = hasRepairsRelation(bookingFields) ? await bookingWithTwoRepairs(payload, code) : false
  return answer(clinic !== null, clinic === null ? null : readWhatToBring(clinic, clinicFields), booking)
}

/**
 * The most recently updated clinic whose summary contains the code (any clinic when `code` is null),
 * or null. The database finds the clinics whose summary holds the code anywhere (`like` ignores
 * case); containsToken then keeps only those where it stands as a whole token.
 */
async function newestClinic(payload: Payload, code: string | null): Promise<Record<string, unknown> | null> {
  // Only the fields the answer needs. Before W5 the clinics have no whatToBring: Payload then leaves it
  // out, and readWhatToBring answers null.
  const select = { summary: true, whatToBring: true }
  const where: Where = code === null ? {} : { summary: { like: code } }
  for (let page = 1; ; page++) {
    const result = await payload.find({
      collection: 'clinics',
      where,
      select: select as never,
      sort: ['-updatedAt', '-id'],
      limit: PAGE_SIZE,
      page,
      depth: 0,
      overrideAccess: true,
    })
    const docs = result.docs as unknown as Record<string, unknown>[]
    const match = docs.find((clinic) => code === null || containsToken(String(clinic.summary ?? ''), code))
    if (match) return match
    if (!result.hasNextPage) return null
  }
}

/**
 * Does some booking whose name contains the code (any booking when `code` is null) link to 2 or more
 * repairs?
 *
 * What it costs: with a code, the database returns only the bookings whose name holds it, usually one
 * or two. Without a code, it reads the bookings 50 at a time, each with only its name and its repairs'
 * ids, until one has two repairs, at worst every booking. That is fine here: a practice site holds a
 * few dozen bookings, it stops at the first match, and the rate limit allows one address 30 checks a
 * minute at most.
 */
async function bookingWithTwoRepairs(payload: Payload, code: string | null): Promise<boolean> {
  const where: Where = code === null ? {} : { name: { like: code } }
  for (let page = 1; ; page++) {
    const result = await payload.find({
      collection: 'bookings',
      where,
      // The name to confirm the code, and the repairs' ids: nothing else of the booking is read.
      select: { name: true, repairs: true } as never,
      sort: 'id',
      limit: PAGE_SIZE,
      page,
      depth: 0,
      overrideAccess: true,
    })
    const docs = result.docs as unknown as Record<string, unknown>[]
    if (docs.some((booking) => (code === null || containsToken(String(booking.name ?? ''), code)) && countRepairs(booking) >= 2)) return true
    if (!result.hasNextPage) return false
  }
}
