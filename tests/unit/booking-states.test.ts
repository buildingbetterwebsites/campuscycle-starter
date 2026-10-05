// What the booking form and the clinic pages show when something goes wrong: the box at the top of the
// form (BookingProblem) for each kind of answer, and the clinic pages' last safety net (error.tsx).
import { createElement, isValidElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { BookingProblem } from '../../src/components/site/BookingProblem'
import ClinicError from '../../src/app/(site)/clinics/[slug]/error'

const FULL = 'This slot is full. Choose another time.'
const values = { timeSlot: '', name: 'Test Person', email: 'test@campuscycle.example', note: '' }
// React writes ' as &#x27; and " as &quot; in HTML; turn them back, so the tests compare plain text.
const text = (html: string) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/<!-- -->/g, '')
const box = (result: Parameters<typeof BookingProblem>[0]['result']) => text(renderToString(createElement(BookingProblem, { result })))
// The words a user sees, one string per element that holds text.
const visible = (html: string) => [...html.matchAll(/>([^<>]+)</g)].map(([, words]) => words.trim()).filter(Boolean)

describe('the box at the top of the booking form', () => {
  it('a full slot: the chip, "Your booking was not saved." in bold, and one item linked to the time, said once', () => {
    const html = box({ ok: false, message: FULL, field: 'timeSlot', errors: { timeSlot: FULL }, values })
    expect(visible(html)).toEqual(['Not saved', 'Your booking was not saved.', FULL])
    expect(html).toMatch(/<p class="font-semibold">Your booking was not saved\.<\/p>/)
    expect(html).toMatch(new RegExp(`<li><a href="#timeSlot">${FULL.replace(/\./g, '\\.')}</a></li>`))
    expect(html.match(/<li>/g)).toHaveLength(1)
    expect(html).toContain('role="alert"')
  })

  it('field problems, the trap and the server problem keep their sentence as the bold line', () => {
    const fields = box({ ok: false, message: 'Your booking was not saved. Check the 2 fields marked below.', field: 'name', errors: { name: 'Enter your name.', email: 'Enter your e-mail address.' }, values })
    expect(visible(fields)).toEqual(['Not saved', 'Your booking was not saved. Check the 2 fields marked below.', 'Enter your name.', 'Enter your e-mail address.'])
    expect(fields).toContain('href="#name"')
    expect(fields).toContain('href="#email"')
    expect(visible(box({ ok: false, message: 'Your booking was not saved. Please try again.', values }))).toEqual(['Not saved', 'Your booking was not saved. Please try again.'])
    expect(visible(box({ ok: false, message: 'Too many bookings from this device. Try again in an hour.', values }))).toEqual(['Not saved', 'Too many bookings from this device. Try again in an hour.'])
  })

  it('no answer from the server: "Not confirmed", never "Not saved", and how to try again safely', () => {
    const html = box({ ok: false, lost: true, message: 'The server could not be reached.', values })
    expect(visible(html)).toEqual([
      'Not confirmed',
      'We could not reach the server, so we cannot say whether your booking was saved.',
      'Check your internet connection and press "Book this slot" again. You will not be booked twice.',
    ])
    expect(html).not.toContain('Not saved')
  })
})

describe("the clinic pages' last safety net (error.tsx)", () => {
  // The button inside the page: the first element in the tree that has an onClick.
  function findClick(node: ReactNode): (() => void) | undefined {
    if (!isValidElement(node)) return Array.isArray(node) ? node.map(findClick).find(Boolean) : undefined
    const props = node.props as { onClick?: () => void; children?: ReactNode }
    return props.onClick ?? findClick(props.children)
  }

  it('says what happened in plain words, offers Try again and a way to all repair clinics', () => {
    const page = ClinicError({ error: new Error('secret detail'), retry: () => undefined })
    const html = text(renderToString(page))
    expect(html).toMatch(/<h1[^>]*>This page could not be shown<\/h1>/)
    expect(html).toContain('Something went wrong while showing this page. Try again, or go back to all repair clinics.')
    expect(html).toMatch(/<button[^>]*>Try again<\/button>/)
    expect(html).toMatch(/<a[^>]*href="\/clinics"[^>]*>All repair clinics<\/a>/)
    expect(html).not.toContain('secret detail')
  })

  it('"Try again" asks for the page again', () => {
    const retry = vi.fn()
    findClick(ClinicError({ error: new Error('x'), retry }))?.()
    expect(retry).toHaveBeenCalledTimes(1)
  })
})
