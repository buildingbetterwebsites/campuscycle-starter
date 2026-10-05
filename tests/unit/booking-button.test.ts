// The booking form's button (BookingSubmitButton): "Book this slot", and "Saving your booking…" while
// the form is being sent, when it cannot be pressed again. The course quotes the pending text, so it is
// pinned here word for word. useFormStatus only knows about a form that is really being sent, which a
// render on the server never is: the test says itself whether the form is pending.
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const status = vi.hoisted(() => ({ pending: false }))
vi.mock('react-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-dom')>()),
  useFormStatus: () => ({ pending: status.pending }),
}))

import { BookingSubmitButton } from '../../src/components/site/BookingSubmitButton'

const render = () => renderToString(createElement(BookingSubmitButton)).replace(/<!-- -->/g, '')

describe("the booking form's button", () => {
  afterEach(() => void (status.pending = false))

  it('says "Book this slot" and can be pressed while nothing is being sent', () => {
    const html = render()
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Book this slot<\/button>/)
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/)
    expect(html).toMatch(/<p role="status" class="sr-only"><\/p>/)
  })

  it('says "Saving your booking…" and cannot be pressed again while the form is sent; screen readers hear it too', () => {
    status.pending = true
    const html = render()
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Saving your booking…<\/button>/)
    expect(html).toMatch(/<p role="status" class="sr-only">Saving your booking…<\/p>/)
  })
})
