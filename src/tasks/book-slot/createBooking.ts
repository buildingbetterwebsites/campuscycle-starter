// Saving one booking from the clinic page's form: every check, then the save, then an answer the form
// can show. saveBooking.ts calls this and, when the booking is saved, opens the confirmation page.
//
// The checks, in this order:
//   1. the trap field (guards.ts): a program filled it in, so nothing is saved;
//   2. the fields themselves: a name, an e-mail address, an optional note, and a time slot of THIS
//      clinic that has not started yet;
//   3. the same form sent twice (a double click, or a retry after a lost answer) saves one booking;
//   4. the rate limit (guards.ts): at most 5 bookings an hour from one device. Only a send that got
//      this far counts, so typing mistakes never use it up;
//   5. the save, during which the places rule (capacity.ts) refuses a full slot.
import { APIError, ValidationError, type Payload } from 'payload'
import type { Booking } from '@/payload-types'
import { membersAreaOn } from '@/lib/membersArea'
import { SLOT_GONE_MESSAGE } from '@/collections/Bookings'
import { FULL_MESSAGE } from './capacity'
import { allowRequest, BOOKING_LIMIT, isTrapFilled } from './guards'

// The fields a user fills in, as text. On any failure they go back to the form, so nothing is lost.
// repairs: the ids of the repairs the user ticked (W6's repair choice); empty until W6.
export type BookingValues = { timeSlot: string; name: string; email: string; note: string; repairs?: string[] }
export type BookingField = Exclude<keyof BookingValues, 'repairs'>

export type BookingResult =
  | { ok: true; bookingId: number }
  | {
      ok: false
      // One sentence for the top of the form.
      message: string
      // The first field with a problem (the form links to it), and the problem of each field.
      field?: BookingField
      errors?: Partial<Record<BookingField, string>>
      values: BookingValues
      // Only set by the form itself (BookingForm.tsx) when the server could not be reached: the
      // booking may or may not have been saved.
      lost?: true
    }

// What createBooking needs from outside: the database (Payload), the device's address for the rate
// limit, and the current time (a test can pretend another one). member: the id of the member who is
// logged in, only with the optional members' area on (saveBooking.ts reads it from the log-in cookie).
export type BookingContext = { payload: Payload; ip: string; now: Date; member?: number }

export const NOT_SAVED_MESSAGE = 'Your booking was not saved. Please try again.'
export const TOO_MANY_MESSAGE = 'Too many bookings from this device. Try again in an hour.'
export const SERVER_PROBLEM_MESSAGE = 'Your booking was not saved because of a problem on our side. Please try again in a minute.'
export const FORM_USED_MESSAGE = 'This form already saved a booking. Reload the page to make another booking.'
// The bookings collection's own check says this when a slot is deleted while someone is booking it
// (src/collections/Bookings.ts keeps the text).
export { SLOT_GONE_MESSAGE }
// The chosen time started while the user was filling in the form.
export const STARTED_MESSAGE = 'This time has already started. Choose a later time.'

// A field's text from the form, without spaces at either end ('' when it is missing).
function read(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * What the user filled in, to give back to the form when the booking was not saved, so nothing is
 * lost. Only these fields are read; anything else the form carries (member=1, a made-up id, ...) is
 * ignored.
 *
 * repairs only hands the ticked repairs back to the form, so they stay ticked; nothing here is saved.
 * Before W6 the form has no repair choice, so it is always empty. What is SAVED is only what
 * payload.create below lists, which is still the whitelist.
 */
function readValues(formData: FormData): BookingValues {
  return {
    timeSlot: read(formData, 'timeSlot'),
    name: read(formData, 'name'),
    email: read(formData, 'email'),
    note: read(formData, 'note'),
    repairs: formData.getAll('repairs').map(String).filter((id) => /^\d+$/.test(id)),
  }
}

// The form's hidden requestId: a random code the clinic page made for this one form. Anything that does
// not look like one is ignored (the booking is then saved without it).
function readRequestId(formData: FormData): string | undefined {
  const value = read(formData, 'requestId')
  return /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : undefined
}

// The same e-mail check as Payload's own `email` field (node_modules/payload/dist/fields/validations.js,
// Payload 3.90.2), so an address this form accepts is never refused by the database afterwards. It
// allows name@example.com and first.last+tag@sub.example.be; it refuses spaces, two dots in a row
// (a..b@x.be, x@y..com), a one-letter ending (a@b.c) and letters such as ä in the domain.
const EMAIL =
  /^(?!.*\.\.)[\w!#$%&'*+/=?^`{|}~-](?:[\w!#$%&'*+/=?^`{|}~.-]*[\w!#$%&'*+/=?^`{|}~-])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i
const EMAIL_MESSAGE = 'Enter your e-mail address in the right form, like name@example.com.'

/** Checks the fields; returns a message for each field with a problem (none: all is well). */
async function check(values: BookingValues, clinicSlug: string, { payload, now }: BookingContext) {
  const errors: Partial<Record<BookingField, string>> = {}

  // The time slot comes first, as it does in the form.
  const slotId = Number(values.timeSlot)
  if (!values.timeSlot) {
    errors.timeSlot = 'Choose a time.'
  } else {
    const clinic = (await payload.find({ collection: 'clinics', where: { slug: { equals: clinicSlug } }, depth: 0, limit: 1, joins: false })).docs[0]
    const slot = Number.isInteger(slotId) && slotId > 0
      ? await payload.findByID({ collection: 'timeSlots', id: slotId, depth: 0, joins: false, disableErrors: true })
      : null
    // depth: 0 gives the slot's clinic as a plain id.
    if (!clinic || !slot || slot.clinic !== clinic.id) {
      errors.timeSlot = 'Choose one of the times on this page.'
    } else if (new Date(slot.startsAt) <= now) {
      errors.timeSlot = STARTED_MESSAGE
    }
  }

  if (!values.name) errors.name = 'Enter your name.'
  else if (values.name.length > 100) errors.name = 'Your name can be at most 100 characters long.'

  if (!values.email) errors.email = 'Enter your e-mail address.'
  else if (values.email.length > 254 || !EMAIL.test(values.email)) {
    errors.email = EMAIL_MESSAGE
  }

  if (values.note.length > 500) errors.note = 'The note can be at most 500 characters long.'

  return errors
}

// The answer for fields with problems: one sentence for the top of the form, and each field's message.
function fieldProblems(errors: Partial<Record<BookingField, string>>, values: BookingValues): BookingResult {
  const fields = Object.keys(errors) as BookingField[]
  const message = fields.length === 1
    ? 'Your booking was not saved. Check the field marked below.'
    : `Your booking was not saved. Check the ${fields.length} fields marked below.`
  return { ok: false, message, field: fields[0], errors, values }
}

// The booking this same form already saved, if any. Read with overrideAccess: true, because bookings
// are private: only this server code looks, and it never shows the booking's name or e-mail address.
async function savedEarlier(payload: Payload, requestId: string | undefined): Promise<Booking | undefined> {
  if (!requestId) return undefined
  const found = await payload.find({ collection: 'bookings', where: { requestId: { equals: requestId } }, depth: 0, limit: 1, overrideAccess: true })
  return found.docs[0]
}

// The answer for a form that was already saved: the same booking again, when it really is the same
// booking. A form re-used for another time or another e-mail address (for example after Back) is not.
function sameBooking(earlier: Booking, values: BookingValues): BookingResult {
  if (earlier.timeSlot === Number(values.timeSlot) && earlier.email === values.email) {
    return { ok: true, bookingId: earlier.id }
  }
  return { ok: false, message: FORM_USED_MESSAGE, values }
}

/** Checks and saves one booking from the clinic page's form. Never throws: every outcome is an answer. */
export async function createBooking(formData: FormData, context: BookingContext): Promise<BookingResult> {
  try {
    return await checkAndSave(formData, context)
  } catch (error) {
    // A problem on the server's side (for example the database cannot be reached). The details go to
    // the server's log, for whoever runs the site; the user reads that it went wrong and what to do,
    // and gets the form back with everything they typed.
    context.payload.logger.error({ err: error }, 'A booking could not be saved')
    return { ok: false, message: SERVER_PROBLEM_MESSAGE, values: readValues(formData) }
  }
}

async function checkAndSave(formData: FormData, context: BookingContext): Promise<BookingResult> {
  const { payload, ip } = context

  // Only these fields are read from the form (readValues, above), and only the ones in payload.create
  // below are saved, so nobody can set a field the form does not offer.
  const values = readValues(formData)
  const requestId = readRequestId(formData)
  // Which clinic's page the form is on, to check the time slot belongs to that clinic. Not saved.
  const clinicSlug = read(formData, 'clinic')

  // W6: switch on the repair choice. Remove the // in front of the next line, and of `repairs,` in
  // payload.create below. It keeps only whole numbers, the ids of the repairs the user ticked.
  // const repairs = formData.getAll('repairs').map(Number).filter(Number.isInteger)

  // 1. The trap field. The message says only that the booking was not saved: a program that filled
  // the trap learns nothing about why.
  if (isTrapFilled(formData)) return { ok: false, message: NOT_SAVED_MESSAGE, values }

  // 2. The fields. These checks read the database (the clinic and the slot) BEFORE the rate limit
  // below. That is the price of counting only sends that pass the checks, so typing mistakes never
  // use up the limit: a flood of invalid sends still costs these reads. The trap field (above) and
  // the hosting platform's own limits cover that.
  const errors = await check(values, clinicSlug, context)
  if (Object.keys(errors).length > 0) return fieldProblems(errors, values)

  // 3. This same form was saved before (the user sent it again after a lost answer): the same booking.
  // Before the rate limit, so sending it again never uses up the limit.
  const earlier = await savedEarlier(payload, requestId)
  if (earlier) return sameBooking(earlier, values)

  // 4. The rate limit. allowRequest counts first and then remembers this send, in two steps, so a few
  // sends at the very same moment can slip past the limit together. That is fine for a spam guard;
  // the places rule (below), which must be exact, uses a lock.
  if (!(await allowRequest(ip, BOOKING_LIMIT.requests, BOOKING_LIMIT.minutes, { payload, now: context.now }))) {
    return { ok: false, message: TOO_MANY_MESSAGE, values }
  }

  // 5. The save. overrideAccess: true, because nobody may create bookings through the API (see
  // src/collections/Bookings.ts): only this code, after the checks above. The places rule
  // (capacity.ts) still runs during the save.
  try {
    const booking = await payload.create({
      collection: 'bookings',
      data: {
        timeSlot: Number(values.timeSlot),
        name: values.name,
        email: values.email,
        note: values.note || undefined,
        requestId,
        // The logged-in member, never anything the form sends: only with the members' area on.
        member: membersAreaOn() ? context.member : undefined,
        // repairs,
      },
      overrideAccess: true,
    })
    return { ok: true, bookingId: booking.id }
  } catch (error) {
    // The same form, sent twice at the very same moment, may have been saved by the other copy: that
    // copy's booking is this user's booking. (The database refuses a second booking with the same
    // requestId, and the places rule may have found the slot full because of that first copy.)
    const other = await savedEarlier(payload, requestId)
    if (other) return sameBooking(other, values)

    // The slot was full (or deleted) by the time of the save. timeSlot: '' so that no time stays
    // chosen; saveBooking.ts refreshes the page, so the slot then shows as Full.
    if (error instanceof APIError && (error.message === FULL_MESSAGE || error.message === SLOT_GONE_MESSAGE)) {
      return { ok: false, message: error.message, field: 'timeSlot', errors: { timeSlot: error.message }, values: { ...values, timeSlot: '' } }
    }
    // The database's own e-mail check refused the address (the check above should already have).
    if (error instanceof ValidationError && error.data.errors.some((problem) => problem.path === 'email')) {
      return fieldProblems({ email: EMAIL_MESSAGE }, values)
    }
    // Anything else: createBooking above answers with "a problem on our side".
    throw error
  }
}
