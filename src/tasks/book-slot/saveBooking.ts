'use server'

// The booking form's server function: what runs on the server when a user presses "Book this slot".
// 'use server' at the top lets the form (BookingForm.tsx, which runs in the browser) call it. Every
// function this file exports can be called that way, so it exports only this one.
//
// It does three things: it finds the device's address (for the rate limit) and, with the optional
// members' area on, the member who is logged in; it lets createBooking.ts check and save the booking;
// and then it either opens the confirmation page or hands the problem back to the form.
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { signedInMember } from '@/lib/membersArea'
import config from '@/payload.config'
import { FULL_MESSAGE } from './capacity'
import { createBooking, SLOT_GONE_MESSAGE, STARTED_MESSAGE, type BookingResult } from './createBooking'
import { clientKey } from './guards'
import { bookingRef } from './receipt'

export async function saveBooking(_previous: BookingResult | null, formData: FormData): Promise<BookingResult> {
  const payload = await getPayload({ config })
  const requestHeaders = await headers()
  // The logged-in member (members' area only), from the log-in cookie: never from the form.
  const member = (await signedInMember(payload, requestHeaders))?.id
  const result = await createBooking(formData, { payload, ip: clientKey(requestHeaders), now: new Date(), member })
  const clinic = String(formData.get('clinic') ?? '')
  if (!result.ok) {
    // The chosen slot filled up (someone else just took the last place), was deleted, or has started
    // since the page was shown: read the clinic page again, so the form comes back with every slot as
    // it is now ("Full", or gone from the list). Only for a clinic that exists: the slug comes from the
    // form, and anyone can change what a form sends.
    const slotChanged =
      result.message === FULL_MESSAGE || result.message === SLOT_GONE_MESSAGE || result.errors?.timeSlot === STARTED_MESSAGE
    if (slotChanged && (await payload.count({ collection: 'clinics', where: { slug: { equals: clinic } } })).totalDocs > 0) {
      revalidatePath(`/clinics/${encodeURIComponent(clinic)}`)
    }
    return result
  }

  // Saved. The confirmation page's address carries the booking's number with a signature
  // (receipt.ts), so the page can show this booking, and only this one.
  redirect(`/clinics/${encodeURIComponent(clinic)}/booked?ref=${bookingRef(result.bookingId)}`)
}
