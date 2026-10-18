// npm run remove-example (scripts/remove-example.mjs) and the migration fix it makes
// (scripts/lib/safeDrops.mjs). The full run, on a fresh copy of the starter, is in the maintainers'
// steps (docs/guides/recipes.md was run that way); these tests pin the parts that can break quietly.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { blockingFiles, PATCH, patchFiles, PHOTOS, PULL_REQUEST_NOTE } from '../../scripts/remove-example.mjs'
import { safeDrops } from '../../scripts/lib/safeDrops.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const patchText = readFileSync(path.join(root, PATCH), 'utf8')
const git = (args: string[]) => spawnSync('git', args, { cwd: root, encoding: 'utf8' })

// up() as Payload's migrate:create wrote it when the three collections were removed (shortened).
const GENERATED = `import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql\`
   ALTER TABLE "topics" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "workshops_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "topics" CASCADE;
  DROP TABLE "workshops" CASCADE;
  DROP TABLE "workshops_rels" CASCADE;
  DROP TABLE "repairs" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_topics_fk";
  ALTER TABLE "bookings_rels" DROP CONSTRAINT "bookings_rels_repairs_fk";
  DROP INDEX "payload_locked_documents_rels_topics_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "topics_id";
  ALTER TABLE "bookings_rels" DROP COLUMN "repairs_id";
  ALTER TABLE "bookings" DROP COLUMN "note";
  DROP TYPE "public"."enum_workshops_level";\`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql\`
   CREATE TABLE "topics" ("id" serial PRIMARY KEY NOT NULL);
  ALTER TABLE "x" DROP CONSTRAINT "y";\`)
}
`

describe('safeDrops: the generated removal migration made safe', () => {
  const { source, tables, changed } = safeDrops(GENERATED)
  const up = source.slice(source.indexOf('export async function up('), source.indexOf('export async function down('))
  const down = source.slice(source.indexOf('export async function down('))

  it('names the tables it removes', () => {
    expect(changed).toBe(true)
    expect(tables).toEqual(['topics', 'workshops', 'workshops_rels', 'repairs'])
  })

  it('gives every DROP in up() IF EXISTS, so a foreign key CASCADE already removed is skipped', () => {
    expect(up).not.toMatch(/DROP (TABLE|CONSTRAINT|INDEX|COLUMN|TYPE) "/)
    expect(up).toContain('DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_topics_fk"')
    expect(up).toContain('DROP TABLE IF EXISTS "topics" CASCADE')
    expect(up).toContain('DROP TYPE IF EXISTS "public"."enum_workshops_level"')
  })

  it('deletes the rows first: links in the link tables, then link tables, then the tables they point at', () => {
    const order = [
      'DELETE FROM "payload_locked_documents_rels" WHERE "topics_id" IS NOT NULL;',
      'DELETE FROM "bookings_rels" WHERE "repairs_id" IS NOT NULL;',
      'DELETE FROM "workshops_rels";',
      'DELETE FROM "topics";',
      'DELETE FROM "workshops";',
      'DELETE FROM "repairs";',
    ]
    const at = order.map((statement) => up.indexOf(statement))
    expect(at.every((index) => index > -1), up).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(at[at.length - 1]).toBeLessThan(up.indexOf('DROP TABLE'))
    // A column dropped from an ordinary table never deletes that table's rows (bookings stay).
    expect(up).not.toContain('DELETE FROM "bookings"')
  })

  it('leaves down() exactly as Payload wrote it, and changes nothing when run twice', () => {
    expect(down).toBe(GENERATED.slice(GENERATED.indexOf('export async function down(')))
    expect(safeDrops(source)).toEqual({ source, tables, changed: false })
  })

  it('refuses a file that is not a migration', () => {
    expect(() => safeDrops('export const x = 1')).toThrow(/does not look like a migration/)
  })
})

describe('the prepared patch', () => {
  const { deleted, changed } = patchFiles(patchText)

  it('removes the three collections, their pages, components, task and tests, and keeps the booking', () => {
    for (const file of [
      'src/collections/Workshops.ts',
      'src/collections/Topics.ts',
      'src/collections/Repairs.ts',
      'src/app/(site)/workshops/page.tsx',
      'src/app/(site)/topics/[slug]/page.tsx',
      'src/tasks/find-workshop/filters.ts',
      'tests/integration/find-workshop.test.tsx',
      'tests/unit/filters.test.ts',
    ]) {
      expect(deleted).toContain(file)
    }
    for (const kept of ['src/collections/Clinics.ts', 'src/collections/TimeSlots.ts', 'src/collections/Bookings.ts', 'src/tasks/book-slot/createBooking.ts', 'src/course-check.config.ts']) {
      expect(deleted).not.toContain(kept)
    }
    expect(changed).toContain('src/payload.config.ts')
    expect(changed).toContain('src/seed/seed.ts')
    expect(PHOTOS).toHaveLength(4)
  })

  it('never touches generated files, migrations, the guides or the README (those are made or stay)', () => {
    for (const file of [...deleted, ...changed]) {
      expect(file).not.toMatch(/^src\/migrations\/|payload-types\.ts$|importMap\.js$|^docs\/|^README\.md$/)
    }
  })

  // Only while every file the patch changes is still the starter's own (a team that changed one gets a
  // clear STOPPED from the command instead, and this test stands aside).
  it('applies cleanly to the starter, or is already applied', () => {
    // Already applied (a team's copy after npm run remove-example): nothing left to check.
    if (!existsSync(path.join(root, 'src/collections/Workshops.ts'))) return
    const asTheStarterHasThem = [...patchText.matchAll(/^diff --git a\/(.+?) b\/.+\n(?:.+\n)*?index ([0-9a-f]+)\.\./gm)].every(
      ([, file, blob]) => git(['hash-object', file]).stdout.trim().startsWith(blob),
    )
    if (!asTheStarterHasThem) return
    const check = git(['apply', '--check', PATCH])
    expect(check.stderr).toBe('')
    expect(check.status).toBe(0)
  })

  it('reads the files git names when it cannot apply the patch', () => {
    expect(
      blockingFiles(
        'error: patch failed: src/components/site/MainNav.tsx:17\nerror: src/components/site/MainNav.tsx: patch does not apply\nerror: src/collections/Topics.ts: No such file or directory',
      ),
    ).toEqual(['src/components/site/MainNav.tsx', 'src/collections/Topics.ts'])
  })

  it('suggests a pull request note that says what the migration drops (the removals check asks for it)', () => {
    for (const table of ['workshops', 'topics', 'workshops_rels', 'repairs']) expect(PULL_REQUEST_NOTE).toContain(table)
  })
})

describe('npm run remove-example, without --yes', () => {
  it('is a dry run: it lists what it would do and changes nothing', () => {
    const before = git(['status', '--porcelain']).stdout
    const run = spawnSync(process.execPath, ['scripts/remove-example.mjs'], { cwd: root, encoding: 'utf8' })
    expect(run.status).toBe(0)
    if (existsSync(path.join(root, 'src/collections/Workshops.ts'))) {
      expect(run.stdout).toContain('This was a dry run: nothing was changed.')
      expect(run.stdout).toContain('src/collections/Workshops.ts')
    } else {
      expect(run.stdout).toContain('already removed')
    }
    expect(git(['status', '--porcelain']).stdout).toBe(before)
  })
})
