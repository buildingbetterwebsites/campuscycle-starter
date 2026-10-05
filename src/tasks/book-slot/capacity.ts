// The places rule: a booking is refused when its time slot has no place left. It runs every time a
// booking is saved, whoever saves it: the booking form on the website, or an editor in /admin who
// moves a booking to another time slot. Which collections it looks at is set in places.ts.
import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'
import { lockTimeSlot } from '../../lib/slotLock'
import { PLACES } from './places'

// The booking form shows this message as it is, next to the time slots.
export const FULL_MESSAGE = 'This slot is full. Choose another time.'

/**
 * Stops a booking when its slot is full, on a new booking and on a change to an existing one.
 *
 * WHY the lock: two people can press "Book this slot" for the last place at the same moment. Both
 * would count one free place and both would be saved. The lock makes the second save wait until the
 * first one has finished; then it counts again, sees the slot is full, and is refused.
 */
export const checkPlaces: CollectionBeforeChangeHook = async ({ collection, data, operation, originalDoc, req }) => {
  // The slot this booking will be in after the save: the new one when an editor moves it, otherwise
  // the one it already has.
  const link = data[PLACES.bookingField] ?? originalDoc?.[PLACES.bookingField]
  // A link can arrive as a plain id (3) or as the whole linked record ({ id: 3, ... }).
  const slotId = typeof link === 'object' && link !== null ? link.id : link
  if (slotId === undefined || slotId === null) return data

  // Payload saves every booking inside a database transaction. Locking the slot's row now makes any
  // other save for this same slot wait here until this one is finished (see src/lib/slotLock.ts).
  await lockTimeSlot(req, slotId, PLACES.slotCollection)

  const slot = await req.payload.findByID({
    collection: PLACES.slotCollection,
    id: slotId,
    depth: 0,
    req,
    overrideAccess: true,
    disableErrors: true,
  })
  // No such slot: the bookings collection's own check (requireExistingRelation) already explains that.
  if (!slot) return data

  // The OTHER bookings in that slot. When an editor changes a booking without moving it, the booking
  // is already in the slot, so it must not be counted a second time.
  const others = await req.payload.count({
    collection: collection.slug,
    where: {
      [PLACES.bookingField]: { equals: slotId },
      ...(operation === 'update' && originalDoc?.id ? { id: { not_equals: originalDoc.id } } : {}),
    },
    req,
    overrideAccess: true,
  })
  const stored = Number((slot as unknown as Record<string, unknown>)[PLACES.placesField])
  // A missing or broken number (for example a misspelt placesField in places.ts) counts as 0 places:
  // the slot is closed, never open without a limit.
  const places = Number.isFinite(stored) ? stored : 0
  if (others.totalDocs >= places) {
    throw new APIError(FULL_MESSAGE, 400)
  }
  return data
}
