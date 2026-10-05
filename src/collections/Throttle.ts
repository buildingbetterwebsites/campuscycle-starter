import type { CollectionConfig } from 'payload'
import { nobody } from '../access'

// A record of recent requests (bookings sent with the booking form, and course checks), used to slow
// down anyone who sends too many. Only the
// website's own server code reads and writes it, so nobody can do anything with it in /admin or
// through the API.
export const Throttle: CollectionConfig = {
  slug: 'throttle',
  admin: {
    hidden: true,
  },
  access: {
    create: nobody,
    read: nobody,
    update: nobody,
    delete: nobody,
  },
  fields: [
    {
      name: 'key',
      type: 'text',
      required: true,
      index: true,
    },
  ],
  // Payload adds a createdAt time to each record. It is used to remove records that are too old to
  // matter.
  timestamps: true,
}
