// The places rule's setting: which records have a limited number of places, and which field says how
// many. The rule itself is in capacity.ts: a booking is refused when its slot has no place left.
//
// Three other parts still name the time slots and bookings themselves, so change them too when you
// point this at other collections: preventCapacityReduction in src/lib/modelIntegrity.ts (a slot may
// not get fewer places than its bookings), the default collection of lockTimeSlot in
// src/lib/slotLock.ts, and the places count on the clinic page (src/app/(site)/clinics/[slug]/page.tsx).
//
// For your own topic, point it at your own collections. A theatre site, for example, sells seats for
// performances:
//   export const PLACES = { slotCollection: 'performances', placesField: 'seats', bookingField: 'performance' } as const
// Then add capacity.ts's checkPlaces to the hooks of the collection that holds the bookings (here
// src/collections/Bookings.ts), as this starter does.
export const PLACES = {
  // The collection whose records have places: here, the clinic's time slots.
  slotCollection: 'timeSlots',
  // The number field on those records that says how many places each one has.
  placesField: 'places',
  // The relationship field on a booking that says which of those records it is for.
  bookingField: 'timeSlot',
} as const
