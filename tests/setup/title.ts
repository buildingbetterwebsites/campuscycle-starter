// The browser tab's title as Next.js makes it: a page gives only its own part (such as "Workshops"),
// and the layout's title template (src/app/(site)/layout.tsx, SITE_TITLE) adds the site's name after it.
// The tests compare the whole tab title, so a change to either part shows.
import type { Metadata } from 'next'
import { SITE_TITLE } from '../../src/content/campus-cycle'

export function tabTitle(metadata: Metadata | Promise<Metadata>): Promise<string> {
  return Promise.resolve(metadata).then(({ title }) => {
    if (typeof title !== 'string') throw new Error(`Expected the page to give its own title as text, got ${JSON.stringify(title)}`)
    return SITE_TITLE.template.replace('%s', title)
  })
}
