// The "no migration missing" check (scripts/ci/migration-missing.mjs): its decision, on what Payload's
// migration tool really printed in each case (captured on 5 October 2026 with Payload 3.90.2, by
// changing the repairs collection and running the check).
import { describe, expect, it } from 'vitest'
import {
  decideMigrationCheck,
  MISSING_MESSAGE,
  QUESTION_MESSAGE,
  TIME_LIMIT_MS,
  UNSURE_MESSAGE,
} from '../../scripts/ci/migration-missing.mjs'

const ESC = String.fromCharCode(27)
const info = (text: string) => `[09:09:22] ${ESC}[32mINFO${ESC}[39m: ${ESC}[36m${text}${ESC}[39m`
const WARN = `[09:09:22] ${ESC}[33mWARN${ESC}[39m: ${ESC}[36mNo email adapter provided. Email will be written to console.${ESC}[39m`

// Nothing to do: the model matches the last committed snapshot.
const NOTHING = [WARN, info('Starting migration: generating UP statements...'), info('Migration UP complete. Generating DOWN statements...'), info('Migration DOWN statements generation complete.'), ''].join('\n')
// A field was added (or removed) and no migration was committed.
const CREATED = [
  WARN,
  info('Starting migration: generating UP statements...'),
  info('Migration UP complete. Generating DOWN statements...'),
  info('Migration DOWN statements generation complete.'),
  info('Migration created at /home/runner/work/site/src/migrations/20261005_070936_ci_check.ts'),
  info('Done.'),
  '',
].join('\n')
const CREATED_FILES = ' M src/migrations/index.ts\n?? src/migrations/20261005_070936_ci_check.json\n?? src/migrations/20261005_070936_ci_check.ts\n'
// A field was renamed: drizzle-kit asks, and with no keyboard the tool stopped with exit code 0.
const RENAME = [
  WARN,
  info('Starting migration: generating UP statements...'),
  `${ESC}[?25l`,
  'Is details column in repairs table created or renamed from another column?',
  '❯ + details               create column',
  '  ~ description › details rename column',
].join('\n')

describe('decideMigrationCheck', () => {
  it('passes when the tool compared everything and created nothing', () => {
    expect(decideMigrationCheck({ status: 0, output: NOTHING, changes: '' })).toEqual({
      ok: true,
      message: 'Migrations: none missing. Every model change has its migration.',
    })
  })

  it('fails when the tool created a migration: one is missing', () => {
    expect(decideMigrationCheck({ status: 0, output: CREATED, changes: CREATED_FILES })).toEqual({ ok: false, message: MISSING_MESSAGE })
    // Whatever else happened: a new file in src/migrations always means a missing migration.
    expect(decideMigrationCheck({ status: 1, output: '', changes: '?? src/migrations/x_ci_check.ts\n' }).message).toBe(MISSING_MESSAGE)
    expect(MISSING_MESSAGE).toBe(
      'A model change has no migration: run npm run migrate:create -- <name> on your own computer and commit the new files.',
    )
  })

  it('fails when the tool asked a question, even though it stopped with exit code 0', () => {
    expect(decideMigrationCheck({ status: 0, output: RENAME, changes: '' })).toEqual({ ok: false, message: QUESTION_MESSAGE })
    expect(QUESTION_MESSAGE).toBe(
      'The migration tool needs an answer (probably a rename). Create the migration on your own computer: npm run migrate:create -- <name>.',
    )
  })

  it('fails on a non-zero exit code, and when it was stopped after the time limit', () => {
    expect(decideMigrationCheck({ status: 1, output: 'Error: Error creating migration: boom', changes: '' }).message).toBe(QUESTION_MESSAGE)
    expect(decideMigrationCheck({ status: null, output: info('Starting migration: generating UP statements...'), timedOut: true, changes: '' }).message).toBe(QUESTION_MESSAGE)
    expect(TIME_LIMIT_MS).toBe(120_000)
  })

  it('fails closed when the tool ended with exit code 0 but never said it finished comparing', () => {
    // How the account test's silent stop looked: nothing printed at all.
    expect(decideMigrationCheck({ status: 0, output: '', changes: '' })).toEqual({ ok: false, message: UNSURE_MESSAGE })
    // Stopped halfway, after the UP statements.
    const halfway = [WARN, info('Starting migration: generating UP statements...'), info('Migration UP complete. Generating DOWN statements...')].join('\n')
    expect(decideMigrationCheck({ status: 0, output: halfway, changes: '' }).ok).toBe(false)
    // The line must be the tool's own log line, not the words anywhere in some other message.
    expect(decideMigrationCheck({ status: 0, output: 'Migration DOWN statements generation complete. Not really: crashed.', changes: '' }).ok).toBe(false)
  })

  it('reads the output without colour codes, and with Windows line endings', () => {
    expect(decideMigrationCheck({ status: 0, output: NOTHING.replace(/\n/g, '\r\n'), changes: '' }).ok).toBe(true)
    expect(decideMigrationCheck({ status: 0, output: '[09:09:22] INFO: Migration DOWN statements generation complete.\n', changes: '' }).ok).toBe(true)
  })
})
