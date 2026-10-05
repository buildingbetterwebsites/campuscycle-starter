// The browser checks' test clinic, made and removed through Payload's Local API (the seed adds no
// clinic on purpose: W4 adds the first one). Playwright's global set-up runs this file before the
// checks, and its global tear-down after them:
//   node --import tsx tests/e2e/fixture.ts create   (prints one line: E2E_FIXTURE=<json>)
//   node --import tsx tests/e2e/fixture.ts remove
//   node --import tsx tests/e2e/fixture.ts break   (the clinics table is renamed: every clinic page fails)
//   node --import tsx tests/e2e/fixture.ts mend    (and back)
// It works on the database in DATABASE_URL (or STORAGE_URL): the same one the site under test uses, and only when
// databaseGuard.ts allows it (never the live database; a remote one only with E2E_ALLOW_REMOTE=1).
import { randomUUID } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import config from '../../src/payload.config'
import { bookingRef } from '../../src/tasks/book-slot/receipt'
import { e2eSiteDatabaseProblem } from './databaseGuard'

export const CLINIC_SLUG = 'e2e-check-clinic'
const DAY = 24 * 60 * 60 * 1000

export type Fixture = {
  clinic: { slug: string; name: string }
  slots: number[]
  // A confirmation page for a booking the fixture made itself, for the accessibility check.
  confirmation: string
}

// The test clinic's bookings, time slots and the clinic itself, in that order: a slot with bookings,
// or a clinic with slots, cannot be deleted first.
async function remove(payload: Payload) {
  const clinics = await payload.find({ collection: 'clinics', where: { slug: { equals: CLINIC_SLUG } }, depth: 0, limit: 10, joins: false })
  for (const clinic of clinics.docs) {
    const slots = await payload.find({ collection: 'timeSlots', where: { clinic: { equals: clinic.id } }, depth: 0, limit: 100, joins: false })
    const ids = slots.docs.map((slot) => slot.id)
    if (ids.length) {
      await payload.delete({ collection: 'bookings', where: { timeSlot: { in: ids } } })
      await payload.delete({ collection: 'timeSlots', where: { id: { in: ids } } })
    }
    await payload.delete({ collection: 'clinics', id: clinic.id })
  }
}

// The Saturday at least a week from now, at 15:00 and 15:30 in Brussels: always in the future while
// the checks run. (13:00 UTC is 15:00 in Brussels summer time, 14:00 in winter: either is fine here.)
function futureSaturday(): Date {
  const day = new Date(Date.now() + 7 * DAY)
  day.setUTCDate(day.getUTCDate() + ((6 - day.getUTCDay() + 7) % 7))
  day.setUTCHours(13, 0, 0, 0)
  return day
}

async function create(payload: Payload): Promise<Fixture> {
  // Left over from a run that stopped halfway: start clean.
  await remove(payload)
  const clinic = await payload.create({
    collection: 'clinics',
    data: {
      name: 'Test repair clinic',
      slug: CLINIC_SLUG,
      day: 'Saturday',
      startTime: '15:00',
      endTime: '17:00',
      summary: 'A test clinic for the browser checks. Bring your bicycle.',
    },
  })
  const first = futureSaturday()
  // Ten places each: every check that books, at both widths, finds a free place.
  const slots = []
  for (const startsAt of [first, new Date(first.getTime() + 30 * 60 * 1000)]) {
    slots.push(await payload.create({ collection: 'timeSlots', data: { clinic: clinic.id, startsAt: startsAt.toISOString(), places: 10 } }))
  }
  const booking = await payload.create({
    collection: 'bookings',
    data: { timeSlot: slots[1].id, name: 'Test Person', email: 'test@example.com', requestId: randomUUID() },
  })
  return {
    clinic: { slug: clinic.slug as string, name: clinic.name },
    slots: slots.map((slot) => slot.id),
    confirmation: `/clinics/${CLINIC_SLUG}/booked?ref=${bookingRef(booking.id)}`,
  }
}

// A database problem on purpose, for the check of the clinic pages' error page (error.tsx): with the
// clinics table renamed, every read of a clinic fails, as it would while the database is unreachable.
// mend puts the name back; it does nothing when the table already has its name.
async function setClinicsTable(payload: Payload, broken: boolean) {
  const db = payload.db as unknown as { drizzle: { execute: (query: unknown) => Promise<unknown> } }
  await db.drizzle.execute(
    broken
      ? sql`ALTER TABLE "clinics" RENAME TO "clinics_e2e_broken"`
      : sql`DO $$ BEGIN IF to_regclass('clinics_e2e_broken') IS NOT NULL THEN ALTER TABLE "clinics_e2e_broken" RENAME TO "clinics"; END IF; END $$`,
  )
}

const command = process.argv[2]
if (!['create', 'remove', 'break', 'mend'].includes(command)) {
  console.error('Usage: node --import tsx tests/e2e/fixture.ts create|remove|break|mend')
  process.exit(1)
}
// Never a real site's database: checked before Payload even connects (databaseGuard.ts).
const problem = await e2eSiteDatabaseProblem(process.env)
if (problem) {
  process.stderr.write(`${problem}\n`, () => process.exit(1))
  // Wait here until the line is written and the process ends: nothing below may run.
  await new Promise(() => {})
}
const payload = await getPayload({ config, disableOnInit: true })
try {
  if (command === 'create') {
    const fixture = await create(payload)
    // Ends the process once the line is really written (Payload keeps a database connection open).
    process.stdout.write(`E2E_FIXTURE=${JSON.stringify(fixture)}\n`, () => process.exit(0))
  } else if (command === 'break' || command === 'mend') {
    await setClinicsTable(payload, command === 'break')
    process.stdout.write(`E2E_FIXTURE ${command}\n`, () => process.exit(0))
  } else {
    // The clinics table back first, in case a check stopped while it was renamed.
    await setClinicsTable(payload, false)
    await remove(payload)
    process.stdout.write('E2E_FIXTURE removed\n', () => process.exit(0))
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`, () => process.exit(1))
}
