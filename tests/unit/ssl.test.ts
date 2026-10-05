import { describe, expect, it } from 'vitest'
import { withVerifiedSsl } from '../../scripts/lib/ssl.mjs'

// Neon's own connection strings (and some Vercel Storage ones) carry `sslmode=require` or
// `sslmode=prefer`, either of which makes `pg`'s connection-string parser print a "SECURITY WARNING"
// about on every connection. This is the shared transform that fixes it, wherever a real DATABASE_URL
// is actually connected with (scripts/lib/marker.mjs and src/payload.config.ts both use it) - a plain
// unit test here, since neither the PGlite test database nor the Vitest environment ever uses SSL.
describe('withVerifiedSsl', () => {
  it('turns sslmode=require into sslmode=verify-full', () => {
    expect(withVerifiedSsl('postgres://u:p@ep-a-pooler.eu-central-1.aws.neon.tech/db?sslmode=require')).toBe(
      'postgres://u:p@ep-a-pooler.eu-central-1.aws.neon.tech/db?sslmode=verify-full',
    )
  })

  it('turns sslmode=prefer into sslmode=verify-full', () => {
    expect(withVerifiedSsl('postgres://u:p@ep-a-pooler.eu-central-1.aws.neon.tech/db?sslmode=prefer')).toBe(
      'postgres://u:p@ep-a-pooler.eu-central-1.aws.neon.tech/db?sslmode=verify-full',
    )
  })

  it('keeps every other query parameter untouched', () => {
    expect(
      withVerifiedSsl(
        'postgres://u:p@ep-a-pooler.eu-central-1.aws.neon.tech/db?foo=bar&sslmode=require&channel_binding=require',
      ),
    ).toBe('postgres://u:p@ep-a-pooler.eu-central-1.aws.neon.tech/db?foo=bar&sslmode=verify-full&channel_binding=require')
  })

  it('leaves a url with no sslmode alone', () => {
    const url = 'postgres://postgres:postgres@127.0.0.1:5432/postgres'
    expect(withVerifiedSsl(url)).toBe(url)
  })

  it('leaves an already-verify-full url alone', () => {
    const url = 'postgres://u:p@ep-a.eu-central-1.aws.neon.tech/db?sslmode=verify-full'
    expect(withVerifiedSsl(url)).toBe(url)
  })

  it('leaves an empty string alone (DATABASE_URL not set yet)', () => {
    expect(withVerifiedSsl('')).toBe('')
  })
})
