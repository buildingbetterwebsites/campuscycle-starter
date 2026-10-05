import { describe, expect, it } from 'vitest'
import { MIGRATIONS_VERIFIED } from '../../scripts/lib/migrationResult.mjs'
import { SEED_VERIFIED, seedVerified } from '../../scripts/lib/seedResult.mjs'

// The seed runner (scripts/seed.mjs) is judged by the same rule as the migration runner: exit code 0
// AND its own final line. Its line is a different one, so one runner's success can never count for
// the other.
describe('seedVerified', () => {
  it('is true only for exit code 0 AND the exact seed line', () => {
    expect(seedVerified({ status: 0, stdout: `SEED: created 20, kept 0\n${SEED_VERIFIED}\n` })).toBe(true)
    expect(seedVerified({ status: 0, stdout: `SEED: created 0, kept 20\r\n${SEED_VERIFIED}\r\n` })).toBe(true)
  })

  it('is false for exit code 0 without the line: a runner that stopped early', () => {
    expect(seedVerified({ status: 0, stdout: '' })).toBe(false)
    expect(seedVerified({ status: 0, stdout: 'SEED: created 20, kept 0\n' })).toBe(false)
    expect(seedVerified({ status: 0, stdout: undefined })).toBe(false)
  })

  it('is false for the line with a failing or missing exit code', () => {
    expect(seedVerified({ status: 1, stdout: `${SEED_VERIFIED}\n` })).toBe(false)
    expect(seedVerified({ status: null, stdout: `${SEED_VERIFIED}\n` })).toBe(false)
  })

  it('does not accept the line inside a longer line, or the migration runner\'s line', () => {
    expect(seedVerified({ status: 0, stdout: `not ${SEED_VERIFIED}\n` })).toBe(false)
    expect(seedVerified({ status: 0, stdout: `${MIGRATIONS_VERIFIED}\n` })).toBe(false)
  })
})
