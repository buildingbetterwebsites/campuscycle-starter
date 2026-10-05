// The error look of a form field: it may never rest on the coral colour alone, because coral is too
// light against white to be seen by everyone (it is below the 3:1 a field's edge needs).
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FieldError } from '@/components/site/FieldError'
import { fieldClasses, Input } from '@/components/ui/input'

describe('a field with an error', () => {
  it('keeps its navy border (only thicker) and gets the coral wash, never a coral border', () => {
    expect(fieldClasses).toContain('border-ink')
    expect(fieldClasses).toContain('aria-invalid:border-2')
    expect(fieldClasses).toContain('aria-invalid:bg-error-wash')
    expect(fieldClasses).not.toMatch(/aria-invalid:border-(error|coral)/)
  })

  it('says "Error" in words under the field, linked to it for screen readers', () => {
    const html = renderToString(
      <>
        <Input id="email" aria-invalid="true" aria-describedby="email-error" />
        <FieldError id="email-error">Enter an e-mail address with an @ in it.</FieldError>
      </>,
    )
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="email-error"')
    expect(html).toMatch(/<p id="email-error"[^>]*>.*<strong>Error: <\/strong>Enter an e-mail address with an @ in it\.<\/span><\/p>/)
    // The icon is decoration: the word carries the meaning.
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/)
  })
})
