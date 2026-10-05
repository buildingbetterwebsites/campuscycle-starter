// What this is: the box at the top of the booking form (BookingForm.tsx) when a booking was not saved,
// or when no answer came back: what went wrong, with a link to each field that has a problem.
//
// What to change for your own site: the words.
import { Notice } from '@/components/site/Notice'
import type { BookingField, BookingResult } from '@/tasks/book-slot/createBooking'

type Failure = Extract<BookingResult, { ok: false }>

/** The box at the top of the form when a booking was not saved (or no answer came back). */
export function BookingProblem({ result }: { result: Failure }) {
  if (result.lost) {
    return (
      // Not "Not saved": the booking may have reached the server and been saved.
      <Notice tone="error" label="Not confirmed" role="alert">
        <p className="font-semibold">We could not reach the server, so we cannot say whether your booking was saved.</p>
        <p>{'Check your internet connection and press "Book this slot" again. You will not be booked twice.'}</p>
      </Notice>
    )
  }
  const errors = Object.entries(result.errors ?? {}) as [BookingField, string][]
  // When the chosen time was full (or gone), its own message is the one item in the list, so the bold
  // line only says that the booking was not saved, instead of saying the same thing twice.
  const slotOnly = errors.length === 1 && errors[0][0] === 'timeSlot' && errors[0][1] === result.message
  return (
    <Notice tone="error" label="Not saved" role="alert">
      <p className="font-semibold">{slotOnly ? 'Your booking was not saved.' : result.message}</p>
      {errors.length > 0 && (
        <ul className="grid list-disc gap-1 pl-5">
          {errors.map(([field, message]) => (
            <li key={field}>
              <a href={`#${field}`}>{message}</a>
            </li>
          ))}
        </ul>
      )}
    </Notice>
  )
}
