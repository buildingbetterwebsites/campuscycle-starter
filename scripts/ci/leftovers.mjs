// The leftovers check: has your project replaced the Campus Cycle example? CI's `leftovers` job runs
// this, but only once you switch it on (it is off in a new copy of the starter, because the example is
// still there on purpose while you learn with it). To switch it on: on GitHub, Settings → Secrets and
// variables → Actions → Variables → New repository variable, name CAMPUS_CYCLE_LEFTOVERS, value fail.
//
// THE RULE: it looks for the example's name and its made-up details
//   - "Campus Cycle" (also "campus cycle", "CAMPUS CYCLE"),
//   - "campuscycle.example" (the made-up e-mail domain),
//   - "Workshop B, Student Centre" (the made-up place),
// in the site's own code and content: every file under src/, apart from
//   - Markdown files (*.md): notes for the people working on the code, such as src/tasks/*/README.md
//     and the photo credits in src/seed/images/SOURCES.md, may still name the example;
//   - src/migrations/: the database's history, which is generated and never edited by hand;
//   - photos and fonts.
// Everything outside src/ is left alone: the guides in docs/ (they explain the example), README.md,
// the tests in tests/ (they use made-up test data), and the CI and set-up scripts.
// Comments in your code count too: a comment that still describes Campus Cycle is a leftover as well.
//
// Run it yourself: node scripts/ci/leftovers.mjs
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const PHRASES = [
  { label: 'Campus Cycle', pattern: /campus\s+cycle/i },
  { label: 'campuscycle.example', pattern: /campuscycle\.example/i },
  { label: 'Workshop B, Student Centre', pattern: /Workshop B,\s*Student Centre/i },
]

/**
 * Is this file part of the site's own code and content (see THE RULE above)?
 *
 * @param {string} file a path from the repository's root, such as src/components/site/Hero.tsx
 */
export function inScope(file) {
  const path = file.replace(/\\/g, '/').replace(/^\.\//, '')
  if (!path.startsWith('src/')) return false
  if (path.toLowerCase().endsWith('.md')) return false
  if (path.startsWith('src/migrations/')) return false
  // Photos and fonts hold no text to replace.
  if (/\.(jpe?g|png|webp|gif|avif|ico|woff2?)$/i.test(path)) return false
  return true
}

/**
 * Every leftover of the example in these files, one line each: "<file>:<line>: <phrase>". Files
 * outside the rule's scope are skipped without being read.
 *
 * @param {string[]} files paths from the repository's root
 * @param {(file: string) => string} [read] reads a file (a test can pass its own)
 * @returns {string[]}
 */
export function findLeftovers(files, read = (file) => readFileSync(file, 'utf8')) {
  const found = []
  for (const file of files.filter(inScope)) {
    const lines = read(file).split(/\r?\n/)
    lines.forEach((line, index) => {
      for (const { label, pattern } of PHRASES) {
        if (pattern.test(line)) found.push(`${file}:${index + 1}: ${label}`)
      }
    })
  }
  return found
}

/**
 * The message for the CI log.
 *
 * @param {string[]} leftovers what findLeftovers returned
 */
export function leftoversMessage(leftovers) {
  if (leftovers.length === 0) return 'Leftovers: none. Your site no longer uses the Campus Cycle example.'
  return [
    `Leftovers: ${leftovers.length} place(s) in src/ still use the Campus Cycle example:`,
    ...leftovers.map((line) => `  ${line}`),
    'Replace each one with your own project: its name, its own e-mail address and its own place. Then commit and push again.',
    'Text that is already in your database (pages, workshops) is changed in /admin, not here: this check only reads the files.',
  ].join('\n')
}

// Only when run directly (node scripts/ci/leftovers.mjs), never when a test imports this file.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // The files git keeps track of: the same set on your computer and in CI.
  const files = execFileSync('git', ['ls-files', '-z', 'src'], { encoding: 'utf8' }).split('\0').filter(Boolean)
  const leftovers = findLeftovers(files)
  console.log(leftoversMessage(leftovers))
  process.exit(leftovers.length === 0 ? 0 : 1)
}
