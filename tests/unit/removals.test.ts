// The removals check (scripts/ci/removals.mjs): which new migrations remove or rename something, and
// whether the pull request's description says why. The migration texts are in the shape Payload's
// migration tool writes them (src/migrations/*.ts).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checkRemovals, compareWith, findRemovals, newMigrationFiles, upPart } from '../../scripts/ci/removals.mjs'

const migration = (up: string, down: string) => `import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql\`
${up}\`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql\`
${down}\`)
}
`

const TEMPLATE = readFileSync(new URL('../../.github/pull_request_template.md', import.meta.url), 'utf8')
const REASON_HINT = /<!-- Only when a migration in this pull request drops or renames[\s\S]*?-->/
const withReason = (reason: string) => TEMPLATE.replace(REASON_HINT, reason)

describe('findRemovals', () => {
  it('flags DROP COLUMN inside up(), and not the same inside down()', () => {
    expect(findRemovals(migration('   ALTER TABLE "repairs" DROP COLUMN "description";', '   ALTER TABLE "repairs" ADD COLUMN "description" varchar;'))).toEqual([
      'ALTER TABLE "repairs" DROP COLUMN "description"',
    ])
    expect(findRemovals(migration('   ALTER TABLE "workshops" ADD COLUMN "latest_end" varchar;', '   ALTER TABLE "workshops" DROP COLUMN "latest_end";'))).toEqual([])
  })

  it('flags ALTER TABLE … ALTER COLUMN … TYPE in up(), in both of its forms', () => {
    expect(findRemovals(migration('   ALTER TABLE "repairs" ALTER COLUMN "price" SET DATA TYPE varchar;', ''))).toEqual([
      'ALTER TABLE "repairs" ALTER COLUMN "price" SET DATA TYPE varchar',
    ])
    expect(findRemovals(migration('   ALTER TABLE repairs ALTER COLUMN price TYPE numeric USING price::numeric;', ''))).toHaveLength(1)
  })

  it('flags DROP TABLE, DROP TYPE and every RENAME', () => {
    const up = [
      '   DROP TABLE "repairs" CASCADE;',
      '  DROP TYPE "public"."enum_workshops_level";',
      '  ALTER TABLE "repairs" RENAME COLUMN "description" TO "details";',
      '  ALTER TABLE "repairs" RENAME TO "fixes";',
      '  ALTER TYPE "public"."enum_workshops_level" RENAME VALUE \'beginner\' TO \'starter\';',
    ].join('\n')
    expect(findRemovals(migration(up, ''))).toHaveLength(5)
  })

  it('does not flag what only adds, or what holds no data', () => {
    const up = [
      '   CREATE TABLE "fixes" ("id" serial PRIMARY KEY NOT NULL);',
      '  ALTER TABLE "repairs" ADD COLUMN "details" varchar;',
      '  ALTER TYPE "public"."enum_workshops_level" ADD VALUE \'advanced\';',
      '  ALTER TABLE "bookings" DROP CONSTRAINT "bookings_time_slot_id_time_slots_id_fk";',
      '  DROP INDEX "bookings_time_slot_idx";',
      '  ALTER TABLE "repairs" ALTER COLUMN "price" SET NOT NULL;',
    ].join('\n')
    expect(findRemovals(migration(up, '  DROP TABLE "fixes" CASCADE;'))).toEqual([])
  })

  it('reads code, not comments, and is not fooled by lower case', () => {
    const comment = '// We DROP COLUMN nothing here, and RENAME nothing.\n  await db.execute'
    expect(findRemovals(migration('   ALTER TABLE "repairs" ADD COLUMN "details" varchar;', '').replace('await db.execute', comment))).toEqual([])
    expect(findRemovals(migration('   alter table "repairs" drop column "description";', ''))).toEqual(['alter table "repairs" drop column "description"'])
  })

  it('finds nothing in the starter\'s own migrations: they only add', () => {
    for (const name of ['20260928_082604_initial', '20260928_151841_content_model', '20261004_165222_site_facts', '20261004_173034_latest_end', '20261004_205526_booking_request_id', '20261004_222941_members_area']) {
      const source = readFileSync(new URL(`../../src/migrations/${name}.ts`, import.meta.url), 'utf8')
      expect(upPart(source)).toMatch(/^function up/)
      expect(findRemovals(source), name).toEqual([])
    }
  })
})

describe('which migrations are new', () => {
  it('compares with origin/main, else the pull request\'s base commit, else nothing', () => {
    expect(compareWith({ GITHUB_BASE_SHA: 'abc123' }, () => true)).toBe('origin/main')
    expect(compareWith({ GITHUB_BASE_SHA: 'abc123' }, (ref) => ref === 'abc123')).toBe('abc123')
    expect(compareWith({}, () => false)).toBe(null)
    expect(compareWith({ GITHUB_BASE_SHA: 'abc123' }, () => false)).toBe(null)
  })

  it('keeps only the migration files themselves from the list of added files', () => {
    const diff = 'src/migrations/20261010_120000_rename.ts\nsrc/migrations/20261010_120000_rename.json\nsrc/migrations/index.ts\nsrc/collections/Repairs.ts\n'
    expect(newMigrationFiles(diff)).toEqual(['src/migrations/20261010_120000_rename.ts'])
    expect(newMigrationFiles('')).toEqual([])
  })
})

describe('checkRemovals', () => {
  const dropped = [{ file: 'src/migrations/20261010_120000_drop_description.ts', statements: ['ALTER TABLE "repairs" DROP COLUMN "description"'] }]

  it('passes when no new migration removes or renames anything, whatever the description says', () => {
    expect(checkRemovals([], TEMPLATE).ok).toBe(true)
    expect(checkRemovals([{ file: 'src/migrations/x.ts', statements: [] }], '').ok).toBe(true)
  })

  it('fails a flagged migration when "Why this removes or renames" is empty or only the hint, and names the file and statement', () => {
    for (const body of [TEMPLATE, withReason(''), '', null]) {
      const result = checkRemovals(dropped, body)
      expect(result.ok).toBe(false)
      expect(result.message).toContain('src/migrations/20261010_120000_drop_description.ts')
      expect(result.message).toContain('DROP COLUMN "description"')
      expect(result.message).toContain('## Why this removes or renames')
    }
  })

  it('passes a flagged migration with a line under "Why this removes or renames"', () => {
    const result = checkRemovals(dropped, withReason('Repairs no longer have a description: the price list shows only name and price.'))
    expect(result.ok).toBe(true)
    expect(result.message).toContain('DROP COLUMN "description"')
  })

  it('does not count a reason written under another heading', () => {
    const body = TEMPLATE.replace('<!-- What does this change, and why?', 'We drop the description column on purpose.\n<!-- What does this change, and why?')
    expect(checkRemovals(dropped, body).ok).toBe(false)
  })
})
