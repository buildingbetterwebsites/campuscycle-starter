// Turning the filters from the address into a question for the database: a Payload `where`.
//
// Why a separate file: the page then only asks for "the workshops that match these filters", and this
// small function can be tested without a database (tests/unit/filters.test.ts).
import type { Where } from 'payload'
import type { Filters } from './filters'

/**
 * Which workshops match the filters.
 *
 * topicId is the id of the topic whose slug is in the address, or null when no topic has that slug.
 * An unknown slug matches no workshop at all (the list is then empty, with a way to clear the
 * filters). It is not a "page not found": the address may come from an old shared link, and the
 * workshop list itself still exists.
 */
export function workshopWhere(filters: Pick<Filters, 'topic' | 'level'>, topicId: number | null): Where {
  const conditions: Where[] = []
  if (filters.topic) {
    // "topics" holds several topics per workshop (the many-to-many); `in` matches a workshop when the
    // topic is one of them. Every workshop has an id, so "has no id" matches none of them.
    conditions.push(topicId === null ? { id: { exists: false } } : { topics: { in: [topicId] } })
  }
  if (filters.level) conditions.push({ level: { equals: filters.level } })
  // No filters: an empty `where` matches every workshop.
  return conditions.length ? { and: conditions } : {}
}
