import type { CollectionConfig } from 'payload'
import { editorsOnly, isEditor } from '../access'
import { keepOneEditor } from '../lib/modelIntegrity'

// The editors: the accounts that can log in to /admin and change the website's content.
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  access: {
    // Only editors may open /admin. Members of the optional members' area never can.
    admin: isEditor,
    create: editorsOnly,
    read: editorsOnly,
    update: editorsOnly,
    delete: editorsOnly,
  },
  hooks: {
    beforeOperation: [keepOneEditor],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
  ],
}
