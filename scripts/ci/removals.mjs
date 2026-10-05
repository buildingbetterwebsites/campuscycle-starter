// The removals check: CI's `migrations` job runs this on every pull request.
//
// Most migrations only add: a new table, a new column. Some remove or rename something, and then data
// can be lost for good: a dropped column takes its values with it. That is allowed (for example when a
// team turns the example into its own project), but it has to be on purpose. So when a new migration
// in this pull request removes or renames something, the description must say why, under the heading
// "## Why this removes or renames" (the pull request template has it).
//
// What counts, in the up() part of each NEW migration (one this pull request adds, compared with the
// branch it goes into; up() is what runs on the live database, down() only when undoing, so down() is
// not read):
//   - DROP TABLE, DROP COLUMN, DROP TYPE: a table, a column or a list of choices (an enum) is removed;
//   - RENAME: a table, a column or a choice gets a new name;
//   - ALTER COLUMN ... TYPE (also SET DATA TYPE): a column's type changes, which can change or lose values.
// Not counted: DROP CONSTRAINT and DROP INDEX on their own. The migration tool removes and re-adds those
// as a step of many ordinary changes, and they hold no data.
//
// Run it yourself (it compares with origin/main): PR_BODY="$(cat description.md)" node scripts/ci/removals.mjs
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { sectionText, visibleText } from './prBody.mjs'

export const REASON_TITLE = 'Why this removes or renames'

const FLAGGED = [
  /\bDROP\s+(TABLE|COLUMN|TYPE)\b/i,
  /\bRENAME\b/i,
  /\bALTER\s+COLUMN\s+(?:"[^"]+"|\w+)\s+(?:SET\s+DATA\s+)?TYPE\b/i,
]

/**
 * The up() part of a migration file: from `function up(` to `function down(` (or the end).
 *
 * @param {string} source the migration file's text
 */
export function upPart(source) {
  const start = source.search(/function\s+up\s*\(/)
  if (start === -1) return ''
  const rest = source.slice(start)
  const end = rest.search(/function\s+down\s*\(/)
  return end === -1 ? rest : rest.slice(0, end)
}

/**
 * The statements in a migration's up() that remove or rename something, each as one line.
 *
 * @param {string} source the migration file's text
 * @returns {string[]}
 */
export function findRemovals(source) {
  // Comment lines are notes, not SQL: "// we no longer DROP anything" is not a removal.
  const code = upPart(source)
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
  return code
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter((statement) => FLAGGED.some((pattern) => pattern.test(statement)))
    .map((statement) => statement.replace(/^.*?sql`\s*/, ''))
}

/**
 * The commit to compare with: origin/main when it exists, otherwise the pull request's base commit
 * (GITHUB_BASE_SHA), otherwise none.
 *
 * @param {Record<string, string | undefined>} env usually process.env
 * @param {(ref: string) => boolean} exists does this git reference exist here?
 * @returns {string | null}
 */
export function compareWith(env, exists) {
  if (exists('origin/main')) return 'origin/main'
  if (env.GITHUB_BASE_SHA && exists(env.GITHUB_BASE_SHA)) return env.GITHUB_BASE_SHA
  return null
}

/**
 * The migration files this branch adds, compared with `base`: `git diff --name-only --diff-filter=A`
 * output, keeping only src/migrations/*.ts (not index.ts, which only lists them).
 *
 * @param {string} diffOutput
 * @returns {string[]}
 */
export function newMigrationFiles(diffOutput) {
  return diffOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((file) => /^src\/migrations\/[^/]+\.ts$/.test(file) && file !== 'src/migrations/index.ts')
}

/**
 * The decision.
 *
 * @param {{ file: string, statements: string[] }[]} migrations the new migrations and what each removes or renames
 * @param {string | null | undefined} prBody the pull request's description
 * @returns {{ ok: boolean, message: string }}
 */
export function checkRemovals(migrations, prBody) {
  const flagged = migrations.filter((migration) => migration.statements.length > 0)
  if (flagged.length === 0) return { ok: true, message: 'Removals: none. No new migration removes or renames anything.' }
  const list = flagged.flatMap(({ file, statements }) => [`  ${file}:`, ...statements.map((statement) => `    ${statement}`)]).join('\n')
  const reason = visibleText(sectionText(prBody, REASON_TITLE) ?? '')
  if (reason !== '') {
    return { ok: true, message: `Removals: explained in the description. These new migrations remove or rename something:\n${list}` }
  }
  return {
    ok: false,
    message: [
      'Removals: not explained. These new migrations remove or rename something, and the data in it can be lost for good:',
      list,
      `If that is what you meant: under "## ${REASON_TITLE}" in your pull request's description, write what goes and why that is safe. When you save the description, CI runs its checks again by itself.`,
      'If not: undo the change to the model, delete these migration files, and create the migration again with npm run migrate:create -- <name>.',
    ].join('\n'),
  }
}

function run() {
  if (process.env.GITHUB_EVENT_NAME && process.env.GITHUB_EVENT_NAME !== 'pull_request') {
    console.log('Removals: skipped. This check reads a pull request\'s description, and this run is not for a pull request.')
    return 0
  }
  const exists = (ref) => {
    try {
      execFileSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }
  const base = compareWith(process.env, exists)
  if (!base && process.env.GITHUB_EVENT_NAME === 'pull_request') {
    // In CI the check must never pass just because it could not look.
    console.log('Removals: could not run. The branch this pull request goes into is not in this copy of the repository. In .github/workflows/ci.yml, the migrations job needs fetch-depth: 0 on its checkout step.')
    return 1
  }
  if (!base) {
    console.log('Removals: skipped. There is no origin/main (and no pull request base) to compare with, so no migration counts as new.')
    return 0
  }
  const diff = execFileSync('git', ['diff', '--name-only', '--diff-filter=A', `${base}...HEAD`, '--', 'src/migrations'], { encoding: 'utf8' })
  const migrations = newMigrationFiles(diff).map((file) => ({ file, statements: findRemovals(readFileSync(file, 'utf8')) }))
  console.log(`Removals: comparing with ${base}; new migrations: ${migrations.length ? migrations.map((m) => m.file).join(', ') : 'none'}.`)
  const result = checkRemovals(migrations, process.env.PR_BODY)
  console.log(result.ok || !process.env.GITHUB_ACTIONS ? result.message : `::error title=Removals not explained::${result.message.split('\n')[0]}\n${result.message}`)
  return result.ok ? 0 : 1
}

// Only when run directly (node scripts/ci/removals.mjs), never when a test imports this file.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(run())
}
