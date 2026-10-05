// What this is: a workshop's topics as a row of links, each to the topic's own page (/topics/<slug>),
// where all the workshops on that topic are listed. A visible "Topics" label says what the links are.
//
// What to change for your own site: the label text, and where a topic links to (topicHref).
import type { Topic } from '@/payload-types'
import { cn } from '@/lib/utils'
import { ButtonLink } from './ButtonLink'

// A topic as Payload returns it: the whole record, or only its id when the query did not go deep
// enough to fetch it. Only whole records can be shown (they have a name and a slug).
type TopicLike = number | Pick<Topic, 'id' | 'name' | 'slug'>

export const topicHref = (slug: string) => `/topics/${slug}`

export function TopicList({ topics, className }: { topics?: TopicLike[] | null; className?: string }) {
  const shown = (topics ?? []).filter((topic): topic is Pick<Topic, 'id' | 'name' | 'slug'> => typeof topic === 'object')
  if (shown.length === 0) return null
  // The label on its own line, the chips side by side below it, wrapping onto a new row when there
  // is no room.
  return (
    <div className={cn('grid gap-2', className)}>
      <span className="text-ink-soft">{shown.length === 1 ? 'Topic' : 'Topics'}</span>
      <ul className="flex flex-wrap gap-2">
        {shown.map((topic) => (
          <li key={topic.id}>
            {/* min-h-11: 44 px high, a target a finger can hit easily. */}
            <ButtonLink href={topicHref(topic.slug)} variant="secondary" size="sm" className="min-h-11">
              {topic.name}
            </ButtonLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
