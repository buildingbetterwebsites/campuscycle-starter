import { describe, expect, it } from 'vitest'
import { MIGRATIONS_VERIFIED, migrationVerified } from '../../scripts/lib/migrationResult.mjs'

describe('migrationVerified', () => {
  it('is true only for exit code 0 AND the exact marker line', () => {
    expect(migrationVerified({ status: 0, stdout: `Migrating: a\n${MIGRATIONS_VERIFIED}\n` })).toBe(true)
    expect(migrationVerified({ status: 0, stdout: `Migrating: a\r\n${MIGRATIONS_VERIFIED}\r\n` })).toBe(true)
  })

  it('is false for exit code 0 without the marker: the silent early exit seen in the account test', () => {
    expect(migrationVerified({ status: 0, stdout: '' })).toBe(false)
    expect(migrationVerified({ status: 0, stdout: 'Migrating: a\n' })).toBe(false)
  })

  it('is false for the marker with a failing, missing or timed-out exit code', () => {
    expect(migrationVerified({ status: 1, stdout: `${MIGRATIONS_VERIFIED}\n` })).toBe(false)
    // spawnSync reports `status: null` when it had to stop the process (for example after its timeout).
    expect(migrationVerified({ status: null, stdout: `${MIGRATIONS_VERIFIED}\n` })).toBe(false)
  })

  it('does not accept the marker text inside a longer line', () => {
    expect(migrationVerified({ status: 0, stdout: `not ${MIGRATIONS_VERIFIED}\n` })).toBe(false)
    expect(migrationVerified({ status: 0, stdout: `${MIGRATIONS_VERIFIED} (not really)\n` })).toBe(false)
  })

  it('is false when there is no output at all', () => {
    expect(migrationVerified({ status: 0, stdout: undefined })).toBe(false)
  })
})
