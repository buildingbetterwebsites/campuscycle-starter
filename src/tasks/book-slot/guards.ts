// Two spam guards: the booking form's hidden trap field, and a limit on how often one device may send
// a request (the booking form and the course check both use it). You do not need to change this file.
import { createHash } from 'node:crypto'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'

// The trap field's name; src/components/site/BookingForm.tsx uses the same name. People never see this
// field (the form hides it); a program that fills in every field it finds fills this one too. The name
// is dull on purpose: browsers do not offer to fill in a field called "extra", but a program that
// fills everything still does.
export const TRAP_FIELD = 'extra'

/** True when the hidden trap field holds anything: a program, not a person, sent the form. */
export function isTrapFilled(formData: FormData): boolean {
  const value = formData.get(TRAP_FIELD)
  return typeof value === 'string' && value.trim() !== ''
}

/**
 * The address of the device that sent the request: the first entry of the x-forwarded-for header.
 * "unknown" when there is none, so such requests share one limit.
 *
 * On Vercel this is trustworthy: Vercel sets x-forwarded-for itself and drops whatever the browser
 * sent, so the first entry is the user's real address. On other hosting (or on your own computer),
 * a program can send any x-forwarded-for it likes and so get a fresh limit each time. If you host the
 * site elsewhere, check which header your host sets.
 */
export function clientKey(headers: Headers): string {
  const first = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return first || 'unknown'
}

// The address is personal data, so it is never stored as it is. A SHA-256 hash turns it into a long
// code that cannot be turned back. The salt (the site's secret, PAYLOAD_SECRET) makes the code differ
// from every other site's, so nobody can look it up in a list of hashed addresses.
function hashed(key: string): string {
  const salt = process.env.PAYLOAD_SECRET
  if (!salt) throw new Error('PAYLOAD_SECRET is not set, so the rate limit cannot hash addresses.')
  return createHash('sha256').update(`${salt}:${key}`).digest('hex')
}

// The booking form's limit: 5 bookings an hour from one device.
export const BOOKING_LIMIT = { requests: 5, minutes: 60 } as const

// The longest window any caller uses: the booking form's hour. The clean-up below never deletes a
// request younger than this. The course check (src/lib/courseCheckResponse.ts) shares the throttle
// collection with a one-minute window; without this, each check would delete the booking form's
// requests older than a minute, and its limit of 5 an hour would never be reached.
const KEEP_MINUTES = BOOKING_LIMIT.minutes

/**
 * May this device send the form now? Allows `limit` requests per `windowMinutes`, and remembers this
 * one. Each call also deletes the remembered requests that are older than the window (and older than
 * KEEP_MINUTES, above): they no longer count, and the throttle collection never grows.
 *
 * It reads and writes the throttle collection with overrideAccess: true (and straight through the
 * database for the clean-up), because that collection's access rules let nobody in, not even an
 * editor: only this server code may use it.
 *
 * `options` is for the tests: they pass their own Payload and pretend another time (`now`).
 */
export async function allowRequest(
  key: string,
  limit: number = BOOKING_LIMIT.requests,
  windowMinutes: number = BOOKING_LIMIT.minutes,
  options: { payload?: Payload; now?: Date } = {},
): Promise<boolean> {
  const payload = options.payload ?? (await getPayload({ config }))
  const now = options.now ?? new Date()
  const since = new Date(now.getTime() - windowMinutes * 60 * 1000).toISOString()
  const forgetBefore = new Date(now.getTime() - Math.max(windowMinutes, KEEP_MINUTES) * 60 * 1000).toISOString()

  // Forget the requests that no caller counts any more. payload.db.deleteMany goes straight to the
  // database and removes them all in one go; payload.delete would handle them one by one, with hooks
  // that the throttle collection does not have.
  await payload.db.deleteMany({ collection: 'throttle', where: { createdAt: { less_than: forgetBefore } } })
  const recent = await payload.count({
    collection: 'throttle',
    where: { key: { equals: hashed(key) }, createdAt: { greater_than_equal: since } },
    overrideAccess: true,
  })
  if (recent.totalDocs >= limit) return false
  await payload.create({ collection: 'throttle', data: { key: hashed(key), createdAt: now.toISOString() }, overrideAccess: true })
  return true
}
