import type { GlobalConfig } from 'payload'
import { anyone, editorsOnly } from '../access'

// The facts that several pages show: one record, so each fact has one source. An editor changes the
// pricing rule here once, and the home page and every workshop page show the new text at once.
// A "global" is a record that exists exactly once (there is one set of site facts, not a list).
export const SiteFacts: GlobalConfig = {
  slug: 'site-facts',
  label: 'Site facts',
  admin: {
    description: 'Change these here, once: every page reads them from here.',
  },
  // The same as the Pages: anyone may read them, only editors may change them.
  access: {
    read: anyone,
    update: editorsOnly,
  },
  fields: [
    {
      name: 'pricingRule',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Shown on the home page and on every workshop page.',
      },
    },
    {
      name: 'place',
      type: 'text',
      required: true,
      admin: {
        description: 'Where the workshops and the clinic are. Shown on the Contact page and on every workshop page.',
      },
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      admin: {
        description: 'Shown on the Contact page.',
      },
    },
  ],
}
