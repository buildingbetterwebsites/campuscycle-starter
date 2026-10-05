'use client'

// What this is: the booking form's button (BookingForm.tsx). While the form is being sent it says
// "Saving your booking…" and cannot be pressed again, and a line only screen readers hear says the same.
//
// What to change for your own site: the two texts on the button.
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'

// useFormStatus() tells whether the form is being sent.
export function BookingSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Disabled while saving, so a second press cannot send the form twice. It keeps its full
          colour (no fading), so "Saving your booking…" stays easy to read. */}
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="disabled:cursor-wait disabled:opacity-100 disabled:hover:border-ink disabled:hover:bg-ink"
      >
        {pending ? 'Saving your booking…' : 'Book this slot'}
      </Button>
      {/* A polite status region: a screen reader reads out the change when it has finished speaking. */}
      <p role="status" className="sr-only">
        {pending ? 'Saving your booking…' : ''}
      </p>
    </div>
  )
}
