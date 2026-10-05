import type { CollectionConfig } from 'payload'
import { editorsOnly, editorsOnlyField, editorsOrOwnBookingField, editorsOrOwnBookings, nobody } from '../access'
import { membersAreaOn } from '../lib/membersArea'
import { requireExistingRelation } from '../lib/modelIntegrity'
import { checkPlaces } from '../tasks/book-slot/capacity'

// What the check below says when a booking's time slot is deleted while someone is booking it. The
// booking form (src/tasks/book-slot/createBooking.ts) recognises it by this text, so keep it in this
// one place.
export const SLOT_GONE_MESSAGE = 'This time slot no longer exists. Choose another time slot.'

// One user's booking for one clinic time slot. It holds a name and an e-mail address, so it is private:
// only editors can see it (and, when the optional members' area is on, the member who made it).
export const Bookings: CollectionConfig = {
  slug: 'bookings',
  admin: {
    useAsTitle: 'name',
  },
  // Nobody can create a booking in /admin or through the API, not even an editor. The booking form on
  // the website checks the details and the free places first, then saves the booking itself.
  access: {
    create: nobody,
    read: editorsOrOwnBookings,
    update: editorsOnly,
    delete: editorsOnly,
  },
  hooks: {
    beforeChange: [
      requireExistingRelation('timeSlot', 'timeSlots', SLOT_GONE_MESSAGE),
      // The places rule: no booking in a full time slot, also when an editor moves a booking.
      checkPlaces,
    ],
  },
  fields: [
    // Every booking belongs to exactly one time slot. A later exercise in the course adds a second
    // relationship here: repairs.
    {
      name: 'timeSlot',
      type: 'relationship',
      relationTo: 'timeSlots',
      required: true,
      admin: {
        description: 'The clinic time slot this booking is for.',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
    },
    {
      name: 'note',
      type: 'textarea',
    },
    // Add new booking fields here.

    // The optional members' area (src/lib/membersArea.ts): the member who was logged in when they
    // booked. Only the booking form's server code fills it in, from the log-in cookie, never from what
    // the form sends. Empty for every booking made without logging in, and always while the area is off.
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'members',
      // Only the member's id, never the member's record: a booking read anywhere never reads the
      // members collection, which refuses every request while the area is off.
      maxDepth: 0,
      access: {
        read: editorsOrOwnBookingField,
        create: editorsOnlyField,
        update: editorsOnlyField,
      },
      admin: {
        // Out of /admin altogether while the area is off: not on the record, and not in the Columns or
        // Filters lists of the bookings list either. Getters: they read the setting when Payload asks
        // for them, not once when this file is loaded.
        // For developers: /admin reads these three once, when the server starts. After changing
        // MEMBERS_AREA, restart `npm run dev` (on Vercel: redeploy) before checking /admin.
        get hidden() {
          return !membersAreaOn()
        },
        get disableListColumn() {
          return !membersAreaOn()
        },
        get disableListFilter() {
          return !membersAreaOn()
        },
        position: 'sidebar',
        description: "The member who was logged in when they booked (members' area only).",
      },
    },

    // A random code from the booking form, one per form. When the same form is sent twice (a double
    // click, or a retry after the answer got lost), the second send finds this code and gets the first
    // booking back instead of saving a second one. unique: the database refuses the same code twice.
    {
      name: 'requestId',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Filled in by the booking form. It stops the same form from saving two bookings.',
      },
    },
  ],
}
