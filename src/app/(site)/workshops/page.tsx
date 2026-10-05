// The workshop list, /workshops: example task 1, "find a workshop by topic and level".
// The two filters are in the address (/workshops?topic=brakes-and-gears&level=beginner), so a filtered
// list can be shared, bookmarked and reached again with Back, and the page works without JavaScript.
// Reading the address: src/tasks/find-workshop/filters.ts. The database question: queries.ts there.
import type { Metadata } from 'next'
import { getPayload } from 'payload'
import { cache } from 'react'
import { ButtonLink } from '@/components/site/ButtonLink'
import { PageTitle } from '@/components/site/PageTitle'
import { TrackStep } from '@/components/site/TrackStep'
import { WorkshopCard } from '@/components/site/WorkshopCard'
import { WorkshopFilters } from '@/components/site/WorkshopFilters'
import config from '@/payload.config'
import { filterQuery, filterSummary, parseFilters, type Level, type SearchParams } from '@/tasks/find-workshop/filters'
import { workshopWhere } from '@/tasks/find-workshop/queries'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<SearchParams> }

// cache(): the page and its browser-tab title (generateMetadata) both need the same list. With cache()
// the database is asked once per visit and both get that answer.
const findWorkshops = cache(async (topicSlug: string | null, level: Level | null) => {
  const payload = await getPayload({ config })
  const topics = (await payload.find({ collection: 'topics', sort: 'name', depth: 0, limit: 100, joins: false })).docs
  // The topic named in the address, if one has that slug. An old link may name one that is gone.
  const topic = topicSlug ? topics.find((candidate) => candidate.slug === topicSlug) : undefined
  const workshops = (
    await payload.find({
      collection: 'workshops',
      where: workshopWhere({ topic: topicSlug, level }, topic?.id ?? null),
      sort: 'createdAt',
      // depth 1 fetches each workshop's image and topics with it; of a topic, only its name and slug.
      depth: 1,
      populate: { topics: { name: true, slug: true } },
      limit: 100,
    })
  ).docs
  return { topics, topic, workshops }
})

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { topic, level } = parseFilters(await searchParams)
  const found = await findWorkshops(topic, level)
  // The tab title names the filters and the count: a screen reader reads it out when the page opens.
  let title = 'Workshops'
  if (found.workshops.length === 0) title = 'No workshops match these filters'
  else if (topic || level) title = filterSummary(level, found.topic?.name ?? null, found.workshops.length)
  return { title, description: 'Find a bicycle maintenance workshop by topic and level.' }
}

export default async function WorkshopsPage({ searchParams }: Props) {
  const filters = parseFilters(await searchParams)
  const { topics, topic, workshops } = await findWorkshops(filters.topic, filters.level)
  // Carried to each workshop's page, so its Back link returns to this same filtered list.
  const query = filterQuery(filters)

  return (
    <div className="pb-6">
      {/* The analytics step "filter_used" (src/lib/analytics.ts), when the user applied filters. Only the
          chosen level and a topic this site has are sent. once={query}: each choice of filters counts
          once per browser tab, also after a reload or Back (see TrackStep). key: a new choice starts
          a fresh TrackStep. */}
      {(filters.topic || filters.level) && (
        <TrackStep key={query} event="filter_used" once={query} props={{ topic: topic?.slug ?? '', level: filters.level ?? '' }} />
      )}
      <PageTitle
        title="Workshops"
        intro="Short maintenance workshops for your own bicycle, in small groups. Choose a topic and a level, or look through them all."
        tone="purple"
      />
      <div className="grid gap-block">
        <WorkshopFilters topics={topics} filters={filters} />
        {/* id="results": the form's "#results" scrolls here after Apply filters. scroll-mt-6 keeps a
            little space above the line. */}
        <section id="results" aria-labelledby="results-summary" className="grid scroll-mt-6 gap-block">
          {/* Apply filters loads a new page, and a screen reader then reads the browser tab's title,
              which names the filters and the count (generateMetadata, above). role="status" adds
              nothing on that first load; it is there for a later version that updates the list
              without a new page: a screen reader then reads out the changed line. */}
          <div role="status" className="grid gap-2">
            <h2 id="results-summary" className="text-2xl">
              {workshops.length > 0 ? filterSummary(filters.level, topic?.name ?? null, workshops.length) : 'No workshops match these filters'}
            </h2>
            {workshops.length === 0 && (
              <p className="max-w-(--container-reading)">
                {filters.topic && !topic
                  ? `This site has no topic called "${filters.topic}". The link may be out of date. `
                  : 'None of the workshops matches every filter you chose. '}
                Choose another topic or level, or see all workshops.
              </p>
            )}
          </div>
          {workshops.length > 0 ? (
            <ul className="grid gap-block lg:grid-cols-2">
              {workshops.map((workshop) => (
                <li key={workshop.id} className="grid">
                  <WorkshopCard workshop={workshop} query={query} />
                </li>
              ))}
            </ul>
          ) : (
            <ButtonLink href="/workshops" variant="secondary" className="w-fit">Clear filters</ButtonLink>
          )}
        </section>
      </div>
    </div>
  )
}
