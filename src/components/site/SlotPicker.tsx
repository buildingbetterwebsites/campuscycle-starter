// What this is: the "Choose a time" part of the booking form: one radio button per time slot, with
// its date and time and how many places are left. A full slot stays in the list, so the user sees it
// exists, but it cannot be chosen, and it says "Full" in words (not only in a colour).
//
// How it shows the slots: `slots.map(...)` makes one list item per slot. Any list of records is shown
// on a page this same way.
//
// What to change for your own site: the legend ("Choose a time") and the name of what is booked.
import { FieldError } from '@/components/site/FieldError'
import { placesLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

// One time slot as the form needs it: worked out on the clinic page, from the slot and its bookings.
export type SlotChoice = {
  id: number
  // "Saturday 10 October, 15:00", in Brussels time (formatSlotTime in src/lib/format.ts).
  label: string
  placesLeft: number
}

type SlotPickerProps = {
  slots: SlotChoice[]
  // The slot chosen before the form came back with a problem, so the choice is kept.
  selected?: string
  error?: string
}

export function SlotPicker({ slots, selected, error }: SlotPickerProps) {
  return (
    // id="timeSlot": the error box's link to this group. It scrolls to the group with "Choose a time" at
    // the top (scroll-mt-6 keeps a little space above it). tabIndex -1 lets the link move the keyboard
    // focus onto the group (Tab never stops on it); the next Tab then reaches the first open slot.
    <fieldset id="timeSlot" tabIndex={-1} aria-describedby={error ? 'timeSlot-error' : undefined} className="grid min-w-0 scroll-mt-6 gap-3">
      <legend className="mb-3 text-base font-semibold">
        Choose a time <span className="font-normal text-ink-soft">(required)</span>
      </legend>
      {error && <FieldError id="timeSlot-error">{error}</FieldError>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {slots.map((slot) => {
          const full = slot.placesLeft <= 0
          return (
            <li key={slot.id} className="grid">
              <label
                className={cn(
                  'flex min-h-11 cursor-pointer items-start gap-3 rounded-control border-[1.5px] border-ink bg-canvas px-4 py-3',
                  // The chosen slot: a thicker frame and a mint wash, besides the filled radio button.
                  'has-checked:border-2 has-checked:bg-mint-wash',
                  // The keyboard is on this slot: the whole card gets the focus ring.
                  'has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus has-focus-visible:outline-solid',
                  error && 'border-2 bg-error-wash',
                  // A full slot: quieter than the open ones (dashed frame, grey text), and "Full" in words.
                  'has-disabled:cursor-not-allowed has-disabled:border-dashed has-disabled:bg-canvas has-disabled:text-ink-soft',
                )}
              >
                <input
                  type="radio"
                  name="timeSlot"
                  value={slot.id}
                  className="mt-1 size-5 shrink-0 accent-ink"
                  defaultChecked={selected === String(slot.id)}
                  disabled={full}
                  required
                />
                <span className="grid">
                  <span className="font-semibold">{slot.label}</span>
                  <span className={full ? 'font-semibold' : 'text-ink-soft'}>{placesLabel(slot.placesLeft)}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}
