// What the user typed and ticked, read from the booking form itself. The form (BookingForm.tsx) uses it
// when the server gave no answer at all, so nothing the user typed is lost.
import type { BookingValues } from './createBooking'

export function typedValues(formData: FormData): BookingValues {
  const text = (name: string) => String(formData.get(name) ?? '')
  return { timeSlot: text('timeSlot'), name: text('name'), email: text('email'), note: text('note'), repairs: formData.getAll('repairs').map(String) }
}
