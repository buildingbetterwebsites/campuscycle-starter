// The small helpers of example task 2, "book a clinic slot", that need no database: the trap field,
// the request's address, the signed confirmation link, and how a slot's time and places read.
import { describe, expect, it } from 'vitest'
import { clientKey, isTrapFilled } from '../../src/tasks/book-slot/guards'
import { bookingIdFromRef, bookingRef } from '../../src/tasks/book-slot/receipt'
import { formatSlotTime, placesLabel } from '../../src/lib/format'

process.env.PAYLOAD_SECRET ??= 'test-secret-0123456789-0123456789'

const formWith = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.append(name, value)
  return data
}

describe('the trap field', () => {
  it('counts as filled only when it holds something other than spaces', () => {
    expect(isTrapFilled(formWith({ name: 'Test Person' }))).toBe(false)
    expect(isTrapFilled(formWith({ extra: '' }))).toBe(false)
    expect(isTrapFilled(formWith({ extra: '   ' }))).toBe(false)
    expect(isTrapFilled(formWith({ extra: 'https://spam.example' }))).toBe(true)
  })
})

describe('the address a request came from', () => {
  it('is the first x-forwarded-for entry, trimmed, or "unknown"', () => {
    expect(clientKey(new Headers({ 'x-forwarded-for': ' 203.0.113.7 , 10.0.0.1' }))).toBe('203.0.113.7')
    expect(clientKey(new Headers({ 'x-forwarded-for': '2001:db8::1' }))).toBe('2001:db8::1')
    expect(clientKey(new Headers({ 'x-forwarded-for': ' , 10.0.0.1' }))).toBe('unknown')
    expect(clientKey(new Headers())).toBe('unknown')
  })
})

describe('the signed confirmation link', () => {
  it('reads back its own booking id, and nothing from a changed or made-up link', () => {
    const ref = bookingRef(42)
    expect(ref).toMatch(/^42\.[0-9a-f]{32}$/)
    expect(bookingIdFromRef(ref)).toBe(42)
    const [, signature] = ref.split('.')
    expect(bookingIdFromRef(`43.${signature}`)).toBeNull()
    expect(bookingIdFromRef(`42.${signature.slice(0, -1)}${signature.endsWith('0') ? '1' : '0'}`)).toBeNull()
    expect(bookingIdFromRef(`42.${signature.toUpperCase()}`)).toBeNull()
    for (const odd of [undefined, '', '42', `42.${signature}.1`, ['42', signature], `-1.${signature}`]) {
      expect(bookingIdFromRef(odd)).toBeNull()
    }
  })
})

describe("a slot's time and places, as users read them", () => {
  it('shows Brussels time on both sides of the change to winter time (25 October 2026)', () => {
    // Summer time: Brussels is 2 hours ahead of UTC.
    expect(formatSlotTime('2026-10-10T13:00:00Z')).toBe('Saturday 10 October, 15:00')
    expect(formatSlotTime('2026-10-24T13:30:00Z')).toBe('Saturday 24 October, 15:30')
    // Winter time from 25 October: 1 hour ahead, so 15:00 in Brussels is 14:00 UTC.
    expect(formatSlotTime('2026-10-31T14:00:00Z')).toBe('Saturday 31 October, 15:00')
    expect(formatSlotTime(new Date('2026-10-31T15:30:00Z'))).toBe('Saturday 31 October, 16:30')
  })

  it('says how many places are left in words, and "Full" for none', () => {
    expect(placesLabel(2)).toBe('2 places left')
    expect(placesLabel(1)).toBe('1 place left')
    expect(placesLabel(0)).toBe('Full')
    expect(placesLabel(-1)).toBe('Full')
  })
})
