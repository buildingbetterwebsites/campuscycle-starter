// Hooks that keep the links between records correct, with messages an editor can act on.
// The database enforces the same rules too (see src/lib/modelSchema.ts); these hooks run first, so an
// editor reads a helpful sentence instead of a database error code.
import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeOperationHook,
  CollectionSlug,
} from 'payload'
import { APIError } from 'payload'
import { isEditor } from '../access'
import { lockTimeSlot } from './slotLock'

/** Explain a duplicate slug. The database's unique index still catches two saves at the same moment. */
export const checkUniqueSlug: CollectionBeforeChangeHook = async ({ collection, data, originalDoc, req }) => {
  if (!data.slug) return data
  const found = await req.payload.count({
    collection: collection.slug,
    where: {
      slug: { equals: data.slug },
      // When an existing record is saved again, its own slug is not a duplicate.
      ...(originalDoc?.id ? { id: { not_equals: originalDoc.id } } : {}),
    },
    req,
    overrideAccess: true,
  })
  if (found.totalDocs > 0) {
    throw new APIError('Another record already uses this slug. Choose a different one.', 400)
  }
  return data
}

/** Explain how to remove linked records first, before the database refuses the deletion. */
export function preventDependentDeletion(collection: CollectionSlug, field: string, message: string): CollectionBeforeDeleteHook {
  return async ({ id, req }) => {
    const found = await req.payload.count({ collection, where: { [field]: { equals: id } }, req, overrideAccess: true })
    if (found.totalDocs > 0) {
      throw new APIError(message, 400)
    }
  }
}

/** Explain a link to a record that no longer exists. The database's own check also covers races. */
export function requireExistingRelation(field: string, collection: CollectionSlug, message: string): CollectionBeforeChangeHook {
  return async ({ data, req }) => {
    if (data[field] === undefined || data[field] === null) return data
    const values = Array.isArray(data[field]) ? data[field] : [data[field]]
    // A link can arrive as a plain id (3) or as the whole linked record ({ id: 3, ... }). Turn both into
    // plain ids, and drop repeats, so the count below can be compared with the number of links.
    const ids = [...new Set(values.map(value => typeof value === 'object' ? value.id : value))]
    if (ids.length) {
      const found = await req.payload.count({ collection, where: { id: { in: ids } }, req, overrideAccess: true })
      if (found.totalDocs !== ids.length) {
        throw new APIError(message, 400)
      }
    }
    return data
  }
}

/** A time slot may not get fewer places than it already has bookings. */
export const preventCapacityReduction: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  if (operation !== 'update' || data.places === undefined) return data
  // Payload runs every save inside a database transaction. Locking the slot's row first means a booking
  // being saved at this same moment has to wait for us (or we for it), so the count below is still true
  // when this change is saved. lockTimeSlot refuses to run without that transaction.
  await lockTimeSlot(req, originalDoc.id)
  const taken = await req.payload.count({
    collection: 'bookings',
    where: { timeSlot: { equals: originalDoc.id } },
    req,
    overrideAccess: true,
  })
  const booked = taken.totalDocs
  // Places are always at least 1, so this only happens with 2 or more bookings: "bookings" and
  // "places" in the message are always plural.
  if (Number(data.places) < booked) {
    throw new APIError(`This time slot already has ${booked} bookings, so it needs at least ${booked} places. Choose a higher number, or move or delete bookings first.`, 400)
  }
  return data
}

/**
 * Never delete every editor: nobody could log in to /admin any more, and a fresh first admin is only
 * created for an EMPTY database at start-up. This runs before the deletion starts, for one record and
 * for "delete all selected" alike, and refuses when no editor would be left.
 */
export const keepOneEditor: CollectionBeforeOperationHook = async ({ args, operation, overrideAccess, req }) => {
  if (operation !== 'delete') return args
  // This hook runs BEFORE Payload checks who may delete users. Someone who may not delete users at all
  // must get the usual "not allowed" answer from those access rules, not this message (which would also
  // tell a stranger how many editors there are). So only check here for an editor, or for server code
  // that switched the access rules off on purpose.
  if (!overrideAccess && !isEditor({ req })) return args
  // Deleting one record passes its id; "delete all selected" passes a filter (where) instead.
  const id = (args as { id?: number | string }).id
  const doomed = await req.payload.count({
    collection: 'users',
    where: id !== undefined ? { id: { equals: id } } : args.where,
    req,
    overrideAccess: true,
  })
  const all = await req.payload.count({ collection: 'users', req, overrideAccess: true })
  if (all.totalDocs > 0 && doomed.totalDocs >= all.totalDocs) {
    throw new APIError(
      'You cannot delete the last editor: nobody could log in to /admin any more. Create another editor first if you want to replace this one.',
      400,
    )
  }
  return args
}
