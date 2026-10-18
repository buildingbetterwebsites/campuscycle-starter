// What GET /api/course-check answers (src/app/api/course-check/route.ts), as agreed with the course's
// checkers in docs/COURSE-CHECK-CONTRACT.md. The rules without the database are in courseCheck.ts.
import { getPayload, type CollectionSlug, type Payload, type Where } from 'payload'
import config from '@/payload.config'
import { courseCheckConfig } from '@/course-check.config'
import { allowRequest, clientKey } from '@/tasks/book-slot/guards'
import {
  answer,
  containsToken,
  countRepairs,
  hasRepairsRelation,
  isOwnCollection,
  manyToManyLinks,
  newestRecord,
  readCode,
  readInclude,
  readWhatToBring,
  teamSection,
  TEMPLATE_COLLECTIONS,
  usableNameField,
  type CollectionShape,
  type CourseCheckAnswer,
  type CourseCheckConfig,
  type CourseCheckTeamAnswer,
  type FieldShape,
  type NewestRecord,
  type TeamCollection,
  type TeamSection,
  type Transactional,
} from './courseCheck'

// 30 checks a minute from one address. The key's prefix keeps this budget apart from the booking
// form's, which uses the same throttle collection.
const LIMIT = 30
const WINDOW_MINUTES = 1
// How many records each database read fetches at a time while looking for a match.
const PAGE_SIZE = 50

// The starter's two collections the warm-up checks read (W4-W6).
const CLINICS = 'clinics' as CollectionSlug
const BOOKINGS = 'bookings' as CollectionSlug

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
 * after-W6 fixture), pretend another time (`now`) and pass their own team config (`teamConfig`).
 */
export async function courseCheckResponse(
  request: Request,
  options: { payload?: Payload; now?: Date; teamConfig?: CourseCheckConfig } = {},
): Promise<Response> {
  // The code first: checking it needs no database, so a wrong code gets its 400 even while the
  // database sleeps.
  const params = new URL(request.url).searchParams
  const code = readCode(params.get('code'))
  if (code.kind === 'invalid') return json(400, { error: 'invalid_code' })
  // `include=team` adds the team section; any other value, or none, leaves the three agreed keys alone.
  const withTeam = readInclude(params.get('include'))

  try {
    const payload = options.payload ?? (await getPayload({ config }))
    // allowRequest counts first and then remembers this check, in two steps, so a few checks at the
    // very same moment can slip past the limit together (a little over 30 a minute). That is fine for
    // a limit like this one, which only keeps one address from flooding the route.
    if (!(await allowRequest(`course-check:${clientKey(request.headers)}`, LIMIT, WINDOW_MINUTES, { payload, now: options.now }))) {
      // allowRequest counts the last minute, so waiting a minute is always enough.
      return json(429, { error: 'rate_limited' }, { 'Retry-After': String(WINDOW_MINUTES * 60) })
    }
    const asked = code.kind === 'code' ? code.code : null
    const found = await findAnswer(payload, asked)
    if (!withTeam) return json(200, found)
    const withSection: CourseCheckTeamAnswer = { ...found, team: await findTeamSection(payload, asked, options.teamConfig ?? courseCheckConfig) }
    return json(200, withSection)
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
 *
 * A site without the starter's clinics or bookings collection (a team that removed or renamed them for
 * its own model) has no warm-up clinic or booking to find: it answers "no clinic, no list, no booking"
 * (docs/COURSE-CHECK-CONTRACT.md), and the team section still answers from src/course-check.config.ts.
 * The two collections are looked up by name, not through the generated types, so this file still
 * compiles on such a site.
 */
export async function findAnswer(payload: Payload, code: string | null): Promise<CourseCheckAnswer> {
  const collections = payload.collections as Partial<Record<string, { config: { flattenedFields: unknown } }>>
  const clinics = collections[CLINICS]
  const bookings = collections[BOOKINGS]
  if (!clinics || !bookings) return answer(false, null, false)
  const clinicFields = clinics.config.flattenedFields as readonly FieldShape[]
  const bookingFields = bookings.config.flattenedFields as readonly FieldShape[]

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
      collection: CLINICS,
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
      collection: BOOKINGS,
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

/**
 * The team section (`?include=team`): the site's own collections with their record counts, its
 * many-to-many links, and the newest record of the transactional collection named in
 * src/course-check.config.ts (with a code and a name field: the newest whose name holds the code).
 *
 * Read with overrideAccess: true, like the rest of the check, because bookings and most transactional
 * records are private. That is safe here: of a record only its id and creation time leave this
 * function, and teamSection() builds the section key by key.
 *
 * A collection that cannot be counted answers `count: null`, and a transactional collection that
 * cannot be read answers `status: 'unreadable'`, with the details in the server's log: one broken
 * collection of a team's own does not hide the rest of the answer.
 */
export async function findTeamSection(payload: Payload, code: string | null, config: CourseCheckConfig): Promise<TeamSection> {
  const all = payload.config.collections as unknown as readonly CollectionShape[]
  const collections: TeamCollection[] = []
  for (const collection of all.filter(isOwnCollection)) {
    collections.push({ slug: collection.slug, count: await countRecords(payload, collection.slug), fromTemplate: TEMPLATE_COLLECTIONS.includes(collection.slug) })
  }
  return teamSection(collections, manyToManyLinks(all), await findTransactional(payload, all, code, config))
}

async function countRecords(payload: Payload, slug: string): Promise<number | null> {
  try {
    return (await payload.count({ collection: slug as never, overrideAccess: true })).totalDocs
  } catch (error) {
    console.error(`The course check could not count the collection ${slug}:`, error)
    return null
  }
}

async function findTransactional(payload: Payload, all: readonly CollectionShape[], code: string | null, config: CourseCheckConfig): Promise<Transactional> {
  const slug = config.transactional.collection
  const target = all.find((collection) => collection.slug === slug)
  if (!target) return { collection: slug, status: 'missing', codeField: null, newest: null }
  const codeField = code === null ? null : usableNameField(target.flattenedFields, config.transactional.nameField)
  try {
    return { collection: slug, status: 'ok', codeField, newest: await newestTransactional(payload, target, code, codeField) }
  } catch (error) {
    console.error(`The course check could not read the collection ${slug}:`, error)
    return { collection: slug, status: 'unreadable', codeField, newest: null }
  }
}

/**
 * The newest record of `target` (by creation time; by id when the collection keeps no timestamps), or,
 * with a code and a name field, the newest whose name field holds the code as a whole token. Reads
 * only the creation time and the name field, and answers only the id and the creation time.
 */
async function newestTransactional(payload: Payload, target: CollectionShape, code: string | null, codeField: string | null): Promise<NewestRecord | null> {
  const byCode = code !== null && codeField !== null
  const timestamps = target.timestamps !== false
  const select: Record<string, true> = {}
  if (timestamps) select.createdAt = true
  if (byCode) select[codeField] = true
  for (let page = 1; ; page++) {
    const result = await payload.find({
      collection: target.slug as never,
      where: byCode ? { [codeField]: { like: code } } : {},
      ...(Object.keys(select).length > 0 ? { select: select as never } : {}),
      sort: timestamps ? ['-createdAt', '-id'] : '-id',
      limit: byCode ? PAGE_SIZE : 1,
      page,
      depth: 0,
      overrideAccess: true,
    })
    const docs = result.docs as unknown as Record<string, unknown>[]
    const match = byCode ? docs.find((doc) => containsToken(String(doc[codeField] ?? ''), code)) : docs[0]
    if (match) return newestRecord(match)
    if (!byCode || !result.hasNextPage) return null
  }
}
