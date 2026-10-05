// The booking confirmation, /clinics/<slug>/booked?ref=<booking id>.<signature>. The booking form
// opens it after a booking was saved. It says only what really happened: it shows the clinic and the
// time of the booking named in the link, and only when the link's signature is right
// (src/tasks/book-slot/receipt.ts). A link that is missing, changed or made up never claims a booking.
//
// Never on this page: the booking's name, e-mail address or note, or anything about another booking.
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { ButtonLink } from '@/components/site/ButtonLink'
import { Notice } from '@/components/site/Notice'
import { PageTitle } from '@/components/site/PageTitle'
import { TrackStep } from '@/components/site/TrackStep'
import { BOOKING_CONFIRMATION } from '@/content/campus-cycle'
import { formatSlotTime } from '@/lib/format'
import { membersAreaOn, signedInMember } from '@/lib/membersArea'
import config from '@/payload.config'
import { bookingIdFromRef } from '@/tasks/book-slot/receipt'

export const dynamic = 'force-dynamic'

// A confirmation is for one user: search engines should not list it.
export const metadata: Metadata = { title: 'Booking confirmation', robots: { index: false } }

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function BookedPage({ params, searchParams }: Props) {
  const payload = await getPayload({ config })
  const { slug } = await params
  const clinic = (await payload.find({ collection: 'clinics', where: { slug: { equals: slug } }, depth: 0, limit: 1, joins: false })).docs[0]
  if (!clinic) notFound()

  // The booking named in the link, if its signature is right. Bookings are private, so this server
  // code reads it with overrideAccess: true, and only its time slot (select): never the name or e-mail.
  const id = bookingIdFromRef((await searchParams).ref)
  const booking = id === null
    ? null
    : await payload.findByID({ collection: 'bookings', id, depth: 0, select: { timeSlot: true, member: true }, overrideAccess: true, disableErrors: true })
  const slotId = typeof booking?.timeSlot === 'number' ? booking.timeSlot : null
  const slot = slotId === null ? null : await payload.findByID({ collection: 'timeSlots', id: slotId, depth: 0, joins: false, disableErrors: true })
  // The booking must also be for THIS clinic: a link to another clinic's booking shows nothing.
  const confirmed = slot !== null && slot.clinic === clinic.id

  if (!confirmed) {
    return (
      <div className="pb-6">
        <PageTitle title="Booking confirmation" tone="yellow" />
        <Notice tone="warning" label="Please note" className="max-w-3xl">
          <p className="font-heading text-xl font-extrabold">We can&apos;t show this booking confirmation.</p>
          <p>The link may be incomplete or out of date. The clinic&apos;s page shows its times and how many places each one has left.</p>
          <ButtonLink href={`/clinics/${clinic.slug}`} variant="secondary" className="mt-2 w-fit">Back to the clinic</ButtonLink>
        </Notice>
      </div>
    )
  }

  // The place, from the Site facts global (src/globals/SiteFacts.ts), so the user knows where to go.
  const facts = await payload.findGlobal({ slug: 'site-facts', depth: 0 })

  // The optional members' area (src/lib/membersArea.ts): say that this booking is in the account, but
  // only to the member it belongs to. While the area is off this asks for nothing at all, and the page
  // is exactly the one everyone else sees.
  const member = membersAreaOn() ? await signedInMember(payload, await headers()) : null
  const inAccount = member !== null && booking?.member === member.id

  return (
    <div className="pb-6">
      {/* The analytics step "booking_saved" (src/lib/analytics.ts): only here, where the booking is
          known to be saved. Nothing about the booking itself is sent. once: the browser tab remembers
          (sessionStorage) that this booking was counted, so a reload or Back does not count it again.
          It cannot know about other tabs or browsers: this confirmation link opened again later, or
          shared and opened by someone else, counts once more. So read booking_saved as "confirmations
          seen": close to, but not exactly, the number of bookings (that number is in /admin). */}
      <TrackStep event="booking_saved" once={String(id)} />
      <PageTitle title="Booking saved" />
      <div className="grid max-w-3xl gap-block">
        <Notice tone="success" label="Saved" role="status">
          {/* "Your booking is saved." and the made-up-data notice: src/content/campus-cycle.ts. */}
          <p className="font-semibold">{BOOKING_CONFIRMATION}</p>
          {inAccount && (
            <p>
              This booking is in your account. <Link href="/account">My bookings</Link>
            </p>
          )}
        </Notice>
        <section aria-labelledby="booking" className="framed grid gap-4 p-6 offset-mint">
          <h2 id="booking" className="text-xl">Your booking</h2>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
            <dt className="text-ink-soft">Clinic</dt>
            <dd className="min-w-0 font-semibold [overflow-wrap:anywhere]">{clinic.name}</dd>
            <dt className="text-ink-soft">Time</dt>
            <dd className="font-semibold">{formatSlotTime(slot.startsAt)}</dd>
            {facts.place && (
              <>
                <dt className="text-ink-soft">Place</dt>
                <dd className="min-w-0 font-semibold [overflow-wrap:anywhere]">{facts.place}</dd>
              </>
            )}
          </dl>
        </section>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/clinics/${clinic.slug}`} variant="secondary">Back to the clinic</ButtonLink>
          <ButtonLink href="/" variant="quiet">Home</ButtonLink>
        </div>
      </div>
    </div>
  )
}
