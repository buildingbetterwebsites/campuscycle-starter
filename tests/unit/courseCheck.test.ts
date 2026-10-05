// The course check's rules without the database (src/lib/courseCheck.ts), as agreed in
// docs/COURSE-CHECK-CONTRACT.md.
import { describe, expect, it } from 'vitest'
import {
  answer,
  containsToken,
  countRepairs,
  hasRepairsRelation,
  hasWhatToBringList,
  MAX_ITEM_LENGTH,
  MAX_ITEMS,
  readCode,
  readWhatToBring,
  type FieldShape,
} from '@/lib/courseCheck'

describe('readCode', () => {
  it('accepts the personal code (BW- and 4 letters or digits) in any case, with spaces around', () => {
    expect(readCode(' bw-7f3k ')).toEqual({ kind: 'code', code: 'BW-7F3K' })
    expect(readCode('BW-0000')).toEqual({ kind: 'code', code: 'BW-0000' })
  })

  it('accepts 4 to 8 letters and digits in any case, with spaces around', () => {
    expect(readCode(' k7q2 ')).toEqual({ kind: 'code', code: 'K7Q2' })
    expect(readCode('K7Q2K7Q2')).toEqual({ kind: 'code', code: 'K7Q2K7Q2' })
  })

  it('treats no code, an empty code and only spaces as "no code": the answer for the whole site', () => {
    for (const none of [null, '', '   ', '\t\n']) expect(readCode(none), JSON.stringify(none)).toEqual({ kind: 'none' })
  })

  it('refuses anything else', () => {
    const bad = [
      'K7',
      'K7Q2K7Q2K',
      '<b>K7Q2</b>',
      'K7 Q2',
      'x'.repeat(40),
      'BW-7F3',
      'BW-7F3KK',
      'BW_7F3K',
      'BW-7F3K-2',
      '-K7Q2',
      'K7Q2.',
      // The long s: JavaScript capitalises it to S, but it is not one of the letters A to Z.
      'bw-7fſk',
      // The Kelvin sign looks like a K.
      'BW-7F3K',
    ]
    for (const value of bad) expect(readCode(value), value).toEqual({ kind: 'invalid' })
  })
})

describe('containsToken', () => {
  it('finds the code as a whole token, ignoring case', () => {
    expect(containsToken('Code BW-7F3K.', 'BW-7F3K')).toBe(true)
    expect(containsToken('Saturday repair clinic. Code BW-7F3K.', 'BW-7F3K')).toBe(true)
    expect(containsToken('(bw-7f3k)', 'BW-7F3K')).toBe(true)
    expect(containsToken('BW-7F3K', 'BW-7F3K')).toBe(true)
    expect(containsToken('Code k7q2.', 'K7Q2')).toBe(true)
    expect(containsToken('line one\nK7Q2\nline three', 'K7Q2')).toBe(true)
  })

  it('does not find it next to a letter, a digit or a hyphen', () => {
    expect(containsToken('BW-7F3KX', 'BW-7F3K')).toBe(false)
    expect(containsToken('XBW-7F3K', 'BW-7F3K')).toBe(false)
    expect(containsToken('BW-7F3K-2', 'BW-7F3K')).toBe(false)
    // A hyphen on either side blocks the match, as the course's checker expects.
    expect(containsToken('BW-7F3K-X', 'BW-7F3K')).toBe(false)
    expect(containsToken('Code -BW-7F3K.', 'BW-7F3K')).toBe(false)
    expect(containsToken('1BW-7F3K', 'BW-7F3K')).toBe(false)
    expect(containsToken('Code K7Q2X', 'K7Q2')).toBe(false)
    expect(containsToken('Code K7Q2-', 'K7Q2')).toBe(false)
    expect(containsToken('Code 9K7Q2', 'K7Q2')).toBe(false)
    // A letter of another language is a letter too.
    expect(containsToken('Code éK7Q2', 'K7Q2')).toBe(false)
  })

  it('finds it again after a near miss in the same text', () => {
    expect(containsToken('BW-7F3KX, and then BW-7F3K', 'BW-7F3K')).toBe(true)
  })

  it('does not take a look-alike letter for one of the code', () => {
    expect(containsToken('Code BW-7F3K.', 'BW-7F3K')).toBe(false)
  })
})

const text = (name: string): FieldShape => ({ name, type: 'text' })

describe('the W5 list (clinics.whatToBring)', () => {
  const list: FieldShape = { name: 'whatToBring', type: 'array', flattenedFields: [{ name: 'id', type: 'text' }, text('item')] }

  it('is the agreed shape only as an array with a text field "item"', () => {
    expect(hasWhatToBringList([text('summary'), list])).toBe(true)
    expect(hasWhatToBringList([text('summary')])).toBe(false)
    expect(hasWhatToBringList([{ name: 'whatToBring', type: 'textarea' }])).toBe(false)
    expect(hasWhatToBringList([{ name: 'whatToBring', type: 'group', flattenedFields: [text('item')] }])).toBe(false)
    expect(hasWhatToBringList([{ name: 'whatToBring', type: 'array', flattenedFields: [text('thing')] }])).toBe(false)
    expect(hasWhatToBringList([{ name: 'whatToBring', type: 'array', flattenedFields: [{ name: 'item', type: 'textarea' }] }])).toBe(false)
  })

  it('reads the items in order, leaving out empty ones', () => {
    const clinic = { whatToBring: [{ id: 'a', item: 'your bike' }, { id: 'b', item: '  ' }, { id: 'c', item: 'a lock' }, { id: 'd' }] }
    expect(readWhatToBring(clinic, [list])).toEqual(['your bike', 'a lock'])
  })

  // Half of a character: a first half (high surrogate) with no second half after it, or the reverse.
  const LONE_HALF = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
  const bike = '\u{1F6B2}'
  const one = (item: string) => (readWhatToBring({ whatToBring: [{ item }] }, [list]) ?? [])[0]

  it('cuts each item to a length of 200, as JavaScript counts it', () => {
    expect([MAX_ITEMS, MAX_ITEM_LENGTH]).toEqual([50, 200])
    expect(one('a'.repeat(201))).toBe('a'.repeat(200))
    expect(one('a'.repeat(200))).toBe('a'.repeat(200))
  })

  it('never cuts a character such as an emoji in half', () => {
    // 150 emoji are 300 code units: 100 whole emoji are left, and no half of one.
    const emoji = one(bike.repeat(150))
    expect(emoji.length).toBeLessThanOrEqual(200)
    expect(emoji).toBe(bike.repeat(100))
    expect(LONE_HALF.test(emoji)).toBe(false)
    // 199 letters and an emoji (201 units): the cut would split the emoji, so it goes whole.
    const mixed = one('a'.repeat(199) + bike)
    expect(mixed).toBe('a'.repeat(199))
    expect(mixed.length).toBe(199)
    expect(LONE_HALF.test(mixed)).toBe(false)
    // 198 letters and an emoji are exactly 200 units: kept as they are.
    expect(one('a'.repeat(198) + bike)).toBe('a'.repeat(198) + bike)
  })

  it('answers at most the first 50 items, after leaving out the empty ones', () => {
    const items = Array.from({ length: 51 }, (_, i) => ({ item: `thing ${i + 1}` }))
    const first50 = items.slice(0, 50).map((row) => row.item)
    expect(readWhatToBring({ whatToBring: items }, [list])).toEqual(first50)
    // Five spaces-only rows first: they do not count, so items 1 to 50 still all come back.
    const withBlanks = [...Array.from({ length: 5 }, () => ({ item: '   ' })), ...items]
    expect(readWhatToBring({ whatToBring: withBlanks }, [list])).toEqual(first50)
  })

  it('answers [] for an existing list with no rows, and null without the list', () => {
    expect(readWhatToBring({ whatToBring: [] }, [list])).toEqual([])
    expect(readWhatToBring({}, [list])).toEqual([])
    expect(readWhatToBring({ whatToBring: [{ item: 'your bike' }] }, [text('summary')])).toBeNull()
    expect(readWhatToBring({ whatToBring: 'your bike, a lock' }, [{ name: 'whatToBring', type: 'textarea' }])).toBeNull()
  })
})

describe('the W6 link (bookings.repairs)', () => {
  it('is the agreed shape only as a relationship to repairs with hasMany: true', () => {
    expect(hasRepairsRelation([text('name'), { name: 'repairs', type: 'relationship', relationTo: 'repairs', hasMany: true }])).toBe(true)
    expect(hasRepairsRelation([text('name')])).toBe(false)
    expect(hasRepairsRelation([{ name: 'repairs', type: 'relationship', relationTo: 'repairs', hasMany: false }])).toBe(false)
    expect(hasRepairsRelation([{ name: 'repairs', type: 'relationship', relationTo: 'repairs' }])).toBe(false)
    expect(hasRepairsRelation([{ name: 'repairs', type: 'relationship', relationTo: 'workshops', hasMany: true }])).toBe(false)
    expect(hasRepairsRelation([{ name: 'repairs', type: 'relationship', relationTo: ['repairs'], hasMany: true }])).toBe(false)
    expect(hasRepairsRelation([{ name: 'repairs', type: 'text', hasMany: true }])).toBe(false)
  })

  it('counts the different repairs a booking links to', () => {
    expect(countRepairs({ repairs: [1, 2] })).toBe(2)
    expect(countRepairs({ repairs: [{ id: 1 }, { id: 2 }, { id: 3 }] })).toBe(3)
    expect(countRepairs({ repairs: [1, 1] })).toBe(1)
    expect(countRepairs({ repairs: [] })).toBe(0)
    expect(countRepairs({ repairs: null })).toBe(0)
    expect(countRepairs({})).toBe(0)
  })
})

describe('answer', () => {
  it('has exactly the three agreed keys', () => {
    expect(Object.keys(answer(true, ['your bike'], false))).toEqual(['clinic', 'whatToBring', 'booking'])
    expect(answer(false, null, false)).toEqual({ clinic: false, whatToBring: null, booking: false })
  })
})
