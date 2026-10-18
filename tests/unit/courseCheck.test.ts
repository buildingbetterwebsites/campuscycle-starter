// The course check's rules without the database (src/lib/courseCheck.ts), as agreed in
// docs/COURSE-CHECK-CONTRACT.md.
import { describe, expect, it } from 'vitest'
import {
  answer,
  clipName,
  containsToken,
  countRepairs,
  findJoin,
  hasRepairsRelation,
  hasWhatToBringList,
  isOwnCollection,
  manyToManyLinks,
  MAX_ITEM_LENGTH,
  MAX_ITEMS,
  MAX_MANY_TO_MANY,
  MAX_NAME_LENGTH,
  MAX_TEAM_COLLECTIONS,
  newestRecord,
  readCode,
  readInclude,
  readWhatToBring,
  TEAM_SECTION_VERSION,
  teamSection,
  usableNameField,
  type CollectionShape,
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

  it("accepts the course app's team code (T, the team's number, a hyphen and 4 letters or digits) in any case, with spaces around", () => {
    expect(readCode('T29-7G6N')).toEqual({ kind: 'code', code: 'T29-7G6N' })
    expect(readCode(' t07-4qxf ')).toEqual({ kind: 'code', code: 'T07-4QXF' })
    // From team 100 on, the number has three digits.
    expect(readCode('T100-ABCD')).toEqual({ kind: 'code', code: 'T100-ABCD' })
    expect(readCode('T1234-ABCD')).toEqual({ kind: 'code', code: 'T1234-ABCD' })
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
      // Team codes: one digit, five digits, three or five characters after the hyphen, no T, another
      // separator, or more after the code.
      'T2-7G6N',
      'T12345-7G6N',
      'T29-7G6',
      'T29-7G6NX',
      '29-7G6N',
      'T29_7G6N',
      'T29 7G6N',
      'T29-7G6N-2',
      'XT29-7G6N',
      'T2A-7G6N',
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

  it('finds a team code only as a whole token too', () => {
    expect(containsToken('Team T29-7G6N, test booking', 'T29-7G6N')).toBe(true)
    expect(containsToken('© 2026 Campus Cycle · t29-7g6n', 'T29-7G6N')).toBe(true)
    expect(containsToken('T29-7G6N', 'T29-7G6N')).toBe(true)
    expect(containsToken('Team T29-7G6NX', 'T29-7G6N')).toBe(false)
    expect(containsToken('Team XT29-7G6N', 'T29-7G6N')).toBe(false)
    expect(containsToken('Team 1T29-7G6N', 'T29-7G6N')).toBe(false)
    expect(containsToken('Team T29-7G6N-2', 'T29-7G6N')).toBe(false)
    expect(containsToken('Team -T29-7G6N', 'T29-7G6N')).toBe(false)
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

// The team section (?include=team), docs/COURSE-CHECK-CONTRACT.md, "The team section".
describe('readInclude', () => {
  it('asks for the team section only with include=team, in any letter case, with spaces around', () => {
    for (const yes of ['team', 'TEAM', ' Team ']) expect(readInclude(yes), yes).toBe(true)
    for (const no of [null, '', 'teams', 'team,all', 'all', '1']) expect(readInclude(no), String(no)).toBe(false)
  })
})

describe('isOwnCollection', () => {
  it("leaves out Payload's own collections, accounts, uploads, pages and the throttle", () => {
    for (const slug of ['topics', 'workshops', 'clinics', 'timeSlots', 'bookings', 'repairs', 'events', 'tickets']) {
      expect(isOwnCollection({ slug }), slug).toBe(true)
    }
    expect(isOwnCollection({ slug: 'users', auth: { tokenExpiration: 7200 } })).toBe(false)
    expect(isOwnCollection({ slug: 'members', auth: {} })).toBe(false)
    expect(isOwnCollection({ slug: 'volunteers', auth: true })).toBe(false)
    expect(isOwnCollection({ slug: 'media', upload: { staticDir: 'media' } })).toBe(false)
    expect(isOwnCollection({ slug: 'documents', upload: true })).toBe(false)
    for (const slug of ['pages', 'throttle', 'payload-preferences', 'payload-migrations', 'payload-locked-documents', 'payload-kv']) {
      expect(isOwnCollection({ slug }), slug).toBe(false)
    }
  })
})

describe('clipName', () => {
  it('cuts to 64 characters, never splitting a character', () => {
    expect(clipName('bookings')).toBe('bookings')
    expect(clipName('x'.repeat(100))).toBe('x'.repeat(MAX_NAME_LENGTH))
    const cut = clipName('a'.repeat(63) + '\u{1F6B2}')
    expect(cut).toBe('a'.repeat(63))
  })
})

const relation = (name: string, relationTo: unknown, hasMany: unknown = true): FieldShape => ({ name, type: 'relationship', relationTo, hasMany })
const join = (name: string, collection: unknown, on: string): FieldShape => ({ name, type: 'join', collection, on })
const coll = (slug: string, flattenedFields: FieldShape[]): CollectionShape => ({ slug, flattenedFields })

describe('manyToManyLinks', () => {
  it('lists every hasMany relationship, with the join on the other side or null', () => {
    const collections = [
      coll('workshops', [text('name'), relation('topics', 'topics')]),
      coll('topics', [text('name'), join('workshops', 'workshops', 'topics')]),
      coll('bookings', [relation('timeSlot', 'timeSlots', false), relation('repairs', 'repairs')]),
      coll('repairs', [text('name')]),
      coll('timeSlots', [join('bookings', 'bookings', 'timeSlot')]),
    ]
    expect(manyToManyLinks(collections)).toEqual([
      { from: 'workshops', field: 'topics', to: 'topics', join: 'workshops' },
      { from: 'bookings', field: 'repairs', to: 'repairs', join: null },
    ])
  })

  it('finds them inside named groups and tabs, by dotted path, and not inside lists', () => {
    const collections = [
      coll('events', [
        { name: 'details', type: 'group', flattenedFields: [relation('speakers', 'speakers')] },
        { name: 'more', type: 'tab', flattenedFields: [relation('sponsors', 'sponsors')] },
        { name: 'rows', type: 'array', flattenedFields: [relation('guests', 'speakers')] },
      ]),
      coll('speakers', [{ name: 'about', type: 'group', flattenedFields: [join('events', 'events', 'details.speakers')] }]),
      coll('sponsors', [join('events', 'events', 'speakers')]),
    ]
    expect(manyToManyLinks(collections)).toEqual([
      { from: 'events', field: 'details.speakers', to: 'speakers', join: 'about.events' },
      // The sponsors' join reads another field (`on: 'speakers'`), so it is not this link's other side.
      { from: 'events', field: 'more.sponsors', to: 'sponsors', join: null },
    ])
  })

  it('gives one link per collection of a relationship to several, and reads a join on several collections', () => {
    const collections = [
      coll('posts', [relation('tags', ['topics', 'places'])]),
      coll('topics', [join('posts', ['posts', 'pages'], 'tags')]),
      coll('places', []),
    ]
    expect(manyToManyLinks(collections)).toEqual([
      { from: 'posts', field: 'tags', to: 'topics', join: 'posts' },
      { from: 'posts', field: 'tags', to: 'places', join: null },
    ])
  })

  it("leaves out Payload's own collections, and lists at most 30", () => {
    expect(manyToManyLinks([coll('payload-locked-documents', [relation('document', 'topics')])])).toEqual([])
    const many = Array.from({ length: 40 }, (_, i) => relation(`link${i}`, 'topics'))
    expect(manyToManyLinks([coll('posts', many), coll('topics', [])])).toHaveLength(MAX_MANY_TO_MANY)
  })

  it('findJoin needs the same collection and the same field', () => {
    const topics = coll('topics', [join('workshops', 'workshops', 'topics')])
    expect(findJoin(topics, 'workshops', 'topics')).toBe('workshops')
    expect(findJoin(topics, 'events', 'topics')).toBeNull()
    expect(findJoin(topics, 'workshops', 'themes')).toBeNull()
  })
})

describe('usableNameField', () => {
  it('is the named field only when it is a top-level text, textarea or email field', () => {
    const fields: FieldShape[] = [text('name'), { name: 'note', type: 'textarea' }, { name: 'email', type: 'email' }, { name: 'places', type: 'number' }]
    expect(usableNameField(fields, 'name')).toBe('name')
    expect(usableNameField(fields, 'note')).toBe('note')
    expect(usableNameField(fields, 'email')).toBe('email')
    expect(usableNameField(fields, 'places')).toBeNull()
    expect(usableNameField(fields, 'title')).toBeNull()
    expect(usableNameField(fields, undefined)).toBeNull()
  })
})

describe('newestRecord', () => {
  it('keeps only the id, as text, and the creation time', () => {
    const doc = { id: 12, createdAt: '2026-10-18T09:12:44.120Z', name: 'Mina Peeters', email: 'mina@example.com' }
    expect(newestRecord(doc)).toEqual({ id: '12', createdAt: '2026-10-18T09:12:44.120Z' })
    expect(newestRecord({ id: 'abc', createdAt: new Date('2026-10-18T09:00:00Z') })).toEqual({ id: 'abc', createdAt: '2026-10-18T09:00:00.000Z' })
    expect(newestRecord({ id: 3 })).toEqual({ id: '3', createdAt: null })
    expect(newestRecord({ id: 3, createdAt: 'not a time' })).toEqual({ id: '3', createdAt: null })
    expect(newestRecord({ id: 'x'.repeat(100) }).id).toHaveLength(MAX_NAME_LENGTH)
  })
})

describe('teamSection', () => {
  it('has exactly the agreed keys, version first, and nothing else a caller passes', () => {
    const leaky = {
      slug: 'bookings', count: 2, fromTemplate: true, name: 'Mina Peeters',
    } as unknown as Parameters<typeof teamSection>[0][number]
    const section = teamSection(
      [leaky],
      [{ from: 'bookings', field: 'repairs', to: 'repairs', join: 'bookings', email: 'mina@example.com' } as never],
      { collection: 'bookings', status: 'ok', codeField: 'name', newest: { id: '7', createdAt: null, name: 'Mina' } as never, note: 'x' } as never,
    )
    expect(section).toEqual({
      version: TEAM_SECTION_VERSION,
      collections: [{ slug: 'bookings', count: 2, fromTemplate: true }],
      manyToMany: [{ from: 'bookings', field: 'repairs', to: 'repairs', join: 'bookings' }],
      transactional: { collection: 'bookings', status: 'ok', codeField: 'name', newest: { id: '7', createdAt: null } },
    })
    expect(Object.keys(section)).toEqual(['version', 'collections', 'manyToMany', 'transactional'])
    expect(TEAM_SECTION_VERSION).toBe(1)
  })

  it('lists at most 30 collections', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ slug: `c${i}`, count: 0, fromTemplate: false }))
    const none = { collection: 'bookings', status: 'missing' as const, codeField: null, newest: null }
    expect(teamSection(many, [], none).collections).toHaveLength(MAX_TEAM_COLLECTIONS)
  })
})
