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
  // A code in one of the two accepted forms, in capitals.
  | { kind: 'code'; code: string }
  // Anything else: the route answers 400.
  | { kind: 'invalid' }

// The course app's personal code (BW- and 4 letters or digits), and the older form of 4 to 8 letters
// and digits, kept for team codes and tests. Only the letters A to Z count: the `i` flag without `u`
// never lets a non-English letter (such as the long s, which JavaScript capitalises to S) pass as one.
const PERSONAL_CODE = /^BW-[A-Z0-9]{4}$/i
const SHORT_CODE = /^[A-Z0-9]{4,8}$/i

/** Reads the `code` from the address: spaces around it are trimmed, and letter case is ignored. */
export function readCode(raw: string | null): CodeRequest {
  const value = (raw ?? '').trim()
  if (value === '') return { kind: 'none' }
  if (PERSONAL_CODE.test(value) || SHORT_CODE.test(value)) return { kind: 'code', code: value.toUpperCase() }
  return { kind: 'invalid' }
}

/**
 * Does `text` contain `code` as a whole token? The characters right before and after it may not be a
 * letter (in any language), a digit or a hyphen, so BW-7F3K is found in "Code BW-7F3K." but not in
 * "BW-7F3KX", "XBW-7F3K" or "BW-7F3K-2". Letter case is ignored.
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
