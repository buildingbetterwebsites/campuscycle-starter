// The "no migration missing" check: CI's `migrations` job runs this after the migrations have applied.
//
// A change to the content model (a new field, a removed collection...) needs a migration: a file in
// src/migrations that changes the database to match. If someone changed the model but forgot to create
// the migration, the live site would break on its next deploy. This check asks Payload's own migration
// tool to create a migration, named ci-check, for whatever the committed migrations do not cover yet:
//   - nothing to cover: the tool creates nothing, and the check passes;
//   - it creates a file: a migration is missing, and the check fails;
//   - it stops, or waits for an answer it cannot get (drizzle-kit, the tool underneath, asks whether a
//     change is a rename): the check fails, because only a person can answer that question.
// The tool compares the model with the last committed snapshot (src/migrations/*.json); it never
// connects to the database.
//
// WHY the check also looks for the tool's last progress line: Payload's own command (`payload ...`)
// was once seen ending with "success" without doing anything at all (see scripts/migrate.mjs). This
// check therefore runs the tool through `node --import tsx` (as scripts/migrate.mjs does) and passes
// only when the tool says it finished comparing. Anything it cannot tell for sure counts as a failure.
//
// Run it yourself (it removes the ci-check files it made): node scripts/ci/migration-missing.mjs
import { execFileSync, spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// The tool's last progress line when it compared everything (from @payloadcms/drizzle's createMigration).
export const COMPARED_LINE = 'Migration DOWN statements generation complete.'
export const TIME_LIMIT_MS = 120_000
const ASKED = /created or renamed from another/i

export const MISSING_MESSAGE =
  'A model change has no migration: run npm run migrate:create -- <name> on your own computer and commit the new files.'
export const QUESTION_MESSAGE =
  'The migration tool needs an answer (probably a rename). Create the migration on your own computer: npm run migrate:create -- <name>.'
export const UNSURE_MESSAGE =
  'The migration check could not tell whether a migration is missing: the migration tool stopped without saying it had finished comparing (see its messages above). Run npm run migrate:create -- <name> on your own computer: if it creates files, commit them; if it says nothing changed, run this check again.'

/**
 * The decision, from what the tool did. Exported so a test can check it on sample outputs.
 *
 * @param {{
 *   status: number | null,  // the tool's exit code (null when it was stopped, for example after the time limit)
 *   output: string,         // what it printed (stdout and stderr together)
 *   timedOut?: boolean,     // it was stopped after TIME_LIMIT_MS
 *   changes: string,        // `git status --porcelain src/migrations` after the tool ran
 * }} run
 * @returns {{ ok: boolean, message: string }}
 */
export function decideMigrationCheck({ status, output, timedOut = false, changes }) {
  if (changes.trim() !== '') return { ok: false, message: MISSING_MESSAGE }
  // drizzle-kit's question reads like "Is details column in repairs table created or renamed from
  // another column?". With no keyboard it was seen to stop with exit code 0, right after asking.
  if (timedOut || status !== 0 || ASKED.test(stripColours(output))) return { ok: false, message: QUESTION_MESSAGE }
  const lines = stripColours(output).split(/\r?\n/)
  if (!lines.some((line) => line.trimEnd().endsWith(COMPARED_LINE))) return { ok: false, message: UNSURE_MESSAGE }
  return { ok: true, message: 'Migrations: none missing. Every model change has its migration.' }
}

// Payload colours its log lines in a terminal; the colour codes are not part of the text.
function stripColours(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, '')
}

const migrationChanges = () => execFileSync('git', ['status', '--porcelain', '--untracked-files=all', 'src/migrations'], { encoding: 'utf8' })

function run() {
  // A migration you are still working on would look like a missing one: commit it first.
  const before = migrationChanges()
  if (before.trim() !== '') {
    console.error(`src/migrations has changes that are not committed yet:\n${before}Commit them (or undo them), then run this check again.`)
    return 1
  }

  // stdin 'ignore': no keyboard, so a question from the tool can never be answered here. It then
  // stops, or waits until the time limit.
  const tool = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'node_modules/payload/bin.js', 'migrate:create', 'ci-check', '--skip-empty', '--disable-transpile'],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: TIME_LIMIT_MS,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, NODE_OPTIONS: '--no-deprecation' },
    },
  )
  const output = `${tool.stdout ?? ''}${tool.stderr ?? ''}`
  // The tool's own messages first, ending on a new line (a question it asked does not end with one).
  process.stdout.write(output === '' || output.endsWith('\n') ? output : `${output}\n`)
  const changes = migrationChanges()
  const result = decideMigrationCheck({
    status: tool.status,
    output,
    timedOut: tool.error?.code === 'ETIMEDOUT',
    changes,
  })
  if (changes.trim() !== '') console.log(`The tool created or changed:\n${changes}`)
  cleanUp(changes)
  console.log(result.ok || !process.env.GITHUB_ACTIONS ? result.message : `::error title=Migration missing::${result.message}`)
  return result.ok ? 0 : 1
}

// Takes back what the tool made, so running this on your own computer leaves no ci-check migration
// behind (in CI it does not matter: the copy is thrown away).
function cleanUp(changes) {
  for (const line of changes.split('\n')) {
    const file = line.slice(3).trim()
    if (line.startsWith('??') && /_ci_check\.(ts|json)$/.test(file)) rmSync(file, { force: true })
  }
  if (/^ M src\/migrations\/index\.ts$/m.test(changes)) execFileSync('git', ['checkout', '--', 'src/migrations/index.ts'])
}

// Only when run directly (node scripts/ci/migration-missing.mjs), never when a test imports this file.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(run())
}
