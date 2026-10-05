import { HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import type { CollectionConfig } from 'payload'
import { publicContent } from '../access'
import { checkUniqueSlug } from '../lib/modelIntegrity'
import { slug } from './fields'

// The plain pages of the website, such as "About" and "Contact".
export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
  },
  access: publicContent,
  hooks: {
    beforeChange: [checkUniqueSlug],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    slug,
    {
      name: 'intro',
      type: 'textarea',
    },
    {
      name: 'body',
      type: 'richText',
      // Headings h2 to h4 only: the page's title is already its one h1, so an editor cannot add a
      // second one.
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures.filter((feature) => feature.key !== 'heading'),
          HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
        ],
      }),
    },
  ],
}
