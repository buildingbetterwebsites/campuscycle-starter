// Reading the workshop filters from the web address, for example
// /workshops?topic=brakes-and-gears&level=beginner.
//
// Why the filters live in the address: a filtered list can then be shared and bookmarked, the browser's
// Back button returns to it, and the form works without JavaScript (a plain GET form only changes the
// address). The price of that: anyone can type anything into an address, and an old shared link may
// name a topic that no longer exists. So this file reads the address carefully and never throws: a
// value it cannot use is left out and reported in `unknown`, and the page shows what it can.

// The two levels a workshop can have. The `level` field in src/collections/Workshops.ts offers exactly
// these, so a level is added or renamed here, once (with a migration for the field's new choices).
import { SLUG_FORMAT } from '../../collections/fields'

export const LEVELS = ['beginner', 'intermediate'] as const
export type Level = (typeof LEVELS)[number]

export type Filters = {
  topic: string | null
  level: Level | null
  // The names of the address's parts that were left out: a filter with a value this site does not
  // use (level=expert), or a part that is not a filter at all.
  unknown: string[]
}

// What Next.js gives a page as its searchParams: each part once (a string), repeated (an array), or
// missing.
export type SearchParams = Record<string, string | string[] | undefined>

// SLUG_FORMAT is the rule for a slug in /admin: lowercase letters and digits in groups joined by single
// hyphens. Anything else, such as "<script>", cannot be a topic's slug.

// The first value when a part repeats (?topic=a&topic=b), without spaces around it.
function firstValue(value: string | string[] | undefined): string {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' ? first.trim().toLowerCase() : ''
}

export function parseFilters(searchParams: SearchParams): Filters {
  const filters: Filters = { topic: null, level: null, unknown: [] }
  for (const [name, value] of Object.entries(searchParams ?? {})) {
    const text = firstValue(value)
    if (name === 'topic') {
      // An empty value means "All topics": that is what the form sends when no topic is chosen.
      if (SLUG_FORMAT.test(text) && text.length <= 100) filters.topic = text
      else if (text) filters.unknown.push(name)
    } else if (name === 'level') {
      if ((LEVELS as readonly string[]).includes(text)) filters.level = text as Level
      else if (text) filters.unknown.push(name)
    } else {
      filters.unknown.push(name)
    }
  }
  return filters
}

/**
 * The filters as the end of an address: "?topic=brakes-and-gears&level=beginner", or "" when there
 * are none. Links from the list to a workshop carry it forward, so the workshop's "Back" link can
 * return to the same filtered list (no JavaScript needed).
 */
export function filterQuery({ topic, level }: Pick<Filters, 'topic' | 'level'>): string {
  const query = new URLSearchParams()
  if (topic) query.set('topic', topic)
  if (level) query.set('level', level)
  const text = query.toString()
  return text ? `?${text}` : ''
}

/**
 * The active filters and the number of results, in words: "Showing beginner workshops about Brakes and
 * gears — 1 workshop". The list page shows it above the results and in the browser tab's title, so a
 * screen reader announces it when the page opens.
 */
export function filterSummary(level: Level | null, topicName: string | null, count: number): string {
  const which = level ? `${level} workshops` : topicName ? 'workshops' : 'all workshops'
  const about = topicName ? ` about ${topicName}` : ''
  return `Showing ${which}${about} — ${count} ${count === 1 ? 'workshop' : 'workshops'}`
}
