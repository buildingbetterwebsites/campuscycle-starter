// The optional members' area: users with an account can log in at /account/login and see their own
// bookings at /account. It is an optional feature, for test data only, and it is OFF unless the
// setting MEMBERS_AREA is exactly "on" (in Vercel: Settings, Environment Variables; then redeploy).
//
// While it is off, nothing of it shows: no "My bookings" link, no account pages, no members in /admin,
// and every request to the members collection is refused (src/collections/Members.ts).
import type { Payload } from 'payload'
import type { Member } from '@/payload-types'

/**
 * Is the members' area switched on? The setting is read at every call, not once when the site starts,
 * so a test can switch it on and off.
 */
export function membersAreaOn(): boolean {
  return process.env.MEMBERS_AREA === 'on'
}

// The log-in form's answer to a wrong e-mail address and to a wrong password: the same words for both,
// so nobody can find out which e-mail addresses have an account.
export const NO_MATCH_MESSAGE = "That e-mail and password don't match."
// Payload locks an account for 10 minutes after 5 wrong passwords in a row.
export const LOCKED_MESSAGE = 'Too many wrong passwords. Wait ten minutes, then try again.'

/**
 * The member who sent this request, from the log-in cookie; null when the area is off, nobody is
 * logged in, or the person logged in is an editor (editors are not members).
 */
export async function signedInMember(payload: Payload, headers: Headers): Promise<Member | null> {
  if (!membersAreaOn()) return null
  const { user } = await payload.auth({ headers })
  return user?.collection === 'members' ? user : null
}
