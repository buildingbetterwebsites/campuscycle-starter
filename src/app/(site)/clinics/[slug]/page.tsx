// One clinic's page, /clinics/<slug>: example task 2, "book a clinic slot". It shows the clinic, its
// prices, and the booking form with the time slots that have not started yet and their places left.
// The checks and the save are in src/tasks/book-slot/ (see its README.md).
//
// Bookings are private: this page reads only HOW MANY bookings each slot has, never a name or an
// e-mail address.
import { randomUUID } from 'node:crypto'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { cache } from 'react'
import { BookingForm } from '@/components/site/BookingForm'
import { ButtonLink } from '@/components/site/ButtonLink'
import { Notice } from '@/components/site/Notice'
import { PageTitle } from '@/components/site/PageTitle'
import { ParentLink } from '@/components/site/ParentLink'
import { formatPrice, formatSlotTime, formatWhen, imageFrom } from '@/lib/format'
import { membersAreaOn, signedInMember } from '@/lib/membersArea'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

// The clinic's picture, from the media library (the seed uploads it). To use another one, upload it
// in /admin and put its file name here.
const CLINIC_IMAGE = 'clinic-tools'

type Props = { params: Promise<{ slug: string }> }

// cache(): the page and its browser-tab title ask for the same record once per visit.
const findClinic = cache(async (slug: string) => {
  const payload = await getPayload({ config })
  const found = await payload.find({ collection: 'clinics', where: { slug: { equals: slug } }, depth: 0, limit: 1, joins: false })
  return found.docs[0]
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const clinic = await findClinic((await params).slug)
  if (!clinic) return {}
  return { title: clinic.name, description: clinic.summary }
}

export default async function ClinicPage({ params }: Props) {
  const clinic = await findClinic((await params).slug)
  // No clinic with this slug: the "not found" page, which explains and offers a way on.
  if (!clinic) notFound()
  const payload = await getPayload({ config })

  // The clinic's time slots that have not started yet, earliest first. At most the next 100: the
  // later ones appear here as the earlier ones pass.
  const upcoming = await payload.find({
    collection: 'timeSlots',
    where: { clinic: { equals: clinic.id }, startsAt: { greater_than: new Date().toISOString() } },
    sort: 'startsAt',
    depth: 0,
    limit: 100,
    joins: false,
  })
  // The bookings of those slots, in one question to the database. Bookings are private, so this
  // server code reads them with overrideAccess: true, and `select` fetches only which slot each one is
  // for: never a name or an e-mail address. (No slots: nothing to ask.)
  const booked = upcoming.docs.length === 0 ? { docs: [] } : await payload.find({
    collection: 'bookings',
    where: { timeSlot: { in: upcoming.docs.map((slot) => slot.id) } },
    select: { timeSlot: true },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  // How many bookings each slot has: slot id -> number of bookings.
  const taken = new Map<number, number>()
  for (const booking of booked.docs) {
    const slotId = booking.timeSlot as number
    taken.set(slotId, (taken.get(slotId) ?? 0) + 1)
  }
  // For each slot: its time in words and how many places are left.
  const slots = upcoming.docs.map((slot) => ({
    id: slot.id,
    label: formatSlotTime(slot.startsAt),
    placesLeft: Math.max(0, slot.places - (taken.get(slot.id) ?? 0)),
  }))
  const allFull = slots.length > 0 && slots.every((slot) => slot.placesLeft === 0)

  // The price list: every repair record, in the order editors added them.
  const repairs = (await payload.find({ collection: 'repairs', sort: 'createdAt', depth: 0, limit: 50 })).docs
  const picture = (await payload.find({ collection: 'media', where: { filename: { contains: CLINIC_IMAGE } }, limit: 1 })).docs[0]
  // The place, from the Site facts global (src/globals/SiteFacts.ts).
  const facts = await payload.findGlobal({ slug: 'site-facts', depth: 0 })

  // The optional members' area (src/lib/membersArea.ts): who is logged in, so the form can say that
  // this booking will be saved to their account and fill in their name and e-mail address. While the
  // area is off this asks for nothing at all - not the request's headers, and not the members
  // collection - and the form below is exactly the one everyone else sees.
  const member = membersAreaOn() ? await signedInMember(payload, await headers()) : null

  return (
    <article className="pb-6">
      <ParentLink href="/clinics" label="Repair clinic" current={clinic.name} />
      <PageTitle
        title={clinic.name}
        intro="Choose a time, book it here, and bring your bicycle for a check or a repair."
        image={imageFrom(picture)}
        className="mt-3 sm:mt-4"
      />

      <div className="grid gap-block lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {/* First in the page (a phone shows it first), on the right on wide screens. */}
        <section aria-labelledby="facts" className="framed grid gap-4 p-6 offset-coral lg:col-start-2 lg:row-start-1">
          <h2 id="facts" className="text-xl">At a glance</h2>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
            <dt className="text-ink-soft">When</dt>
            <dd className="font-semibold">{formatWhen(clinic)}</dd>
            {facts.place && (
              <>
                <dt className="text-ink-soft">Place</dt>
                <dd className="min-w-0 font-semibold [overflow-wrap:anywhere]">{facts.place}</dd>
              </>
            )}
          </dl>
        </section>

        <div className="grid content-start gap-block lg:col-start-1 lg:row-start-1">
          <section aria-labelledby="about" className="grid gap-3">
            <h2 id="about" className="text-2xl">About the clinic</h2>
            <p className="max-w-(--container-reading)">{clinic.summary}</p>
            {/* W5: show the clinic's "What to bring" list here, the same way this page shows its prices below. */}
          </section>

          {repairs.length > 0 && (
            <section aria-labelledby="prices" className="grid gap-3">
              <h2 id="prices" className="text-2xl">Prices</h2>
              {/* Each repair's name and price come from its own record, so a price changed in /admin is
                  right here at once. A description shows only when the record has one. */}
              <ul className="grid max-w-(--container-reading) divide-y divide-line border-y border-line">
                {repairs.map((repair) => (
                  <li key={repair.id} className="flex items-baseline justify-between gap-4 py-3">
                    <span className="grid">
                      <span className="font-semibold">{repair.name}</span>
                      {repair.description && <span className="text-ink-soft">{repair.description}</span>}
                    </span>
                    <span className="font-semibold whitespace-nowrap">{formatPrice(repair.price)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="book" className="framed grid gap-5 p-5 offset-coral sm:p-8">
            <h2 id="book" className="text-2xl">Book a time slot</h2>
            {slots.length === 0 ? (
              <Notice tone="warning" label="No times yet">
                <p>There are no upcoming time slots yet. Check back soon.</p>
              </Notice>
            ) : allFull ? (
              <Notice tone="warning" label="Fully booked">
                <p className="font-semibold">Every time slot is full.</p>
                <p>Check this page again later, or learn to do a repair yourself in a workshop.</p>
                <ButtonLink href="/workshops" variant="secondary" className="mt-2 w-fit">Find a workshop</ButtonLink>
              </Notice>
            ) : (
              // The time slots are shown inside the form, by SlotPicker (src/components/site/SlotPicker.tsx).
              // requestId: a new random code for each form, so the same form sent twice saves one booking.
              // repairs: only what the form needs (W6's repair choice) goes to the browser.
              <BookingForm
                clinic={clinic.slug}
                slots={slots}
                requestId={randomUUID()}
                repairs={repairs.map(({ id, name, price }) => ({ id, name, price }))}
                member={member && { name: member.name ?? '', email: member.email }}
              />
            )}
          </section>
        </div>
      </div>
    </article>
  )
}
