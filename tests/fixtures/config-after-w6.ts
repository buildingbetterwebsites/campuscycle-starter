// The site as it is after a learner has done warm-ups 5 and 6, for the course-check tests only: the
// app's own collections, plus clinics.whatToBring (W5), bookings.repairs and its reverse side
// repairs.bookings (W6), exactly as docs/COURSE-CHECK-CONTRACT.md tells learners to add them.
//
// The app's config (src/payload.config.ts) stays untouched, and so does the test database's public
// schema. This config lives in a schema of its own, which Payload builds from the fields ("push": the
// starter never does that for the app itself, ruling R3 allows it here) and the test drops afterwards.
// `shape: 'other'` adds the two fields in another shape (a textarea, and a link to one repair only),
// which the course check must not count. `shape: 'shipped'` is the app as the starter ships it: without
// any of the three fields, so the tests of the shipped app keep testing it after a learner's W5 and W6.
//
// A learner's copy already has the fields after W5 and W6 (in src/collections). The fixture never adds
// a second field of the same name next to the learner's own: it takes the learner's out first, then
// puts in the shape it tests (or none, for 'shipped').
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig, type CollectionConfig, type Field } from 'payload'
import sharp from 'sharp'
import { vi } from 'vitest'
import { restrictLinkedDeletion } from '@/lib/modelSchema'

export type Shape = 'agreed' | 'other' | 'shipped'

const whatToBring: Record<Exclude<Shape, 'shipped'>, Field & { name: string }> = {
  agreed: {
    name: 'whatToBring',
    type: 'array',
    fields: [{ name: 'item', type: 'text', required: true }],
  },
  other: { name: 'whatToBring', type: 'textarea' },
}

const repairs: Record<Exclude<Shape, 'shipped'>, Field & { name: string }> = {
  agreed: { name: 'repairs', type: 'relationship', relationTo: 'repairs', hasMany: true },
  other: { name: 'repairs', type: 'relationship', relationTo: 'repairs', hasMany: false },
}

/** The collection without the learner's own field of that name (W5, W6), if it has one. */
function without(collection: CollectionConfig, name: string): CollectionConfig {
  return { ...collection, fields: collection.fields.filter((candidate) => !('name' in candidate && candidate.name === name)) }
}

// The new field goes where the collection file's comment says: above Clinics' time slots list, at the
// end of Bookings' and Repairs' own fields.
function withField(collection: CollectionConfig, field: Field & { name: string }, before?: string): CollectionConfig {
  const fields = [...without(collection, field.name).fields]
  const at = before
    ? fields.findIndex((candidate) => 'name' in candidate && candidate.name === before)
    : -1
  fields.splice(at === -1 ? fields.length : at, 0, field)
  return { ...collection, fields }
}

/**
 * This config's collections, in the app's order: the course-check test checks they are the app's.
 *
 * Loaded afresh, never the objects the app's config already uses: Payload marks a collection object as
 * done once it has prepared it for a config ("sanitized"), and skips it after that. A copy of the
 * app's Clinics with one more field would keep the app's prepared fields, without the new one.
 * vi.resetModules makes the imports below load the collection files again, as new objects.
 */
export async function collections(shape: Shape): Promise<CollectionConfig[]> {
  vi.resetModules()
  const { Users } = await import('@/collections/Users')
  const { Media } = await import('@/collections/Media')
  const { Pages } = await import('@/collections/Pages')
  const { Topics } = await import('@/collections/Topics')
  const { Workshops } = await import('@/collections/Workshops')
  const { Clinics } = await import('@/collections/Clinics')
  const { TimeSlots } = await import('@/collections/TimeSlots')
  const { Bookings } = await import('@/collections/Bookings')
  const { Repairs } = await import('@/collections/Repairs')
  const { Throttle } = await import('@/collections/Throttle')
  const { Members } = await import('@/collections/Members')
  return [
    Users,
    Media,
    Pages,
    Topics,
    Workshops,
    shape === 'shipped' ? without(Clinics, 'whatToBring') : withField(Clinics, whatToBring[shape], 'timeSlots'),
    TimeSlots,
    shape === 'shipped' ? without(Bookings, 'repairs') : withField(Bookings, repairs[shape]),
    shape === 'shipped' ? without(Repairs, 'bookings') : withField(Repairs, { name: 'bookings', type: 'join', collection: 'bookings', on: 'repairs' }),
    Throttle,
    Members,
  ]
}

/** The after-W6 config (or, with 'shipped', the app as shipped) on the test database, in the schema `schemaName`. */
export async function afterW6Config(shape: Shape, schemaName: string) {
  return buildConfig({
    admin: { user: 'users' },
    collections: await collections(shape),
    editor: lexicalEditor(),
    secret: process.env.PAYLOAD_SECRET || 'test-secret-0123456789-0123456789',
    // Only errors: the schema push logs every step otherwise.
    logger: { options: { level: 'error' } },
    db: postgresAdapter({
      beforeSchemaInit: [restrictLinkedDeletion],
      pool: { connectionString: process.env.TEST_DATABASE_URL },
      schemaName,
      push: true,
    }),
    graphQL: { disable: true },
    sharp,
  })
}
