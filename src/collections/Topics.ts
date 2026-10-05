import type { CollectionConfig } from 'payload'
import { publicContent } from '../access'
import { checkUniqueSlug, preventDependentDeletion } from '../lib/modelIntegrity'
import { slug } from './fields'

// A subject a workshop can cover, such as tyres or gears. Users filter the workshops by topic.
export const Topics: CollectionConfig = {
  slug: 'topics',
  admin: {
    useAsTitle: 'name',
  },
  access: publicContent,
  hooks: {
    beforeChange: [checkUniqueSlug],
    beforeDelete: [
      preventDependentDeletion(
        'workshops',
        'topics',
        'This topic is still used by workshops (see its Workshops list). Remove it from each workshop, then delete the topic.',
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
    {
      name: 'description',
      type: 'textarea',
    },
    // The reverse side of the many-to-many: read from each workshop's "topics".
    // Nothing is stored twice.
    {
      name: 'workshops',
      type: 'join',
      collection: 'workshops',
      on: 'topics',
    },
  ],
}
