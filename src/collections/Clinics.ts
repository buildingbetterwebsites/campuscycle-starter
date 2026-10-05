import type { CollectionConfig } from 'payload'
import { publicContent } from '../access'
import { checkUniqueSlug, preventDependentDeletion } from '../lib/modelIntegrity'
import { day, slug, startTime } from './fields'

// The Saturday repair clinic: when and where it happens. Its bookable times are in Time Slots.
export const Clinics: CollectionConfig = {
  slug: 'clinics',
  admin: {
    useAsTitle: 'name',
  },
  access: publicContent,
  hooks: {
    beforeChange: [checkUniqueSlug],
    beforeDelete: [
      preventDependentDeletion(
        'timeSlots',
        'clinic',
        'This clinic still has time slots. Open Time Slots and move each one to another clinic or delete it (move or delete a slot\'s bookings first). Then delete the clinic.',
      ),
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    slug,
    day,
    startTime,
    {
      name: 'endTime',
      type: 'text',
      required: true,
      admin: {
        description: 'Use the 24-hour clock, for example 17:00.',
      },
    },
    {
      name: 'summary',
      type: 'textarea',
      required: true,
      admin: {
        description: 'If your course gave you a personal code for warm-up 4, put it in this summary.',
      },
    },
    // Add new clinic fields here, above the time slots list, so they also show above it in /admin.

    // The reverse side (a join) of the one-to-many: one clinic has many time slots. The link is stored
    // once, in each time slot's "clinic" field.
    {
      name: 'timeSlots',
      type: 'join',
      collection: 'timeSlots',
      on: 'clinic',
    },
  ],
}
