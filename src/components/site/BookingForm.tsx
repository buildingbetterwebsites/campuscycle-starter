'use client'

// What this is: the clinic's booking form: choose a time, give a name and an e-mail address, add a
// note if you like, and press "Book this slot". It runs in the browser ('use client'), so it can show
// "Saving your booking…" while the server works and point at the problems when a booking was not
// saved. The checks and the save happen on the server: src/tasks/book-slot/ (see its README.md).
//
// What happens when the user presses the button:
//   - the button says "Saving your booking…" and cannot be pressed again until the answer is back;
//   - saved: the server opens the confirmation page;
//   - not saved: the form comes back with everything the user typed, a box at the top that says what
//     went wrong (the keyboard focus moves to it), and a message under each field with a problem;
//   - no answer at all (the connection dropped): the form stays as it was and says it cannot tell
//     whether the booking was saved. Sending it again is safe: it is never booked twice.
//
// The box that says what went wrong is BookingProblem.tsx, the button BookingSubmitButton.tsx.
//
// What to change for your own site: the labels and the words. Keep the hidden fields and the notice.
import { unstable_rethrow } from 'next/navigation'
import { createContext, use, useActionState, useEffect, useRef } from 'react'
import { BookingProblem } from '@/components/site/BookingProblem'
import { BookingSubmitButton } from '@/components/site/BookingSubmitButton'
import { FieldError } from '@/components/site/FieldError'
import { Notice } from '@/components/site/Notice'
import { SlotPicker, type SlotChoice } from '@/components/site/SlotPicker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MADE_UP_DATA_NOTICE } from '@/content/campus-cycle'
import type { Repair } from '@/payload-types'
import type { BookingField, BookingResult, BookingValues } from '@/tasks/book-slot/createBooking'
import { saveBooking } from '@/tasks/book-slot/saveBooking'
import { typedValues } from '@/tasks/book-slot/typedValues'

type BookingFormProps = {
  // The clinic's slug: the server checks that the chosen time belongs to this clinic.
  clinic: string
  slots: SlotChoice[]
  // A random code the clinic page makes for this one form (see requestId in src/collections/Bookings.ts).
  requestId: string
  // The clinic's repairs, the same records as the price list above the form. Used by W6 (below).
  repairs: Pick<Repair, 'id' | 'name' | 'price'>[]
  // The member who is logged in, with the optional members' area on (src/lib/membersArea.ts): their
  // name ('' when their account has none) and their e-mail address, and nothing else. null when the
  // area is off or nobody is logged in, and then the form is the ordinary one.
  member?: { name: string; email: string } | null
}

const EMPTY: BookingValues = { timeSlot: '', name: '', email: '', note: '' }

// What the user sent last time, for every part inside the form. The fields below get it directly; a
// part in its own function, such as W6's repair choice, reads it with useSentValues(), so it can show
// what the user had chosen when the form comes back.
export const SentValues = createContext<BookingValues>(EMPTY)
export function useSentValues(): BookingValues {
  return use(SentValues)
}

/**
 * Sends the form to the server (saveBooking). When the server cannot be reached at all (the
 * connection dropped, or the answer got lost), the call fails: instead of an error page, the form
 * then gets a "lost" answer and keeps everything the user typed, and the same requestId. If the
 * booking was in fact saved, sending it again returns that same booking (createBooking.ts, step 3).
 */
async function sendBooking(previous: BookingResult | null, formData: FormData): Promise<BookingResult> {
  try {
    return await saveBooking(previous, formData)
  } catch (error) {
    // Opening the confirmation page after a save also arrives here, as a special "redirect" error.
    // unstable_rethrow passes those on to Next.js, so the confirmation page still opens.
    unstable_rethrow(error)
    // For the developer: the browser's console says why the request was lost.
    console.error('The booking request got no answer:', error)
    return { ok: false, lost: true, message: 'The server could not be reached.', values: typedValues(formData) }
  }
}

// W6: the repair choice, ready to switch on. Remove the // in front of every line of this function.
// Then replace the whole line {/* W6: <RepairChoice repairs={props.repairs} /> */} in the form below
// with <RepairChoice repairs={props.repairs} />. The server side is the two lines the W6 comment in
// createBooking.ts names (src/tasks/book-slot/createBooking.ts).
// function RepairChoice({ repairs }: { repairs: BookingFormProps['repairs'] }) {
//   // The repairs ticked in the last send, so they stay ticked when the form comes back.
//   const sent = useSentValues()
//   return (
//     <fieldset className="grid gap-3">
//       <legend className="mb-1 font-semibold">
//         Repairs <span className="font-normal text-ink-soft">(optional)</span>
//       </legend>
//       {repairs.map((repair) => {
//         const label = repair.name // To show the price in the choice too, add the record's price here (formatPrice(repair.price)): it reads the stored price, nothing is copied. Also import formatPrice from '@/lib/format', as the clinic page does.
//         return (
//           <label key={repair.id} className="flex min-h-11 items-center gap-3">
//             <input type="checkbox" name="repairs" value={repair.id} defaultChecked={sent.repairs?.includes(String(repair.id))} className="size-5 accent-ink" />
//             {label}
//           </label>
//         )
//       })}
//     </fieldset>
//   )
// }

export function BookingForm(props: BookingFormProps) {
  const { clinic, slots, requestId, member } = props
  // state: null at first, then the answer of the last send (only failures come back: a saved booking
  // opens the confirmation page instead).
  const [state, formAction] = useActionState(sendBooking, null)
  const failed = state && !state.ok ? state : null
  // A member who is logged in starts with their own name and e-mail address filled in, and can still
  // change them; without a name on their account the name field stays empty (never the e-mail address).
  // After a send that did not save, what they really typed comes back instead.
  const values = failed?.values ?? (member ? { ...EMPTY, name: member.name, email: member.email } : EMPTY)
  const errors: Partial<Record<BookingField, string>> = failed?.errors ?? {}

  // After a failed send, move the keyboard focus to the box at the top: a screen reader reads it out,
  // and the next Tab reaches the first link in it.
  const summary = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (failed) summary.current?.focus()
  }, [failed])

  // aria-invalid and aria-describedby link a field to its error message (FieldError), so a screen
  // reader reads the message with the field's label.
  const problem = (field: BookingField) =>
    errors[field] ? { 'aria-invalid': true, 'aria-describedby': `${field}-error` } : {}

  return (
    // noValidate: the server checks every field and explains each problem in words, the same way in
    // every browser, instead of the browser's own small pop-ups.
    <form action={formAction} noValidate className="grid gap-6">
      {/* Everything inside can read what the user sent last time (useSentValues). */}
      <SentValues value={values}>
        {failed && (
          <div ref={summary} tabIndex={-1} className="rounded-frame">
            <BookingProblem result={failed} />
          </div>
        )}

        {member && (
          <Notice label="Logged in">
            <p>{`You are logged in as ${member.name || member.email}. This booking will be saved to your account.`}</p>
          </Notice>
        )}

        {/* Not shown: which clinic this is, and the form's random code. */}
        <input type="hidden" name="clinic" value={clinic} />
        <input type="hidden" name="requestId" value={requestId} />

        <SlotPicker slots={slots} selected={values.timeSlot} error={errors.timeSlot} />

        <div className="grid gap-2">
          <Label htmlFor="name">
            Your name <span className="font-normal text-ink-soft">(required)</span>
          </Label>
          {/* scroll-mt-16: a link from the error box scrolls the field into view with its label above. */}
          <Input id="name" name="name" autoComplete="name" required defaultValue={values.name} className="scroll-mt-16" {...problem('name')} />
          {errors.name && <FieldError id="name-error">{errors.name}</FieldError>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email">
            Your e-mail address <span className="font-normal text-ink-soft">(required)</span>
          </Label>
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={values.email} className="scroll-mt-16" {...problem('email')} />
          {errors.email && <FieldError id="email-error">{errors.email}</FieldError>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="note">
            Note <span className="font-normal text-ink-soft">(optional)</span>
          </Label>
          <p id="note-hint" className="text-ink-soft">For example, what is wrong with your bicycle. At most 500 characters.</p>
          <Textarea
            id="note"
            name="note"
            defaultValue={values.note}
            className="scroll-mt-28"
            {...problem('note')}
            aria-describedby={errors.note ? 'note-hint note-error' : 'note-hint'}
          />
          {errors.note && <FieldError id="note-error">{errors.note}</FieldError>}
        </div>

        {/* W6: <RepairChoice repairs={props.repairs} /> */}

        {/* The trap field: name="extra" is TRAP_FIELD in src/tasks/book-slot/guards.ts (keep the two the
            same). People never see it, a screen reader skips it (aria-hidden) and Tab never reaches it
            (tabIndex -1); a program that fills in every field fills this one, and its booking is not
            saved. It sits off the screen rather than display:none, because some programs skip fields
            that are switched off that way. After a failed send it is empty again. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="extra">Leave this field empty</label>
          <input id="extra" name="extra" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </div>

        <Notice>
          <p>{MADE_UP_DATA_NOTICE}</p>
        </Notice>

        <BookingSubmitButton />
      </SentValues>
    </form>
  )
}
