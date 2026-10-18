// npm run remove-example: takes the parts of the Campus Cycle example out that a team does not keep,
// so the team starts its own content model from a clean, working site.
//
// WHAT GOES (always the same, nothing to choose):
//   - the collections Workshops, Topics and Repairs, with their pages (/workshops, /topics), their
//     components, the find-a-workshop task (src/tasks/find-workshop), their tests, their four photos
//     and their part of the seed and of the browser checks (checks/checks.json);
//   - W5's and W6's marked places (the clinic's price list and the repair choice): they need the repairs.
// WHAT STAYS: Clinics, Time Slots, Bookings and the book-slot task (src/tasks/book-slot). Teams keep the
// booking and rename it to their own topic (docs/guides/recipes.md, R5 and R10), which is far less work
// than writing a transactional task from nothing.
//
// HOW: the changes are one prepared patch (scripts/remove-example/remove-example.patch), made from the
// starter by hand and tested: the starter's tests, types and lint all pass after it. Git applies it
// only when every file it changes is still as the starter has it, and then all at once, never half.
// Then this script makes the migration that removes the three tables from the database
// (npm run migrate:create -- remove_example), makes that migration safe (it deletes the rows first,
// and every DROP gets IF EXISTS: scripts/lib/safeDrops.mjs) and regenerates the types
// (npm run generate).
//
// Run it:
//   npm run remove-example            shows what it would do, and changes nothing (a dry run)
//   npm run remove-example -- --yes   does it
// Run it first, on a fresh copy of the starter, before your own changes: on a branch, with nothing
// uncommitted, and with your laptop's database set up (docs/guides/local-setup.md). To undo it before
// you commit: git restore --staged --worktree . and git clean -fd src (or delete the branch).
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { safeDrops } from './lib/safeDrops.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
export const PATCH = 'scripts/remove-example/remove-example.patch'
const MIGRATION_NAME = 'remove_example'
// The workshops' four photos: images, so they are deleted here rather than in the patch (a patch is
// text).
export const PHOTOS = ['repair-a-puncture.jpg', 'adjust-your-brakes.jpg', 'service-a-gear-system.jpg', 'true-a-wheel.jpg'].map(
  (name) => `src/seed/images/${name}`,
)

// What a team writes under "## Why this removes or renames" in the pull request (CI's removals check
// asks for it, because the migration drops tables).
export const PULL_REQUEST_NOTE =
  'npm run remove-example: the migration drops the example tables workshops, topics, workshops_rels and repairs, with their rows. They held only the starter\'s example content (workshops, topics, the repair price list), which our site does not use. Clinics, time slots and bookings stay.'

function git(args, options = {}) {
  return spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', ...options })
}

/** The files the patch deletes and the files it changes, from git's own summary of it. */
export function patchFiles(patchText) {
  const deleted = []
  const changed = []
  for (const chunk of patchText.split(/^(?=diff --git )/m)) {
    const name = /^diff --git a\/(.+?) b\//.exec(chunk)
    if (!name) continue
    // The lines before the first change say what happens to the file as a whole.
    const header = chunk.split(/^(?:@@|GIT binary patch|---)/m)[0]
    if (/^deleted file mode/m.test(header)) deleted.push(name[1])
    else changed.push(name[1])
  }
  return { deleted, changed }
}

/** The files git names when the patch does not apply ("error: patch failed: <file>:<line>", ...). */
export function blockingFiles(gitError) {
  const files = new Set()
  for (const line of String(gitError).split(/\r?\n/)) {
    const failed = /^error: patch failed: (.+):\d+$/.exec(line)
    const missing = /^error: (.+): (?:No such file or directory|does not exist in index)$/.exec(line)
    const found = failed?.[1] ?? missing?.[1]
    if (found) files.add(found)
  }
  return [...files]
}

/** Is the example already gone (this command ran before)? */
function alreadyRemoved() {
  return ['Workshops', 'Topics', 'Repairs'].every((name) => !existsSync(path.join(ROOT, `src/collections/${name}.ts`)))
}

/** Does .env.local name the laptop's database (migrate:create needs it)? */
function hasLaptopDatabase() {
  const file = path.join(ROOT, '.env.local')
  if (!existsSync(file)) return false
  return /^\s*(DATABASE_URL|STORAGE_URL)\s*=\s*\S+/m.test(readFileSync(file, 'utf8'))
}

function npm(args) {
  // shell: true, so Windows finds npm.cmd as well; the arguments are fixed words, never user input.
  return spawnSync('npm', args, { cwd: ROOT, stdio: 'inherit', shell: true }).status
}

/** The newest migration this command made, or null. */
function newestRemovalMigration() {
  const folder = path.join(ROOT, 'src/migrations')
  const found = readdirSync(folder).filter((name) => name.endsWith(`_${MIGRATION_NAME}.ts`)).sort()
  return found.length === 0 ? null : path.join(folder, found.at(-1))
}

function fixMigration() {
  const file = newestRemovalMigration()
  if (!file) {
    console.log(`No migration named *_${MIGRATION_NAME}.ts in src/migrations. Make it first: npm run migrate:create -- ${MIGRATION_NAME}`)
    return false
  }
  const result = safeDrops(readFileSync(file, 'utf8'))
  if (result.changed) writeFileSync(file, result.source)
  console.log(`${result.changed ? 'Made safe' : 'Already safe'}: ${path.relative(ROOT, file).split(path.sep).join('/')} (rows first, IF EXISTS on every DROP; tables: ${result.tables.join(', ') || 'none'}).`)
  return true
}

const NEXT = [
  'Next, in this order:',
  '  1. npm run migrate            the migration removes the three tables from your laptop\'s database',
  '  2. npm run dev                look at the site: Home, Repair clinic, About, Contact (Ctrl+C to stop)',
  '  3. npm test                   the tests that are left pass (CI runs them again on GitHub)',
  '  4. git add -A',
  '     git commit -m "Remove the example workshops, topics and repairs"',
  '     git push -u origin <your branch>',
  '  5. Open the pull request. Under "## Why this removes or renames" write:',
  `     ${PULL_REQUEST_NOTE}`,
  'After the merge, Vercel runs the same migration on your live database. The example workshops, topics and',
  'repair prices disappear from the live site; your pages, the clinic, its time slots and bookings stay.',
]

export function main(argv = process.argv.slice(2)) {
  const yes = argv.includes('--yes')
  if (argv.includes('--fix-migration')) return fixMigration() ? 0 : 1

  if (git(['--version']).status !== 0) {
    console.log('remove-example needs Git. Install it (docs/guides/local-setup.md), then run this again.')
    return 1
  }
  if (alreadyRemoved()) {
    console.log('The example workshops, topics and repairs are already removed: nothing to do.')
    return 0
  }
  const patchText = readFileSync(path.join(ROOT, PATCH), 'utf8')
  const { deleted: patched, changed } = patchFiles(patchText)
  const deleted = [...patched, ...PHOTOS.filter((file) => existsSync(path.join(ROOT, file)))]
  const check = git(['apply', '--check', PATCH])
  if (check.status !== 0) {
    const files = blockingFiles(check.stderr)
    console.log([
      'Nothing removed: remove-example only works on files that are still as the starter has them,',
      'and these were changed already:',
      ...(files.length > 0 ? files.map((file) => `  ${file}`) : [`  (git says: ${check.stderr.trim()})`]),
      'Run it first, on a fresh copy, before other changes. Or undo your changes to these files',
      '(git restore <file>), run it, and make your changes again.',
    ].join('\n'))
    return 1
  }

  console.log(`remove-example takes out the example's workshops, topics and repairs.`)
  console.log(`\nIt deletes ${deleted.length} files:`)
  for (const file of deleted) console.log(`  ${file}`)
  console.log(`\nIt changes ${changed.length} files:`)
  for (const file of changed) console.log(`  ${file}`)
  console.log('\nThen it makes the migration that removes the tables workshops, topics, workshops_rels and repairs,')
  console.log('with their rows (npm run migrate:create -- remove_example, with IF EXISTS on every DROP), and')
  console.log('regenerates the types (npm run generate). Clinics, time slots, bookings and the booking task stay.')

  if (!yes) {
    console.log('\nThis was a dry run: nothing was changed. To do it: npm run remove-example -- --yes')
    return 0
  }

  if (git(['status', '--porcelain', '--untracked-files=no']).stdout.trim() !== '') {
    console.log('\nNothing removed: you have changes that are not committed yet. Commit them (or undo them)')
    console.log('first, so you can always go back to where you were. Then run this again.')
    return 1
  }
  if (!hasLaptopDatabase()) {
    console.log('\nNothing removed: .env.local has no DATABASE_URL line yet: making the migration needs your')
    console.log("laptop's database. Fill in .env.local as docs/guides/local-setup.md says, then run this again.")
    return 1
  }

  const applied = git(['apply', PATCH])
  if (applied.status !== 0) {
    console.log(`\nNothing removed: git could not apply the changes (${applied.stderr.trim()}).`)
    return 1
  }
  for (const file of PHOTOS) rmSync(path.join(ROOT, file), { force: true })
  console.log(`\nDone: ${deleted.length} files deleted, ${changed.length} changed.\n`)

  if (npm(['run', 'migrate:create', '--', MIGRATION_NAME]) !== 0 || !fixMigration()) {
    console.log('\nThe files are changed, but the migration is not made. Read the message above, put it right, then run:')
    console.log(`  npm run migrate:create -- ${MIGRATION_NAME}`)
    console.log('  npm run remove-example -- --fix-migration')
    console.log('  npm run generate')
    return 1
  }
  if (npm(['run', 'generate']) !== 0) {
    console.log('\nThe migration is made, but npm run generate stopped. Read its message, then run it again.')
    return 1
  }
  console.log(`\nThe example's workshops, topics and repairs are removed.\n\n${NEXT.join('\n')}`)
  return 0
}

// Only when run directly (npm run remove-example), never when a test imports this file.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main())
}

