// What this is: the two filters above the workshop list, topic and level, in a plain form. method="get"
// puts the choices in the address (/workshops?topic=…&level=…), so it works without JavaScript, a
// filtered list can be shared, and Back returns to it. Nothing happens until "Apply filters": the page
// does not jump while someone is still choosing, and the keyboard focus stays where it is.
//
// What to change for your own site: the labels, and the LEVELS in src/tasks/find-workshop/filters.ts.
import type { Topic } from '@/payload-types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { levelLabel } from '@/lib/format'
import { LEVELS, type Filters } from '@/tasks/find-workshop/filters'
import { ButtonLink } from './ButtonLink'

type WorkshopFiltersProps = {
  topics: Pick<Topic, 'id' | 'name' | 'slug'>[]
  filters: Pick<Filters, 'topic' | 'level'>
}

export function WorkshopFilters({ topics, filters }: WorkshopFiltersProps) {
  const filtered = Boolean(filters.topic || filters.level)
  return (
    <form
      method="get"
      // #results: after "Apply filters" the browser scrolls down to the results, so on a phone the
      // user sees them at once instead of the top of the page again. The filters still go in the
      // address before the #: /workshops?topic=…&level=…#results.
      action="/workshops#results"
      aria-label="Filter the workshops"
      className="grid gap-5 rounded-panel bg-blue-tint p-5 sm:p-6 md:grid-cols-[1fr_1fr_auto] md:items-end"
    >
      <div className="grid gap-2">
        <Label htmlFor="filter-topic">Topic</Label>
        <NativeSelect id="filter-topic" name="topic" defaultValue={filters.topic ?? ''}>
          <NativeSelectOption value="">All topics</NativeSelectOption>
          {topics.map((topic) => (
            <NativeSelectOption key={topic.id} value={topic.slug}>{topic.name}</NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="filter-level">Level</Label>
        <NativeSelect id="filter-level" name="level" defaultValue={filters.level ?? ''}>
          <NativeSelectOption value="">All levels</NativeSelectOption>
          {LEVELS.map((level) => (
            <NativeSelectOption key={level} value={level}>{levelLabel(level)}</NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">Apply filters</Button>
        {filtered && <ButtonLink href="/workshops" variant="secondary">Clear filters</ButtonLink>}
      </div>
    </form>
  )
}
