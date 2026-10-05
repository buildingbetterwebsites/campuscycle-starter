import type { Payload } from 'payload'
import { PlainError } from './plainError'

/**
 * A fresh Payload site lets whoever opens /admin first create the admin account - anyone who gets
 * there first, forever. This closes that door: on start, if no user exists yet, it creates one from
 * FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD, which the set-up guide asks you to add - in your own
 * .env.local for local work, or in Vercel (Settings → Environment Variables) BEFORE the first deploy.
 *
 * It fails CLOSED: with no user and no such variables, the site refuses to start rather than leave the
 * "create the first user" screen open to anyone.
 */
export async function createFirstAdmin(payload: Payload): Promise<void> {
  let existing: number
  try {
    existing = (await payload.count({ collection: 'users', overrideAccess: true })).totalDocs
  } catch (error) {
    // Only "the table does not exist yet" (Postgres 42P01: the migrations have not run, for example
    // during `payload migrate:create`) is expected here. Anything else, such as a time-out, stops the
    // start - it is not this function's job to guess whether a different failure is safe to ignore.
    if (isMissingTable(error)) return
    throw error
  }
  if (existing > 0) return

  const email = process.env.FIRST_ADMIN_EMAIL
  const password = process.env.FIRST_ADMIN_PASSWORD
  if (!email || !password) {
    throw new PlainError(
      'No admin user exists and FIRST_ADMIN_EMAIL / FIRST_ADMIN_PASSWORD are not set. ' +
        'Add both - in your own .env.local for local work, or in Vercel (Settings → Environment Variables) ' +
        'before the first deploy - then try again.',
    )
  }

  try {
    await payload.create({ collection: 'users', data: { email, password }, overrideAccess: true })
    payload.logger.info(`First admin created: ${email}`)
  } catch (error) {
    // Two instances starting at the same moment: both saw zero users, both tried to create the same
    // one, and the database's own unique-email constraint let only one succeed. That is fine, not a
    // failure, as long as a user now exists - so only re-throw if one somehow still does not.
    const now = (await payload.count({ collection: 'users', overrideAccess: true })).totalDocs
    if (now === 0) throw error
  }
}

// A generous depth, not a realistic one: real error chains here are one or two levels deep (the
// driver's error, wrapped once by Payload/Drizzle). The limit exists only so a pathological or
// circular `.cause` (`e.cause === e`) cannot hang this in an infinite loop.
const MAX_CAUSE_DEPTH = 10

function isMissingTable(error: unknown): boolean {
  let e: unknown = error
  for (let depth = 0; e && typeof e === 'object' && depth < MAX_CAUSE_DEPTH; depth += 1, e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === '42P01') return true
  }
  return false
}
