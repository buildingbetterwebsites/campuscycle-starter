import type { CollectionConfig } from 'payload'
import { publicContent } from '../access'

// Uploaded images. Anyone can see them on the website; only editors can upload or change them.
export const Media: CollectionConfig = {
  slug: 'media',
  access: publicContent,
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Describe the image. Never upload photos of people.',
      },
    },
  ],
  upload: true,
}
