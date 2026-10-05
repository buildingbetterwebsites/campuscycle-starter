import type { CollectionConfig } from 'payload'
import { publicContent } from '../access'
import { checkUniqueSlug, requireExistingRelation } from '../lib/modelIntegrity'
import { levelLabel } from '../lib/format'
import { LEVELS } from '../tasks/find-workshop/filters'
import { day, positiveInteger, price, slug, startTime } from './fields'

// A weekly workshop that users can find by topic and level.
export const Workshops: CollectionConfig = {
  slug: 'workshops',
  admin: {
    useAsTitle: 'title',
  },
  access: publicContent,
  hooks: {
    beforeChange: [
      checkUniqueSlug,
      requireExistingRelation('topics', 'topics', 'A selected topic no longer exists. Choose the topics again.'),
      requireExistingRelation('image', 'media', 'This image no longer exists. Choose another image.'),
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    slug,
    {
      name: 'level',
      type: 'select',
      required: true,
      // The levels the workshop filter knows (src/tasks/find-workshop/filters.ts), each with the label
      // the site shows: "Beginner", "Intermediate".
      options: LEVELS.map((value) => ({ label: levelLabel(value), value })),
    },
    day,
    startTime,
    {
      name: 'endTime',
      type: 'text',
      admin: {
        description: 'Use the 24-hour clock, for example 20:00. Leave empty if the workshop has none.',
      },
    },
    // Not the same as endTime: some workshops have no fixed end, but must be over by a certain time
    // (the gear workshop, because the clinic needs the room from 15:00). The page then says
    // "ends by 15:00". A field, not a sentence in the description, so it is kept in one place.
    {
      name: 'latestEnd',
      label: 'Ends at the latest',
      type: 'text',
      admin: {
        description:
          'Only for a workshop with no end time that must be over by a certain time. Use the 24-hour clock, for example 15:00. Pages show "ends by 15:00".',
      },
    },
    price,
    {
      name: 'groupSize',
      type: 'number',
      required: true,
      defaultValue: 6,
      min: 1,
      validate: positiveInteger,
      admin: {
        description: 'The largest number of people in one workshop.',
      },
    },
    {
      name: 'summary',
      type: 'textarea',
      required: true,
    },
    {
      name: 'description',
      type: 'richText',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    // The many-to-many: a workshop can cover several topics, and a topic can belong to several
    // workshops. Stored only here.
    {
      name: 'topics',
      type: 'relationship',
      relationTo: 'topics',
      hasMany: true,
    },
  ],
}
