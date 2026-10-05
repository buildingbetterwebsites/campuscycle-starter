// What this is: how a plain page (About, Contact, Privacy) looks: its title and intro in the title
// panel, then the text an editor wrote in /admin. Anything you pass inside it (children) goes between
// the two, for example the Contact page's e-mail address and place.
//
// What to change for your own site: nothing here; the text comes from the page's record in /admin and
// the look from PageTitle and the tokens in globals.css.
import { RichText } from '@payloadcms/richtext-lexical/react'
import type { ReactNode } from 'react'
import type { Page } from '@/payload-types'
import { cn } from '@/lib/utils'
import { PageTitle } from './PageTitle'

// The same inset as the title panel, so everything below the title lines up with it.
const INSET = 'px-6 sm:px-10 lg:px-14'

export function PlainPage({ page, children }: { page: Page; children?: ReactNode }) {
  return (
    <article className="pb-6">
      <PageTitle title={page.title} intro={page.intro} />
      {children && <div className={INSET}>{children}</div>}
      {page.body && (
        <div className={cn('rich-text', INSET, children && 'mt-block')}>
          <RichText data={page.body} disableContainer />
        </div>
      )}
    </article>
  )
}
