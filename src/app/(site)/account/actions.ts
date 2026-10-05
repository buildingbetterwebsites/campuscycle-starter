'use server'

// The members' area's server functions (src/lib/membersArea.ts): logging in and logging out. The
// log-in form (/account/login) and the sign-out button (/account) call them. Both refuse while the
// area is off.
//
// A log-in is a cookie: Payload's own "payload-token" cookie, the same one /admin uses. So one browser
// is logged in as one account at a time: an editor who logs in here as a member is logged out of /admin.
import { cookies, headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { AuthenticationError, createLocalReq, generatePayloadCookie, getPayload, LockedAuth, logoutOperation } from 'payload'
import { LOCKED_MESSAGE, membersAreaOn, NO_MATCH_MESSAGE, signedInMember } from '@/lib/membersArea'
import config from '@/payload.config'

// What the log-in form shows after a send that did not log in: what the user typed (never the
// password), a sentence for the top of the form, and a message per field with a problem.
export type SignInResult = {
  message: string
  errors?: { email?: string; password?: string }
  email: string
}

export async function signIn(_previous: SignInResult | null, formData: FormData): Promise<SignInResult> {
  if (!membersAreaOn()) notFound()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  const errors: SignInResult['errors'] = {}
  if (!email) errors.email = 'Enter your e-mail address.'
  if (!password) errors.password = 'Enter your password.'
  const problems = Object.keys(errors).length
  if (problems > 0) {
    const fields = problems === 1 ? 'the field marked below' : 'the 2 fields marked below'
    return { message: `You are not logged in. Fill in ${fields}.`, errors, email }
  }

  const payload = await getPayload({ config })
  let token: string | undefined
  try {
    token = (await payload.login({ collection: 'members', data: { email, password } })).token
  } catch (error) {
    if (error instanceof LockedAuth) return { message: LOCKED_MESSAGE, email }
    if (error instanceof AuthenticationError) return { message: NO_MATCH_MESSAGE, email }
    throw error
  }
  if (!token) return { message: NO_MATCH_MESSAGE, email }

  // The cookie the browser sends back with every request from now on: Payload's own, made by Payload,
  // httpOnly, so the page's JavaScript can never read it.
  const authConfig = payload.collections.members.config.auth
  const cookie = generatePayloadCookie({ collectionAuthConfig: authConfig, cookiePrefix: payload.config.cookiePrefix, token, returnCookieAsObject: true })
  ;(await cookies()).set(cookie.name, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: cookie.expires ? new Date(cookie.expires) : undefined,
  })
  redirect('/account')
}

export async function signOut(): Promise<void> {
  if (!membersAreaOn()) notFound()
  const payload = await getPayload({ config })
  const member = await signedInMember(payload, await headers())
  if (member) {
    // Ends this log-in on the server too, so the old cookie stops working even if it was copied.
    const req = await createLocalReq({ user: { ...member, collection: 'members' } }, payload)
    await logoutOperation({ collection: payload.collections.members, req })
  }
  ;(await cookies()).delete(`${payload.config.cookiePrefix}-token`)
  redirect('/account/login?signed-out')
}
