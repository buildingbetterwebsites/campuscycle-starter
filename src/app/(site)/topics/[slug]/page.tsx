// One topic's page, /topics/<slug>: its name, its description and the workshops that cover it.
// The list comes from the topic's "workshops" field, the reverse side of each workshop's "topics"
// (src/collections/Topics.ts): the same links, read from the other end.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { cache } from 'react'
import { ButtonLink } from '@/components/site/ButtonLink'
import { PageTitle } from '@/components/site/PageTitle'
import { ParentLink } from '@/components/site/ParentLink'
import { WorkshopCard } from '@/components/site/WorkshopCard'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

// cache(): the page and its browser-tab title ask for the same records once per visit.
const findTopic = cache(async (slug: string) => {
  const payload = await getPayload({ config })
  const topic = (
    await payload.find({
      collection: 'topics',
      where: { slug: { equals: slug } },
      depth: 0,
      joins: { workshops: { sort: 'createdAt', limit: 100 } },
      limit: 1,
    })
  ).docs[0]
  if (!topic) return undefined
  // The join gives the links: which workshops cover this topic, in order. It does not bring each
  // workshop's picture and other topics with it, so a second question fetches those for the cards,
  // the same way the workshop list does.
  const ids = (topic.workshops?.docs ?? []).map((workshop) => (typeof workshop === 'object' ? workshop.id : workshop))
  const found = ids.length
    ? (
        await payload.find({
          collection: 'workshops',
          where: { id: { in: ids } },
          // depth 1 fetches each workshop's image and topics with it; of a topic, only its name and slug.
          depth: 1,
          populate: { topics: { name: true, slug: true } },
          limit: ids.length,
        })
      ).docs
    : []
  // Back in the join's order (the second question does not keep it).
  const workshops = ids.flatMap((id) => found.filter((workshop) => workshop.id === id))
  return { topic, workshops }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const topic = (await findTopic((await params).slug))?.topic
  if (!topic) return {}
  return { title: `${topic.name} · Workshops`, description: topic.description ?? undefined }
}

export default async function TopicPage({ params }: Props) {
  const found = await findTopic((await params).slug)
  if (!found) notFound()
  const { topic, workshops } = found

  return (
    <div className="pb-6">
      <ParentLink href="/workshops" label="Workshops" current={topic.name} />
      <PageTitle title={topic.name} intro={topic.description} tone="purple" className="mt-3 sm:mt-4" />
      <section aria-labelledby="topic-workshops" className="grid gap-block">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="topic-workshops" className="text-2xl">
            {workshops.length === 0
              ? 'No workshop covers this topic yet'
              : `Workshops about ${topic.name} — ${workshops.length} ${workshops.length === 1 ? 'workshop' : 'workshops'}`}
          </h2>
          <ButtonLink href={`/workshops?topic=${topic.slug}`} variant="link">
            Filter the workshop list by this topic
          </ButtonLink>
        </div>
        {workshops.length > 0 && (
          <ul className="grid gap-block lg:grid-cols-2">
            {workshops.map((workshop) => (
              <li key={workshop.id} className="grid">
                <WorkshopCard workshop={workshop} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
