// One workshop's page, /workshops/<slug>. Every fact on it comes from where it is kept once: the level,
// day, times, price and group size from the workshop's own record; the pricing rule and the place from
// the Site facts global. The description is only words about what you learn, so changing a price or
// a time in /admin never leaves an old copy behind in a text.
//
// When the user came from a filtered list, the address carries the filters
// (/workshops/true-a-wheel?topic=tyres-and-wheels), so "Back" returns to that same list. No JavaScript
// and no browser history are needed for that.
import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { cache } from 'react'
import { ButtonLink } from '@/components/site/ButtonLink'
import { Notice } from '@/components/site/Notice'
import { PageTitle } from '@/components/site/PageTitle'
import { ParentLink } from '@/components/site/ParentLink'
import { TopicList } from '@/components/site/TopicList'
import { Badge } from '@/components/ui/badge'
import { formatPrice, formatWhen, imageFrom, levelLabel } from '@/lib/format'
import config from '@/payload.config'
import { filterQuery, parseFilters, type SearchParams } from '@/tasks/find-workshop/filters'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }

// cache(): the page and its browser-tab title ask for the same record once per visit.
const findWorkshop = cache(async (slug: string) => {
  const payload = await getPayload({ config })
  const found = await payload.find({
    collection: 'workshops',
    where: { slug: { equals: slug } },
    // depth 1 fetches the image and the topics with it; of a topic, only its name and slug.
    depth: 1,
    populate: { topics: { name: true, slug: true } },
    limit: 1,
  })
  return found.docs[0]
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const workshop = await findWorkshop((await params).slug)
  if (!workshop) return {}
  return { title: workshop.title, description: workshop.summary }
}

export default async function WorkshopPage({ params, searchParams }: Props) {
  const workshop = await findWorkshop((await params).slug)
  // No workshop with this slug: the "not found" page, which explains and offers a way on.
  if (!workshop) notFound()
  const filters = parseFilters(await searchParams)
  const back = `/workshops${filterQuery(filters)}`
  const payload = await getPayload({ config })
  const facts = await payload.findGlobal({ slug: 'site-facts', depth: 0 })

  return (
    <article className="pb-6">
      <ParentLink href={back} label="Workshops" current={workshop.title} />
      <PageTitle
        title={workshop.title}
        intro={workshop.summary}
        tone="purple"
        image={imageFrom(workshop.image)}
        imageAccent="purple"
        className="mt-3 sm:mt-4"
      >
        <Badge tone={workshop.level === 'beginner' ? 'mint' : 'yellow'}>{levelLabel(workshop.level)}</Badge>
      </PageTitle>

      <div className="grid gap-block lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {/* First in the page (a phone shows it first), on the right on wide screens. */}
        <section aria-labelledby="facts" className="framed grid gap-4 p-6 offset-purple lg:col-start-2 lg:row-start-1">
          <h2 id="facts" className="text-xl">At a glance</h2>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
            <dt className="text-ink-soft">Level</dt>
            <dd className="font-semibold">{levelLabel(workshop.level)}</dd>
            <dt className="text-ink-soft">When</dt>
            <dd className="font-semibold">{formatWhen(workshop)}</dd>
            <dt className="text-ink-soft">Price</dt>
            <dd className="font-semibold">{formatPrice(workshop.price)}</dd>
            <dt className="text-ink-soft">Group size</dt>
            <dd className="font-semibold">{`At most ${workshop.groupSize} people`}</dd>
            {facts.place && (
              <>
                <dt className="text-ink-soft">Place</dt>
                <dd className="min-w-0 font-semibold [overflow-wrap:anywhere]">{facts.place}</dd>
              </>
            )}
          </dl>
          {facts.pricingRule && (
            <Notice>
              <p>{facts.pricingRule}</p>
            </Notice>
          )}
        </section>

        <div className="grid content-start gap-block lg:col-start-1 lg:row-start-1">
          {workshop.description && (
            <section aria-labelledby="learn" className="grid gap-3">
              <h2 id="learn" className="text-2xl">What you learn</h2>
              <div className="rich-text">
                <RichText data={workshop.description} disableContainer />
              </div>
            </section>
          )}
          <TopicList topics={workshop.topics} />
          <ButtonLink href={back} variant="secondary" className="w-fit">
            {filters.topic || filters.level ? 'Back to the filtered workshops' : 'Back to all workshops'}
          </ButtonLink>
        </div>
      </div>
    </article>
  )
}
