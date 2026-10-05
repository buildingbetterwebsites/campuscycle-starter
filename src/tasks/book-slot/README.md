# Example task 2: book a clinic slot

A user who wants their bicycle checked or repaired opens the **Repair clinic**, chooses a time slot
that still has a place, gives a name and an e-mail address, and presses **Book this slot**. The
booking is saved, and the confirmation page says so. A full slot cannot be booked.

## Where it lives

It is one page, the booking form with its small parts, and one server function, plus the rules that
protect them:

| File | What it does |
|---|---|
| `src/app/(site)/clinics/[slug]/page.tsx` | The clinic's page: the clinic, its prices, and the booking form with the time slots that have not started yet and their places left |
| `src/components/site/BookingForm.tsx` | The form: its fields, and W6's repair choice, ready to switch on |
| `src/components/site/BookingSubmitButton.tsx`, `src/components/site/BookingProblem.tsx` | The form's button ("Saving your booking…" while it is sent), and the box that says what went wrong when it was not saved |
| `src/tasks/book-slot/typedValues.ts` | What the user typed, read from the form when no answer came back, so nothing is lost |
| `src/components/site/SlotPicker.tsx` | "Choose a time": one radio button per slot, with "2 places left", "1 place left" or "Full" |
| `src/tasks/book-slot/saveBooking.ts` | The server function the form calls. It opens the confirmation page when the booking is saved |
| `src/tasks/book-slot/createBooking.ts` | The checks and the save, in order (see below). Only the fields it names are saved |
| `src/tasks/book-slot/capacity.ts` | The places rule: no booking in a full slot, also when an editor moves a booking in /admin |
| `src/tasks/book-slot/places.ts` | The places rule's one setting: which collection has places, and in which field |
| `src/tasks/book-slot/guards.ts` | The spam guards: the hidden trap field and the rate limit. **You do not need to change this file** |
| `src/tasks/book-slot/receipt.ts` | The signed confirmation link, so the confirmation shows this booking and only this one |
| `src/app/(site)/clinics/[slug]/booked/page.tsx` | The confirmation page |
| `src/app/(site)/clinics/[slug]/error.tsx` | The last safety net: "This page could not be shown", with Try again |
| `tests/integration/booking.test.ts`, `booking-race.test.ts`, `tests/unit/book-slot.test.ts` | The tests |

## What happens when a user presses "Book this slot"

`createBooking` checks, in this order, and stops at the first "no":

1. **The trap field.** The form has a field nobody sees. A program that fills in every field fills this
   one too. Nothing is saved, and the answer only says "Your booking was not saved. Please try again."
   A person whose browser filled it by accident can simply send the form again: it comes back empty.
2. **The fields.** A name (at most 100 characters), an e-mail address in a form the database accepts,
   an optional note (at most 500 characters), and a time slot of this clinic that has not started
   yet. Every problem is listed at once, and everything the user typed comes back in the form.
3. **The same form twice.** Each form carries a random `requestId`. If the answer to a booking got
   lost and the user sends the form again, they get the same booking back: never a second one.
4. **The rate limit.** At most 5 bookings an hour from one device: "Too many bookings from this
   device. Try again in an hour." Only sends that got this far count, so typing mistakes never use it
   up. The device's address is never stored: only a hash of it (a code that cannot be turned back),
   kept for an hour. The address comes from the `x-forwarded-for` header. Vercel sets that header
   itself, so there it is the user's real address; on other hosting a program could send its own.
5. **The save, with the places rule.** `capacity.ts` locks the slot, counts its bookings and refuses
   a full slot with "This slot is full. Choose another time." The lock makes two people who book the
   last place at the same moment wait for each other, so only one of them gets it. The form then
   comes back with no time chosen and every slot's places as they are now.

When the server cannot be reached at all, the form says it cannot tell whether the booking was saved,
and keeps everything typed: sending it again is safe (step 3).

Only after the booking is saved does the user see the confirmation: "Your booking is saved. This is a
practice project: use made-up details; no one will contact you." Its address carries a signature, so a
changed or made-up link shows "We can't show this booking confirmation." and nothing else.

Bookings are private. The clinic page only counts them; it never shows a name or an e-mail address.

**While you test your own copy** you may book more than 5 times in an hour and get "Too many bookings
from this device." Wait an hour, or empty the `throttle` table in your own (not the live) database,
for example in Neon's SQL editor: `delete from throttle;`. The rows only hold hashed addresses.

## Adapting it to your own site

Say your site sells seats for performances.

1. **`places.ts`**: point the setting at your collections, for example
   `{ slotCollection: 'performances', placesField: 'seats', bookingField: 'performance' }`, and add
   `checkPlaces` to your bookings collection's `beforeChange` hooks (as `src/collections/Bookings.ts`
   does). Three parts still name the time slots and bookings themselves, so change them too:
   `preventCapacityReduction` in `src/lib/modelIntegrity.ts`, the default collection of `lockTimeSlot`
   in `src/lib/slotLock.ts`, and the places count on the clinic page.
2. **`createBooking.ts`**: your field names. `read(formData, '…')` reads each field the form sends;
   the `data` in `payload.create` says which ones are saved. A field that is not in both is never saved.
   Change the collection names (`timeSlots`, `clinics`, `bookings`) and the messages to your words.
3. **The page and the two components**: your labels and words ("Choose a time", "Book this slot").

These stay as they are, because they keep the task safe and honest for every user:

- `guards.ts`, the trap field in the form, and its place first in the checks;
- the hidden `requestId` and `clinic` fields in the form;
- the made-up-data notice above the button, and the confirmation's exact words;
- `export const dynamic = 'force-dynamic'` on both pages;
- the tests: change their names and values to your content, and keep what they check.

## W6: let the user choose repairs

The repair choice is ready, switched off. After you add the `repairs` relationship to bookings (with
its migration):

1. In `src/components/site/BookingForm.tsx`, remove the `//` in front of every line of the function
   `RepairChoice` (marked W6). Then replace the whole line
   `{/* W6: <RepairChoice repairs={props.repairs} /> */}` with `<RepairChoice repairs={props.repairs} />`.
   Each choice shows the repair's name; the price list sits above the form on the same page.
2. In `src/tasks/book-slot/createBooking.ts`, switch on the two lines the W6 comment in
   createBooking.ts names: remove the `//` in front of `const repairs = formData.getAll('repairs')…` and in front of `repairs,` in
   `payload.create`.
3. Save a booking with two repairs, and find it on each repair's page in /admin.
