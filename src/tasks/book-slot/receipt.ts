// The confirmation link after a booking: /clinics/<slug>/booked?ref=<booking id>.<signature>.
//
// WHY a signature: the confirmation page reads the booking to show its clinic and time. If the link
// held only the booking's number, anyone could type other numbers and learn when other people booked.
// The signature is a code worked out from the number and the site's secret (PAYLOAD_SECRET). Only this
// server can make it, so a changed or made-up link does not match and the page shows nothing.
import { createHmac, timingSafeEqual } from 'node:crypto'

function signature(id: number): string {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET is not set, so booking confirmations cannot be signed.')
  // HMAC-SHA256, shortened to 32 characters: still far too many to guess.
  return createHmac('sha256', secret).update(String(id)).digest('hex').slice(0, 32)
}

/** The ref for a booking's confirmation link: "42.<signature>". */
export function bookingRef(id: number): string {
  return `${id}.${signature(id)}`
}

/** The booking id in a ref, or null when the ref is missing, malformed or its signature does not match. */
export function bookingIdFromRef(ref: unknown): number | null {
  if (typeof ref !== 'string') return null
  const match = /^([1-9]\d{0,11})\.([0-9a-f]{32})$/.exec(ref)
  if (!match) return null
  const id = Number(match[1])
  // timingSafeEqual compares in a fixed time, so the time an answer takes gives nothing away.
  return timingSafeEqual(Buffer.from(signature(id)), Buffer.from(match[2])) ? id : null
}
