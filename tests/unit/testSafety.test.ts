import { describe, expect, it } from 'vitest'
import { isThrowAwayTestDatabase } from '../setup/safety'

describe('isThrowAwayTestDatabase (tests that delete users run only on a test database on this computer)', () => {
  it('allows 127.0.0.1 and localhost', () => {
    expect(isThrowAwayTestDatabase('postgres://postgres:postgres@127.0.0.1:55431/postgres', {})).toBe(true)
    expect(isThrowAwayTestDatabase('postgres://postgres:postgres@localhost/postgres', {})).toBe(true)
  })

  it('refuses any other host, a missing address and an address it cannot read', () => {
    expect(isThrowAwayTestDatabase('postgres://u:p@ep-cool-1.eu-central-1.aws.neon.tech/neondb', {})).toBe(false)
    expect(isThrowAwayTestDatabase('postgres://u:p@localhost.example.com/db', {})).toBe(false)
    expect(isThrowAwayTestDatabase(undefined, {})).toBe(false)
    expect(isThrowAwayTestDatabase('not an address', {})).toBe(false)
  })

  it('allows any host when CI is set: the CI database is thrown away after the run', () => {
    expect(isThrowAwayTestDatabase('postgres://postgres:postgres@postgres:5432/postgres', { CI: 'true' })).toBe(true)
  })
})
