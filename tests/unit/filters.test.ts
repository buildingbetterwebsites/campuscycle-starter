// The workshop filters, read from the address, without a database: anything can be typed into an
// address, so these check that odd input is left out and never crashes the page.
import { describe, expect, it } from 'vitest'
import { filterQuery, filterSummary, parseFilters } from '@/tasks/find-workshop/filters'
import { workshopWhere } from '@/tasks/find-workshop/queries'
import { formatWhen } from '@/lib/format'

describe('parseFilters', () => {
  it('reads a topic slug and a level', () => {
    expect(parseFilters({ topic: 'brakes-and-gears', level: 'beginner' })).toEqual({ topic: 'brakes-and-gears', level: 'beginner', unknown: [] })
  })
  it('ignores an unknown level and reports it, never throws', () => {
    expect(parseFilters({ level: 'expert' })).toEqual({ topic: null, level: null, unknown: ['level'] })
  })
  it('takes the first value when a parameter repeats, and trims spaces', () => {
    expect(parseFilters({ topic: [' tyres-and-wheels ', 'x'] }).topic).toBe('tyres-and-wheels')
  })
  it('rejects a topic that is not a slug', () => {
    expect(parseFilters({ topic: '<script>' })).toEqual({ topic: null, level: null, unknown: ['topic'] })
  })

  it('treats an empty value as "all": that is what the form sends for All topics and All levels', () => {
    expect(parseFilters({ topic: '', level: '' })).toEqual({ topic: null, level: null, unknown: [] })
  })
  it('reports a part that is not a filter, and still reads the filters', () => {
    expect(parseFilters({ utm_source: 'mail', level: 'intermediate' })).toEqual({ topic: null, level: 'intermediate', unknown: ['utm_source'] })
  })
  it('accepts capitals and spaces around the level and topic', () => {
    expect(parseFilters({ topic: ' Tyres-And-Wheels', level: 'Beginner ' })).toMatchObject({ topic: 'tyres-and-wheels', level: 'beginner' })
  })
  it('never throws on odd input: no parameters, an empty list, a very long topic', () => {
    expect(parseFilters({})).toEqual({ topic: null, level: null, unknown: [] })
    expect(parseFilters({ topic: [], level: undefined })).toEqual({ topic: null, level: null, unknown: [] })
    expect(parseFilters({ topic: 'a'.repeat(500) })).toEqual({ topic: null, level: null, unknown: ['topic'] })
  })
})

describe('workshopWhere', () => {
  it('no filters: every workshop', () => {
    expect(workshopWhere({ topic: null, level: null }, null)).toEqual({})
  })
  it('a topic that exists: the workshops that have it among their topics', () => {
    expect(workshopWhere({ topic: 'brakes-and-gears', level: null }, 7)).toEqual({ and: [{ topics: { in: [7] } }] })
  })
  it('a level: the workshops of that level', () => {
    expect(workshopWhere({ topic: null, level: 'beginner' }, null)).toEqual({ and: [{ level: { equals: 'beginner' } }] })
  })
  it('both: a workshop must match both', () => {
    expect(workshopWhere({ topic: 'brakes-and-gears', level: 'beginner' }, 7)).toEqual({
      and: [{ topics: { in: [7] } }, { level: { equals: 'beginner' } }],
    })
  })
  it('a topic slug that matches no topic: no workshop at all, not every workshop', () => {
    expect(workshopWhere({ topic: 'unknown', level: null }, null)).toEqual({ and: [{ id: { exists: false } }] })
  })
})

describe('the filters in words and in an address', () => {
  it('filterQuery carries only the filters that are set', () => {
    expect(filterQuery({ topic: null, level: null })).toBe('')
    expect(filterQuery({ topic: 'brakes-and-gears', level: 'beginner' })).toBe('?topic=brakes-and-gears&level=beginner')
    expect(filterQuery({ topic: null, level: 'intermediate' })).toBe('?level=intermediate')
  })
  it('filterSummary names the filters and the count', () => {
    expect(filterSummary('beginner', 'Brakes and gears', 1)).toBe('Showing beginner workshops about Brakes and gears — 1 workshop')
    expect(filterSummary(null, null, 4)).toBe('Showing all workshops — 4 workshops')
    expect(filterSummary(null, 'Tyres and wheels', 2)).toBe('Showing workshops about Tyres and wheels — 2 workshops')
    expect(filterSummary('intermediate', null, 2)).toBe('Showing intermediate workshops — 2 workshops')
  })
})

describe('formatWhen', () => {
  it('an end time, a latest end, or neither (never a made-up end)', () => {
    expect(formatWhen({ day: 'Tuesday', startTime: '18:30', endTime: '20:00' })).toBe('Tuesday 18:30–20:00')
    expect(formatWhen({ day: 'Saturday', startTime: '13:00', latestEnd: '15:00' })).toBe('Saturday from 13:00, ends\u00a0by\u00a015:00')
    expect(formatWhen({ day: 'Saturday', startTime: '10:00', endTime: null, latestEnd: null })).toBe('Saturday from 10:00')
  })
})
