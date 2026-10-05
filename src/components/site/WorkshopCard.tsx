// What this is: one workshop in a list: its photo (left on wide screens, on top on phones), its title
// as the link to its page, its level, when it is, its price, its one-line summary and its topics.
// Every value comes from the workshop's own record, so a change in /admin shows here at once.
//
// What to change for your own site: which facts the card shows (the <dl> below), and the colour
// (accent): purple means workshops on this site, coral the clinic.
import type { Workshop } from '@/payload-types'
import { Badge } from '@/components/ui/badge'
import { formatPrice, formatWhen, imageFrom, levelLabel } from '@/lib/format'
import { FramedCard } from './FramedCard'
import { TopicList } from './TopicList'

type WorkshopCardProps = {
  workshop: Workshop
  // The end of the address the list was opened with ("?topic=…&level=…"). The link to the workshop
  // carries it, so the workshop's page can link back to the same filtered list.
  query?: string
  headingLevel?: 'h2' | 'h3'
}

export function WorkshopCard({ workshop, query = '', headingLevel = 'h3' }: WorkshopCardProps) {
  return (
    <FramedCard
      title={workshop.title}
      href={`/workshops/${workshop.slug}${query}`}
      image={imageFrom(workshop.image)}
      accent="purple"
      headingLevel={headingLevel}
    >
      <Badge tone={workshop.level === 'beginner' ? 'mint' : 'yellow'}>{levelLabel(workshop.level)}</Badge>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
        <dt className="text-ink-soft">When</dt>
        <dd className="font-semibold">{formatWhen(workshop)}</dd>
        <dt className="text-ink-soft">Price</dt>
        <dd className="font-semibold">{formatPrice(workshop.price)}</dd>
      </dl>
      <p>{workshop.summary}</p>
      <TopicList topics={workshop.topics} />
    </FramedCard>
  )
}
