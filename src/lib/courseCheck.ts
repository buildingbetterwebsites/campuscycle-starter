// The course check's own rules, without the database: which codes it accepts, when a text contains a
// code, and how it reads the two fields that warm-ups 5 and 6 add. The route
// (src/app/api/course-check/route.ts) and src/lib/courseCheckResponse.ts use them. The agreement with
// the course's checkers is docs/COURSE-CHECK-CONTRACT.md: change these rules only together with it.
//
// It never imports the generated types (src/payload-types.ts) for whatToBring or repairs. Those fields
// do not exist until a learner adds them, so this file reads the running config's fields instead, and
// compiles and answers the same before W5, after W5 and after W6.

/** What the `code` in the address asks for. */
export type CodeRequest =
  // No code (or only spaces): the answer for the site as a whole ("Check my work" for self-study).
  | { kind: 'none' }
  // A code in one of the three accepted forms, in capitals.
  | { kind: 'code'; code: string }
  // Anything else: the route answers 400.
  | { kind: 'invalid' }

// The course app's personal code (BW- and 4 letters or digits); its team code (T, the team's number in
// two to four digits, a hyphen and 4 letters or digits, such as T29-7G6N); and the older form of 4 to 8
// letters and digits, kept for tests. Only the letters A to Z count: the `i` flag without `u` never
// lets a non-English letter (such as the long s, which JavaScript capitalises to S) pass as one.
const PERSONAL_CODE = /^BW-[A-Z0-9]{4}$/i
const TEAM_CODE = /^T[0-9]{2,4}-[A-Z0-9]{4}$/i
const SHORT_CODE = /^[A-Z0-9]{4,8}$/i

/** Reads the `code` from the address: spaces around it are trimmed, and letter case is ignored. */
export function readCode(raw: string | null): CodeRequest {
  const value = (raw ?? '').trim()
  if (value === '') return { kind: 'none' }
  if (PERSONAL_CODE.test(value) || TEAM_CODE.test(value) || SHORT_CODE.test(value)) return { kind: 'code', code: value.toUpperCase() }
  return { kind: 'invalid' }
}

/**
 * Does `text` contain `code` as a whole token? The characters right before and after it may not be a
 * letter (in any language), a digit or a hyphen, so BW-7F3K is found in "Code BW-7F3K." but not in
 * "BW-7F3KX", "XBW-7F3K" or "BW-7F3K-2" (and a team code such as T29-7G6N the same way). Letter case
 * is ignored.
 *
 * `code` must come from readCode, so it holds only A to Z, 0 to 9 and hyphens.
 */
export function containsToken(text: string, code: string): boolean {
  // Each letter of the code accepts its capital and its small form, and nothing else. (A plain `i`
  // flag together with `u` would also let the Kelvin sign stand for a K.)
  const pattern = [...code].map((character) => (/[A-Z]/i.test(character) ? `[${character.toUpperCase()}${character.toLowerCase()}]` : character)).join('')
  return new RegExp(`(?<![\\p{L}\\p{N}-])${pattern}(?![\\p{L}\\p{N}-])`, 'u').test(text)
}

/**
 * The little the course check needs to know about a field of the running config. Payload's own field
 * types fit this shape, and so do the plain objects in the tests.
 */
export type FieldShape = {
  name?: string
  type: string
  relationTo?: unknown
  hasMany?: unknown
  // A join field's collection (one slug, or several) and the relationship it reads (`on`).
  collection?: unknown
  on?: unknown
  fields?: readonly FieldShape[]
  flattenedFields?: readonly FieldShape[]
}

function field(fields: readonly FieldShape[], name: string): FieldShape | undefined {
  return fields.find((candidate) => candidate.name === name)
}

/**
 * Does the clinics collection have W5's list, in the agreed shape: an `array` field `whatToBring` with
 * a `text` field `item` in each row? Anything else (no field, a textarea, another sub-field) is not it.
 */
export function hasWhatToBringList(clinicFields: readonly FieldShape[]): boolean {
  const list = field(clinicFields, 'whatToBring')
  if (list?.type !== 'array') return false
  return field(list.flattenedFields ?? list.fields ?? [], 'item')?.type === 'text'
}

// The course's checker accepts at most this much of the list: 50 items, each at most 200 long as
// JavaScript counts a string's length (UTF-16 code units: an emoji counts 2). A longer list or item
// would make it wrongly blame this route, so the answer stops there.
export const MAX_ITEMS = 50
export const MAX_ITEM_LENGTH = 200

/**
 * Cuts `item` to at most MAX_ITEM_LENGTH code units. A character such as an emoji takes two units (a
 * "surrogate pair"); when the cut would fall between them, it cuts one unit earlier, so the answer
 * never holds half a character.
 */
export function clipItem(item: string): string {
  if (item.length <= MAX_ITEM_LENGTH) return item
  const last = item.charCodeAt(MAX_ITEM_LENGTH - 1)
  const firstHalfOfAPair = last >= 0xd800 && last <= 0xdbff
  return item.slice(0, firstHalfOfAPair ? MAX_ITEM_LENGTH - 1 : MAX_ITEM_LENGTH)
}

/**
 * The clinic's "What to bring" list: the `item` of each row, in order, leaving out empty and
 * spaces-only ones, then at most the first MAX_ITEMS, each cut by clipItem. `null` when the clinics
 * collection has no such list (before W5, or another shape); `[]` when the clinic's list has no rows.
 */
export function readWhatToBring(clinic: Record<string, unknown>, clinicFields: readonly FieldShape[]): string[] | null {
  if (!hasWhatToBringList(clinicFields)) return null
  const rows = clinic.whatToBring
  if (!Array.isArray(rows)) return []
  return (
    rows
      .map((row: unknown) => (row && typeof row === 'object' ? (row as { item?: unknown }).item : undefined))
      .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
      .slice(0, MAX_ITEMS)
      .map(clipItem)
  )
}

/**
 * Does the bookings collection have W6's link, in the agreed shape: a `relationship` field `repairs`
 * to the repairs collection, with `hasMany: true`? Anything else answers no.
 */
export function hasRepairsRelation(bookingFields: readonly FieldShape[]): boolean {
  const repairs = field(bookingFields, 'repairs')
  return repairs?.type === 'relationship' && repairs.relationTo === 'repairs' && repairs.hasMany === true
}

/** How many different repairs a booking (read with depth 0, so ids, or records at a higher depth) links to. */
export function countRepairs(booking: Record<string, unknown>): number {
  const repairs = booking.repairs
  if (!Array.isArray(repairs)) return 0
  const ids = repairs
    .map((repair: unknown) => (repair && typeof repair === 'object' ? (repair as { id?: unknown }).id : repair))
    .filter((id) => id !== null && id !== undefined)
  return new Set(ids.map(String)).size
}

/** The course check's answer. */
export type CourseCheckAnswer = { clinic: boolean; whatToBring: string[] | null; booking: boolean }

/**
 * The answer's body, built from exactly these three keys and nothing else, so no name, e-mail address,
 * note or id can slip into it from a record.
 */
export function answer(clinic: boolean, whatToBring: string[] | null, booking: boolean): CourseCheckAnswer {
  return { clinic, whatToBring: whatToBring === null ? null : [...whatToBring], booking }
}

// ---------------------------------------------------------------------------------------------------
// The team section: `?include=team` (docs/COURSE-CHECK-CONTRACT.md, "The team section"). The course's
// checks of a team's hand-ins read it: the team's own content model, its many-to-many links, and
// whether the record of its transactional task landed. Without `include=team` the answer stays the
// three keys above, exactly as the W4 to W6 checks expect it.
//
// Like the rest of this file, it never reads the generated types: a team's collections are its own,
// so it reads the running config, whatever the team has built.

/** The team section's version. Raise it whenever the section's shape changes, together with the contract. */
export const TEAM_SECTION_VERSION = 1
/** At most this many collections and many-to-many links are listed: a site with more is cut there. */
export const MAX_TEAM_COLLECTIONS = 30
export const MAX_MANY_TO_MANY = 30
/** Every slug, field path and id in the team section is cut to this many characters. */
export const MAX_NAME_LENGTH = 64

/**
 * What a team fills in, in src/course-check.config.ts: the collection its transactional task (the task
 * that saves a record, such as a booking or an order) saves into, and optionally the text field that
 * names a record, which the check searches for the team code.
 */
export type CourseCheckConfig = {
  transactional: {
    /** The collection's slug, as in its file in src/collections. */
    collection: string
    /** A top-level `text`, `textarea` or `email` field of that collection. Its value is searched, never answered. */
    nameField?: string
  }
}

/** Does the address ask for the team section? Only `include=team` (any letter case, spaces trimmed) does. */
export function readInclude(raw: string | null): boolean {
  return (raw ?? '').trim().toLowerCase() === 'team'
}

/** The little the team section needs to know about a collection of the running config. */
export type CollectionShape = {
  slug: string
  auth?: unknown
  upload?: unknown
  timestamps?: unknown
  flattenedFields: readonly FieldShape[]
}

// The starter's own collections that are not part of a site's content model, besides the accounts and
// uploads that isOwnCollection leaves out by their kind: `pages` holds the free pages (privacy, about),
// which every site has whatever its content model, and `throttle` is the server's own record of recent
// requests (src/collections/Throttle.ts).
const NOT_CONTENT = ['pages', 'throttle']

/** The six content collections the template ships with. A team's copy may keep, rename or delete them. */
export const TEMPLATE_COLLECTIONS: readonly string[] = ['topics', 'workshops', 'clinics', 'timeSlots', 'bookings', 'repairs']

/**
 * Is this collection part of the site's own content model? Not Payload's own collections (their slug
 * starts with `payload-`), not a collection with log-ins (users, members: accounts, not content), not
 * an upload collection (media: files), and not `pages` or `throttle` (NOT_CONTENT above).
 */
export function isOwnCollection(collection: Pick<CollectionShape, 'slug' | 'auth' | 'upload'>): boolean {
  if (collection.slug.startsWith('payload-')) return false
  if (collection.auth || collection.upload) return false
  return !NOT_CONTENT.includes(collection.slug)
}

/** `text` cut to `max` characters, never splitting a character (as clipItem does). */
export function clipName(text: string, max = MAX_NAME_LENGTH): string {
  if (text.length <= max) return text
  const last = text.charCodeAt(max - 1)
  return text.slice(0, last >= 0xd800 && last <= 0xdbff ? max - 1 : max)
}

/** One many-to-many link: a relationship with `hasMany: true`, and the `join` that shows it on the other side, or null. */
export type ManyToMany = { from: string; field: string; to: string; join: string | null }

type FieldVisitor = (field: FieldShape, path: string) => void

// Visits every field with a name, also inside named groups and named tabs, with its dotted path
// (`details.topics`), the way a join's `on` names it. Fields inside arrays and blocks are not visited:
// a link from a row of a list is not a link between two collections' records.
function visitFields(fields: readonly FieldShape[], visit: FieldVisitor, prefix = ''): void {
  for (const candidate of fields) {
    if (!candidate.name) continue
    const path = `${prefix}${candidate.name}`
    visit(candidate, path)
    if ((candidate.type === 'group' || candidate.type === 'tab') && candidate.flattenedFields) visitFields(candidate.flattenedFields, visit, `${path}.`)
  }
}

/** The path of the `join` field on `target` that shows `from`'s field `on` from the other side, or null. */
export function findJoin(target: CollectionShape, from: string, on: string): string | null {
  let found: string | null = null
  visitFields(target.flattenedFields, (candidate, path) => {
    if (found !== null || candidate.type !== 'join' || candidate.on !== on) return
    const collections = Array.isArray(candidate.collection) ? candidate.collection : [candidate.collection]
    if (collections.includes(from)) found = path
  })
  return found
}

/**
 * Every relationship with `hasMany: true` in the site's collections (Payload's own left out), with the
 * join on the other side. A relationship to several collections gives one link per collection. At most
 * MAX_MANY_TO_MANY, in the config's order.
 */
export function manyToManyLinks(collections: readonly CollectionShape[]): ManyToMany[] {
  const links: ManyToMany[] = []
  for (const from of collections) {
    if (from.slug.startsWith('payload-')) continue
    visitFields(from.flattenedFields, (candidate, path) => {
      if (candidate.type !== 'relationship' || candidate.hasMany !== true) return
      const targets = (Array.isArray(candidate.relationTo) ? candidate.relationTo : [candidate.relationTo]).filter((to): to is string => typeof to === 'string')
      for (const to of targets) {
        const target = collections.find((collection) => collection.slug === to)
        const join = target ? findJoin(target, from.slug, path) : null
        links.push({ from: clipName(from.slug), field: clipName(path), to: clipName(to), join: join === null ? null : clipName(join) })
      }
    })
  }
  return links.slice(0, MAX_MANY_TO_MANY)
}

/**
 * The name field the check may search for the code: `nameField` when the collection has it at the top
 * level as a `text`, `textarea` or `email` field; otherwise null.
 */
export function usableNameField(fields: readonly FieldShape[], nameField: string | undefined): string | null {
  if (!nameField) return null
  const named = field(fields, nameField)
  return named && ['text', 'textarea', 'email'].includes(named.type) ? nameField : null
}

/** The newest record of the transactional collection: its id and when it was made, nothing else. */
export type NewestRecord = { id: string; createdAt: string | null }

/** Only the id (as text, cut to MAX_NAME_LENGTH) and the creation time (ISO 8601, or null) of `doc`. */
export function newestRecord(doc: Record<string, unknown>): NewestRecord {
  const created = doc.createdAt
  const time = typeof created === 'string' || created instanceof Date ? new Date(created) : null
  return { id: clipName(String(doc.id)), createdAt: time && !Number.isNaN(time.getTime()) ? time.toISOString() : null }
}

/** One of the site's own collections, with how many records it holds (null when they could not be counted). */
export type TeamCollection = { slug: string; count: number | null; fromTemplate: boolean }

export type Transactional = {
  collection: string
  // ok: read; missing: the site has no collection with that slug; unreadable: reading it failed.
  status: 'ok' | 'missing' | 'unreadable'
  /** The field searched for the code, or null: no code asked, or no usable name field. */
  codeField: string | null
  newest: NewestRecord | null
}

export type TeamSection = {
  version: typeof TEAM_SECTION_VERSION
  collections: TeamCollection[]
  manyToMany: ManyToMany[]
  transactional: Transactional
}

/** The answer with the team section: the three agreed keys, then `team`. */
export type CourseCheckTeamAnswer = CourseCheckAnswer & { team: TeamSection }

/**
 * The team section, built key by key from the values the check found, so nothing else of a record
 * (a name, an e-mail address, a note) can slip into it.
 */
export function teamSection(collections: readonly TeamCollection[], links: readonly ManyToMany[], transactional: Transactional): TeamSection {
  return {
    version: TEAM_SECTION_VERSION,
    collections: collections.slice(0, MAX_TEAM_COLLECTIONS).map(({ slug, count, fromTemplate }) => ({ slug: clipName(slug), count, fromTemplate })),
    manyToMany: links.slice(0, MAX_MANY_TO_MANY).map(({ from, field: path, to, join }) => ({ from, field: path, to, join })),
    transactional: {
      collection: clipName(transactional.collection),
      status: transactional.status,
      codeField: transactional.codeField === null ? null : clipName(transactional.codeField),
      newest: transactional.newest === null ? null : { id: transactional.newest.id, createdAt: transactional.newest.createdAt },
    },
  }
}
