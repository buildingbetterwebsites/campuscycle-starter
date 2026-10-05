// The leftovers check (scripts/ci/leftovers.mjs): finds the Campus Cycle example's name and made-up
// details in the site's own code and content, but not in the guides, the README, the tests or other
// Markdown notes. The files here are made up: `read` hands the check their text.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { findLeftovers, inScope, leftoversMessage } from '../../scripts/ci/leftovers.mjs'

const SCRIPT = fileURLToPath(new URL('../../scripts/ci/leftovers.mjs', import.meta.url))

/**
 * Runs the check, as CI does, in a small git repository of its own that holds only `files`. It never
 * looks at this project's own files, so the test stays right after the example has been replaced.
 */
function runInRepository(files: Record<string, string>) {
  const folder = mkdtempSync(path.join(tmpdir(), 'bw-starter-leftovers-'))
  try {
    // No line-ending conversion, and git's own messages kept out of the test output (as in
    // check-history.test.ts): otherwise a computer set to convert line endings prints a warning per file.
    const git = (...args: string[]) => execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: folder, stdio: 'pipe' })
    git('init', '--quiet')
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(path.join(folder, path.dirname(file)), { recursive: true })
      writeFileSync(path.join(folder, file), text)
    }
    git('add', '.')
    return spawnSync(process.execPath, [SCRIPT], { cwd: folder, encoding: 'utf8' })
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
}

const files: Record<string, string> = {
  'src/components/site/Header.tsx': "export const SITE_NAME = 'Campus Cycle'",
  'src/content/campus-cycle.ts': "place: 'Workshop B, Student Centre',\nemail: 'hello@campuscycle.example',",
  'src/app/(site)/layout.tsx': '// Every page is called "<Page> · CAMPUS  CYCLE"',
  'src/content/our-club.ts': "export const NAME = 'The Night Riders'",
  'docs/guides/first-hour.md': 'The starter is the Campus Cycle example, at Workshop B, Student Centre.',
  'README.md': 'Campus Cycle: the course starter.',
  'tests/unit/booking.test.ts': "email: 'test@campuscycle.example'",
  'src/seed/images/SOURCES.md': 'Photos for the Campus Cycle example.',
  'src/tasks/book-slot/README.md': 'How Campus Cycle books a slot.',
  'src/migrations/20260928_082604_initial.ts': '-- Campus Cycle',
  'src/seed/images/campus-cycle.jpg': 'Campus Cycle',
  'scripts/seed.mjs': '// the Campus Cycle example content',
}
const read = (file: string) => {
  if (!(file in files)) throw new Error(`not a test file: ${file}`)
  return files[file]
}

describe('findLeftovers', () => {
  it('finds "Campus Cycle", "campuscycle.example" and "Workshop B, Student Centre" in src/ and its content files, with the line', () => {
    expect(findLeftovers(Object.keys(files), read)).toEqual([
      'src/components/site/Header.tsx:1: Campus Cycle',
      'src/content/campus-cycle.ts:1: Workshop B, Student Centre',
      'src/content/campus-cycle.ts:2: campuscycle.example',
      'src/app/(site)/layout.tsx:1: Campus Cycle',
    ])
  })

  it('leaves alone the guides, the README, the tests, Markdown notes in src/, migrations, photos and scripts', () => {
    const outside = ['docs/guides/first-hour.md', 'README.md', 'tests/unit/booking.test.ts', 'src/seed/images/SOURCES.md', 'src/tasks/book-slot/README.md', 'src/migrations/20260928_082604_initial.ts', 'src/seed/images/campus-cycle.jpg', 'scripts/seed.mjs']
    for (const file of outside) expect(inScope(file), file).toBe(false)
    // Not even read: a file outside the rule never reaches `read`.
    expect(findLeftovers(outside, () => { throw new Error('read a file outside the rule') })).toEqual([])
  })

  it('finds nothing once the example is replaced', () => {
    expect(findLeftovers(['src/content/our-club.ts'], read)).toEqual([])
    expect(leftoversMessage([])).toMatch(/^Leftovers: none\./)
  })

  it('says where each leftover is and what to do next', () => {
    const message = leftoversMessage(['src/components/site/Header.tsx:1: Campus Cycle'])
    expect(message).toContain('src/components/site/Header.tsx:1: Campus Cycle')
    expect(message).toMatch(/Replace each one with your own project/)
    expect(message).toMatch(/\/admin/)
  })

  it('accepts Windows paths and ./ in front', () => {
    expect(inScope('src\\components\\site\\Hero.tsx')).toBe(true)
    expect(inScope('./src/components/site/Hero.tsx')).toBe(true)
  })

  it('run directly in a repository with a leftover, fails and says where; the guides, README and tests do not count', () => {
    const run = runInRepository({
      'src/components/site/Header.tsx': "export const SITE_NAME = 'Campus Cycle'\n",
      'src/content/our-club.ts': "export const NAME = 'The Night Riders'\n",
      'docs/guides/first-hour.md': 'The Campus Cycle example.\n',
      'README.md': 'Campus Cycle\n',
      'tests/unit/a.test.ts': "'test@campuscycle.example'\n",
    })
    expect(run.status).toBe(1)
    expect(run.stdout).toContain('src/components/site/Header.tsx:1: Campus Cycle')
    expect(run.stdout).not.toMatch(/docs\/|README|tests\//)
  })

  it('run directly in a repository whose example is replaced, passes', () => {
    const run = runInRepository({
      'src/components/site/Header.tsx': "export const SITE_NAME = 'The Night Riders'\n",
      'README.md': 'Started from the Campus Cycle example.\n',
    })
    expect(run.status).toBe(0)
    expect(run.stdout).toMatch(/^Leftovers: none\./)
  })
})
