// Reading a plain page (About, Contact, Privacy) from the Pages collection, shared by the page files
// that show one: src/app/(site)/[slug]/page.tsx and src/app/(site)/contact/page.tsx.
import type { Metadata } from 'next'
import { getPayload } from 'payload'
import { cache } from 'react'
import config from '@/payload.config'
import type { Page } from '@/payload-types'

// cache(): while Next.js answers one request, the page and its browser-tab title (generateMetadata)
// both ask for the same record. With cache() the database is asked once and both get that answer.
export const findPage = cache(async (slug: string): Promise<Page | undefined> => {
  const payload = await getPayload({ config })
  const found = await payload.find({ collection: 'pages', where: { slug: { equals: slug } }, limit: 1 })
  return found.docs[0]
})

// The browser tab's title and the search-result text, from the same record.
export function pageMetadata(page: Page | undefined): Metadata {
  if (!page) return {}
  return { title: page.title, description: page.intro ?? undefined }
}
