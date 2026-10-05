// The log-in page of the optional members' area, /account/login (src/lib/membersArea.ts). While the
// area is off it does not exist: it answers with the 404 page. A member who is already logged in goes
// straight to /account.
import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { LoginForm } from '@/components/site/LoginForm'
import { Notice } from '@/components/site/Notice'
import { PageTitle } from '@/components/site/PageTitle'
import { membersAreaOn, signedInMember } from '@/lib/membersArea'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Log in', robots: { index: false } }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function LoginPage({ searchParams }: Props) {
  if (!membersAreaOn()) notFound()
  const payload = await getPayload({ config })
  if (await signedInMember(payload, await headers())) redirect('/account')
  // /account/login?signed-out: the log-out button sends the member here.
  const signedOut = 'signed-out' in (await searchParams)

  return (
    <div className="pb-6">
      <PageTitle title="Log in" intro="Log in to see the repair clinic bookings you made while logged in." tone="blue" />
      <div className="grid max-w-xl gap-block">
        {signedOut && (
          <Notice tone="success" label="Done" role="status">
            <p>You are logged out.</p>
          </Notice>
        )}
        <LoginForm />
        <p className="text-ink-soft">
          No account? You do not need one to book: <Link href="/clinics">book a repair clinic slot</Link>{' '}
          without logging in. Accounts are made by the site&apos;s editors.
        </p>
      </div>
    </div>
  )
}
