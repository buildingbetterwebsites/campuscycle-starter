// "My bookings", /account: the page of the optional members' area (src/lib/membersArea.ts) where a
// logged-in member sees the repair clinic bookings they made while logged in, and can log out. While
// the area is off it does not exist: it answers with the 404 page. Without a member's log-in it sends
// the user to /account/login.
//
// The bookings are read with the member's own access rule (editorsOrOwnBookings in src/access.ts), not
// with overrideAccess, so this page can never show another member's booking.
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { signOut } from '@/app/(site)/account/actions'
import { ButtonLink } from '@/components/site/ButtonLink'
import { Notice } from '@/components/site/Notice'
import { PageTitle } from '@/components/site/PageTitle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatSlotTime } from '@/lib/format'
import { membersAreaOn, signedInMember } from '@/lib/membersArea'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'My bookings', robots: { index: false } }

export default async function AccountPage() {
  if (!membersAreaOn()) notFound()
  const payload = await getPayload({ config })
  const member = await signedInMember(payload, await headers())
  if (!member) redirect('/account/login')

  // This member's bookings, read as this member (overrideAccess: false): only the time slot of each.
  const bookings = await payload.find({
    collection: 'bookings',
    where: { member: { equals: member.id } },
    select: { timeSlot: true },
    depth: 0,
    pagination: false,
    overrideAccess: false,
    user: { ...member, collection: 'members' },
  })
  const slotIds = bookings.docs.map((booking) => booking.timeSlot).filter((id): id is number => typeof id === 'number')
  // Each slot's time and clinic (public content), the clinic with its name and address only.
  const slots = slotIds.length === 0
    ? []
    : (await payload.find({
        collection: 'timeSlots',
        where: { id: { in: slotIds } },
        select: { startsAt: true, clinic: true },
        populate: { clinics: { name: true, slug: true } },
        depth: 1,
        joins: false,
        pagination: false,
      })).docs
  const slotById = new Map(slots.map((slot) => [slot.id, slot]))
  const now = new Date()
  // Soonest first; a booking whose slot no longer exists is left out.
  const rows = bookings.docs
    .map((booking) => ({ booking, slot: slotById.get(booking.timeSlot as number) }))
    .filter((row): row is { booking: typeof row.booking; slot: NonNullable<typeof row.slot> } => row.slot !== undefined)
    .sort((a, b) => a.slot.startsAt.localeCompare(b.slot.startsAt))

  return (
    <div className="pb-6">
      <PageTitle title="My bookings" intro={`You are logged in as ${member.name || member.email}.`} tone="blue" />
      <div className="grid max-w-3xl gap-block">
        {rows.length === 0 ? (
          <Notice label="No bookings yet">
            <p>Bookings you make while logged in show up here.</p>
            <ButtonLink href="/clinics" variant="secondary" className="mt-2 w-fit">Book a repair clinic slot</ButtonLink>
          </Notice>
        ) : (
          <ul aria-label="Your bookings" className="grid gap-4">
            {rows.map(({ booking, slot }) => {
              const clinic = typeof slot.clinic === 'object' ? slot.clinic : null
              const past = new Date(slot.startsAt) <= now
              return (
                <li key={booking.id} className="framed grid gap-2 p-5 offset-mint">
                  <p className="flex flex-wrap items-center gap-3 font-heading text-lg font-extrabold">
                    {formatSlotTime(slot.startsAt)}
                    {/* "Past" in words, not only a colour. */}
                    {past && <Badge tone="outline">Past</Badge>}
                  </p>
                  {clinic && (
                    <p className="min-w-0 [overflow-wrap:anywhere]">
                      <Link href={`/clinics/${clinic.slug}`}>{clinic.name}</Link>
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {/* Logging out is a form with a button, not a link: it changes something (ends the log-in). */}
        <form action={signOut}>
          <Button type="submit" variant="secondary">Log out</Button>
        </form>
      </div>
    </div>
  )
}
