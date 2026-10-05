// Checks on the README and the guides in docs/guides: the things that break silently when the code
// changes and the guides do not.
//   - Every message the starter prints when something is wrong has its own heading in
//     docs/guides/troubleshooting.md, so a learner who sees one can look it up word for word.
//   - Every link and picture in the README and the guides points at a file that exists. A missing
//     screenshot is allowed only as a listed placeholder (docs/guides/img/PLACEHOLDERS.md).
//   - Every anchor (#...) the code or a guide links to exists.
//   - The guides quote the course's marker lines exactly as the code holds them: the course's chapters
//     quote both, so they must never drift apart.
//   - The fixed words the course's chapters share with this starter are used as agreed.
//   - The project document templates exist where the course's final check looks for them.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { inScope } from '../../scripts/ci/leftovers.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')
const exists = (file: string) => existsSync(path.join(root, file))

/** Every file below `folder` (a path from the repository's root) whose name passes `keep`. */
function filesIn(folder: string, keep: (name: string) => boolean): string[] {
  if (!exists(folder)) return []
  return readdirSync(path.join(root, folder), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${folder}/${entry.name}`
    if (entry.isDirectory()) return filesIn(relative, keep)
    return keep(entry.name) ? [relative] : []
  })
}

// The three templates only a team fills in (a team's final hand-in reads them too).
const TEAM_TEMPLATES = ['docs/team-agreement.md', 'docs/content-structure.md', 'docs/design-rationale.md']

// The project document templates (docs/COURSE-CHECK-CONTRACT.md, "Project documents (final check)").
const TEMPLATES = [
  'docs/brief.md',
  'docs/requirements.md',
  'docs/decisions/README.md',
  'docs/decisions/analytics.md',
  'docs/decisions/integration.md',
  'docs/test-report.md',
  'docs/handover.md',
  ...TEAM_TEMPLATES,
]

// The documents a learner reads: the README, the guides and the templates. The maintainers' notes
// (docs/maintainers) are read too while they exist: they stay in the maintainers' repository and are
// never part of the published template.
const DOCS = [
  'README.md',
  ...filesIn('docs/guides', (name) => name.endsWith('.md')),
  ...filesIn('docs/maintainers', (name) => name.endsWith('.md')),
  ...TEMPLATES,
]

/**
 * Paths that are never published in the template: the maintainers' own files and the course's internal
 * policy. Nothing a learner keeps may link to one. The maintainers' publish check keeps the same list
 * (and its test checks that this one still matches it).
 */
const NOT_PUBLISHED = [
  'CODEX-HANDOFF.md',
  'docs/superpowers/',
  '.superpowers/',
  'docs/maintainers/',
  'scripts/maintainers/',
  'tests/unit/check-history.test.ts',
  'docs/spec/',
]
function notPublished(file: string): boolean {
  return NOT_PUBLISHED.some((path) => (path.endsWith('/') ? file.startsWith(path) : file === path))
}

const TROUBLESHOOTING = 'docs/guides/troubleshooting.md'

// ---------------------------------------------------------------------------------------------------
// Headings and anchors
// ---------------------------------------------------------------------------------------------------

/** GitHub's anchor for a heading: lower case, punctuation removed, each space a hyphen. */
function slug(heading: string): string {
  return heading
    .replace(/`/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-')
}

/** The anchors a Markdown file offers: one per heading (numbered when repeated), and every id="...". */
function anchorsOf(markdown: string): Set<string> {
  const anchors = new Set<string>()
  const seen = new Map<string, number>()
  let fenced = false
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith('```')) fenced = !fenced
    if (fenced) continue
    const heading = /^#{1,6} (.+?)\s*#*$/.exec(line)
    if (heading) {
      const base = slug(heading[1])
      const count = seen.get(base) ?? 0
      seen.set(base, count + 1)
      anchors.add(count === 0 ? base : `${base}-${count}`)
    }
    for (const match of line.matchAll(/\bid="([^"]+)"/g)) anchors.add(match[1])
  }
  return anchors
}

/** Each `##` heading of a Markdown file, with the first line of text under it. */
function sectionsOf(markdown: string): { heading: string; firstLine: string }[] {
  const lines = markdown.split(/\r?\n/)
  const sections: { heading: string; firstLine: string }[] = []
  lines.forEach((line, index) => {
    if (!line.startsWith('## ')) return
    const firstLine = lines.slice(index + 1).find((next) => next.trim() !== '') ?? ''
    sections.push({ heading: line.slice(3), firstLine })
  })
  return sections
}

// ---------------------------------------------------------------------------------------------------
// The messages the starter prints
// ---------------------------------------------------------------------------------------------------

// How a message the code prints starts. Any text in the code that starts like this is a message a
// learner can meet, so it must be listed in MESSAGES below (and therefore in the troubleshooting guide).
const PREFIXES = [
  'NOT CONFIGURED YET',
  'DATABASE SET UP WRONG',
  'STOPPED:',
  'REFUSED:',
  'MIGRATIONS: FAILED',
  'SEED: FAILED',
  'No admin user',
  'Could not reach your database',
  'Images cannot be stored',
  'The database did not answer',
  'The seed did not finish',
  'This slot is full',
  'Too many bookings',
  'AI note: missing',
  'AI note: empty',
  'A model change has no migration',
  'The migration tool needs an answer',
  'The migration check could not tell',
  'Removals: not explained',
  'MIGRATIONS: ran',
]

type Message = {
  /** The file that prints it. */
  file: string
  /** The text as that file holds it (the start of the message is enough). */
  code: string
  /** What the troubleshooting guide's heading, or the line under it, must contain. Defaults to `code`. */
  heading?: string
}

const MESSAGES: Message[] = [
  { file: 'scripts/lib/decide.mjs', code: 'NOT CONFIGURED YET: there is no database.' },
  { file: 'scripts/lib/decide.mjs', code: 'NOT CONFIGURED YET: PAYLOAD_SECRET is missing or shorter than 32 characters.' },
  { file: 'scripts/lib/decide.mjs', code: 'NOT CONFIGURED YET: the live database must be a Neon database' },
  { file: 'scripts/lib/decide.mjs', code: 'NOT CONFIGURED YET: this preview has no database of its own.' },
  { file: 'scripts/lib/decide.mjs', code: 'DATABASE SET UP WRONG: your database has two addresses' },
  {
    file: 'scripts/build.mjs',
    code: 'DATABASE SET UP WRONG: ${shortReason(error)} In Vercel: Settings → Environment Variables → keep the database variables',
    heading: 'DATABASE SET UP WRONG: Conflicting',
  },
  { file: 'scripts/lib/decide.mjs', code: 'STOPPED: this preview is connected to your LIVE database' },
  {
    file: 'scripts/guard.mjs',
    code: 'REFUSED: no DATABASE_URL (or STORAGE_URL) is set',
  },
  { file: 'scripts/guard.mjs', code: 'REFUSED: ${decision.reason}', heading: 'REFUSED: This is the live database' },
  { file: 'scripts/guard.mjs', code: 'REFUSED: ${conflictMessage(error)}', heading: 'REFUSED: Conflicting' },
  { file: 'scripts/build.mjs', code: 'MIGRATIONS: FAILED ON THE PREVIEW DATABASE' },
  {
    file: 'scripts/build.mjs',
    code: 'MIGRATIONS: FAILED. The migration step did not confirm that every committed migration is in your live database',
    heading: 'MIGRATIONS: FAILED. The migration step did not confirm',
  },
  {
    file: 'scripts/guard.mjs',
    code: 'MIGRATIONS: FAILED. The migration step did not confirm that every committed migration is in your database.',
    heading: 'MIGRATIONS: FAILED. The migration step did not confirm',
  },
  { file: 'scripts/build.mjs', code: 'MIGRATIONS: ran, but could not record which database is the live one' },
  { file: 'scripts/build.mjs', code: 'SEED: FAILED. The seed step did not confirm that it finished', heading: 'SEED: FAILED.' },
  { file: 'scripts/guard.mjs', code: 'SEED: FAILED. The seed did not confirm that it finished.', heading: 'SEED: FAILED.' },
  { file: 'src/lib/firstAdmin.ts', code: 'No admin user exists and FIRST_ADMIN_EMAIL / FIRST_ADMIN_PASSWORD are not set.' },
  // Printed by the build and by npm run dev, migrate and seed.
  { file: 'scripts/lib/messages.mjs', code: 'Could not reach your database to check which one it is' },
  { file: 'src/seed/seed.ts', code: 'Images cannot be stored: this Vercel project has no Blob store connected.' },
  { file: 'scripts/lib/watchdog.mjs', code: 'The database did not answer within 110 seconds.' },
  { file: 'scripts/lib/watchdog.mjs', code: 'The seed did not finish within 110 seconds.' },
  { file: 'src/tasks/book-slot/capacity.ts', code: 'This slot is full. Choose another time.' },
  { file: 'src/tasks/book-slot/createBooking.ts', code: 'Too many bookings from this device. Try again in an hour.' },
  { file: 'scripts/ci/ai-note.mjs', code: 'AI note: missing.' },
  { file: 'scripts/ci/ai-note.mjs', code: 'AI note: empty.' },
  { file: 'scripts/ci/migration-missing.mjs', code: 'A model change has no migration' },
  { file: 'scripts/ci/migration-missing.mjs', code: 'The migration tool needs an answer' },
  { file: 'scripts/ci/migration-missing.mjs', code: 'The migration check could not tell whether a migration is missing' },
  { file: 'scripts/ci/removals.mjs', code: 'Removals: not explained.' },
]

// Messages that do not start with one of the PREFIXES, but that a learner meets and looks up all the
// same: the file that prints each, and what the guide's heading (or the line under it) must contain.
const OTHER_SITUATIONS: Message[] = [
  // The build log line of a preview that does not migrate, in its two forms.
  { file: 'scripts/lib/decide.mjs', code: 'not running on this preview (its database is not a copy of your live one yet', heading: 'MIGRATIONS: not running on this preview (its database is not a copy of your live one yet' },
  { file: 'scripts/lib/decide.mjs', code: 'not running on this preview (its database is not a Neon database', heading: 'MIGRATIONS: not running on this preview (its database is not a Neon database' },
  // CI's types-fresh job.
  { file: '.github/workflows/ci.yml', code: 'title=Generated files out of date', heading: 'Generated files out of date' },
  // The course-check route's answers.
  { file: 'src/lib/courseCheckResponse.ts', code: "'unavailable'", heading: '"error": "unavailable"' },
  { file: 'src/lib/courseCheckResponse.ts', code: "'rate_limited'", heading: '"error": "rate_limited"' },
  { file: 'src/lib/courseCheckResponse.ts', code: "'invalid_code'", heading: '"error": "invalid_code"' },
]

// Situations without a message of the starter's own that the guide must still cover.
const SITUATIONS = ['Promote to Production', 'does not exist', 'Images do not upload on a preview']

/** Every quoted text in a source file, outside comments, as the file holds it (one line at most). */
function quotedTexts(source: string): string[] {
  const code = source
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n')
  return [...code.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)].map((match) => match[2].replace(/^(\\n)+/, ''))
}

const SOURCE_FILES = [
  ...filesIn('scripts', (name) => name.endsWith('.mjs')),
  ...filesIn('src', (name) => /\.(ts|tsx)$/.test(name) && name !== 'payload-types.ts'),
]

describe('docs/guides/troubleshooting.md', () => {
  const guide = exists(TROUBLESHOOTING) ? read(TROUBLESHOOTING) : ''
  const sections = sectionsOf(guide)
  const covered = (text: string) =>
    sections.some(({ heading, firstLine }) => heading.includes(text) || firstLine.includes(text))

  it('every message listed here is still printed by the code', () => {
    for (const { file, code } of [...MESSAGES, ...OTHER_SITUATIONS]) {
      expect(read(file), `${file} no longer holds "${code}": update this test and the guide`).toContain(code)
    }
  })

  it('every message the code prints with a known start is listed here', () => {
    const unlisted: string[] = []
    for (const file of SOURCE_FILES) {
      for (const text of quotedTexts(read(file))) {
        if (!PREFIXES.some((prefix) => text.startsWith(prefix))) continue
        if (!MESSAGES.some(({ code }) => text.startsWith(code))) unlisted.push(`${file}: ${text.slice(0, 100)}`)
      }
    }
    expect(unlisted, 'add each to MESSAGES and give it a heading in the troubleshooting guide').toEqual([])
  })

  it('has a heading (or the line under it) for every message', () => {
    const missing = [...MESSAGES, ...OTHER_SITUATIONS]
      .map(({ code, heading }) => heading ?? code)
      .filter((text) => !covered(text))
    expect(missing).toEqual([])
  })

  it('covers the situations that have no message of their own', () => {
    expect(SITUATIONS.filter((text) => !covered(text))).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------------
// Links, pictures and anchors
// ---------------------------------------------------------------------------------------------------

const PLACEHOLDER_LIST = 'docs/guides/img/PLACEHOLDERS.md'
const PLACEHOLDER = /^docs\/guides\/img\/first-hour-\d{2}\.png$/

/** The placeholders PLACEHOLDERS.md lists, as paths from the repository's root. */
function listedPlaceholders(): Set<string> {
  if (!exists(PLACEHOLDER_LIST)) return new Set()
  return new Set([...read(PLACEHOLDER_LIST).matchAll(/`(first-hour-\d{2}\.png)`/g)].map((match) => `docs/guides/img/${match[1]}`))
}

/** Every link and picture target in a Markdown file, outside code. */
function targetsOf(markdown: string): string[] {
  const text = markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')
  return [
    ...[...text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((match) => match[1]),
    ...[...text.matchAll(/<img [^>]*src="([^"]+)"/g)].map((match) => match[1]),
  ]
}

const external = (target: string) => /^(https?:|mailto:)/.test(target)

describe('links and pictures in the README and the guides', () => {
  const placeholders = listedPlaceholders()

  it('the README and every guide exist', () => {
    for (const file of [
      'README.md',
      'docs/guides/first-hour.md',
      'docs/guides/local-setup.md',
      'docs/guides/troubleshooting.md',
      'docs/guides/ux-decisions.md',
      PLACEHOLDER_LIST,
    ]) {
      expect(exists(file), file).toBe(true)
    }
  })

  it('every relative link and picture points at a file that exists, or a listed placeholder', () => {
    const broken: string[] = []
    for (const doc of DOCS.filter(exists)) {
      for (const target of targetsOf(read(doc))) {
        if (external(target) || target.startsWith('#')) continue
        const file = path.posix.normalize(path.posix.join(path.posix.dirname(doc), decodeURI(target.split('#')[0])))
        if (exists(file)) continue
        if (PLACEHOLDER.test(file) && placeholders.has(file)) continue
        broken.push(`${doc}: ${target}`)
      }
    }
    expect(broken).toEqual([])
  })

  it('PLACEHOLDERS.md lists only screenshots that are still missing and still used', () => {
    const used = new Set(
      DOCS.filter(exists).flatMap((doc) =>
        targetsOf(read(doc)).map((target) => path.posix.normalize(path.posix.join(path.posix.dirname(doc), target))),
      ),
    )
    for (const file of placeholders) {
      expect(exists(file), `${file} exists now: remove it from ${PLACEHOLDER_LIST}`).toBe(false)
      expect(used.has(file), `${file} is listed but no guide shows it`).toBe(true)
    }
  })

  it('every anchor a guide links to exists', () => {
    const broken: string[] = []
    for (const doc of DOCS.filter(exists)) {
      for (const target of targetsOf(read(doc))) {
        if (external(target) || !target.includes('#')) continue
        const [file, anchor] = target.split('#')
        const markdownFile = file === '' ? doc : path.posix.normalize(path.posix.join(path.posix.dirname(doc), file))
        if (!markdownFile.endsWith('.md') || !exists(markdownFile)) continue
        if (!anchorsOf(read(markdownFile)).has(anchor)) broken.push(`${doc}: ${target}`)
      }
    }
    expect(broken).toEqual([])
  })

  it('nothing a learner keeps links to a file that is never published', () => {
    const kept = DOCS.filter((doc) => exists(doc) && !notPublished(doc))
    const broken: string[] = []
    for (const doc of kept) {
      for (const target of targetsOf(read(doc))) {
        if (external(target) || target.startsWith('#')) continue
        const file = path.posix.normalize(path.posix.join(path.posix.dirname(doc), decodeURI(target.split('#')[0])))
        if (notPublished(file)) broken.push(`${doc}: ${target}`)
      }
    }
    expect(kept).toContain('docs/guides/ux-decisions.md')
    expect(broken).toEqual([])
  })

  it('every guide (and anchor) the code points at exists', () => {
    const files = [...SOURCE_FILES, '.env.example', '.github/workflows/ci.yml']
    const broken: string[] = []
    for (const file of files) {
      for (const match of read(file).matchAll(/docs\/guides\/([\w-]+\.md)(?:#([\w-]+))?/g)) {
        const guide = `docs/guides/${match[1]}`
        if (!exists(guide)) broken.push(`${file}: ${match[0]}`)
        else if (match[2] && !anchorsOf(read(guide)).has(match[2])) broken.push(`${file}: ${match[0]}`)
      }
    }
    expect(broken).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------------
// The words the course's chapters share with this starter
// ---------------------------------------------------------------------------------------------------

describe('the fixed wording shared with the course', () => {
  const doc = (file: string) => (exists(file) ? read(file) : '')
  const readme = doc('README.md')
  const firstHour = doc('docs/guides/first-hour.md')
  const localSetup = doc('docs/guides/local-setup.md')
  const guides = DOCS.filter(exists).map((file) => [file, read(file)] as const)

  const w4 = read('src/components/site/Hero.tsx')
    .split(/\r?\n/)
    .find((line) => line.startsWith('// W4:'))
  const w5 = read('src/app/(site)/clinics/[slug]/page.tsx')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith('{/* W5:'))

  it('the README and the first-hour guide quote the W4 line exactly as Hero.tsx holds it', () => {
    expect(w4).toBe('// W4: put your own name in this tagline')
    expect(readme).toContain(w4)
    expect(firstHour).toContain(w4)
  })

  it('the README and the local set-up guide quote the W5 line exactly as the clinic page holds it', () => {
    expect(w5).toBe(`{/* W5: show the clinic's "What to bring" list here, the same way this page shows its prices below. */}`)
    expect(readme).toContain(w5)
    expect(localSetup).toContain(w5)
  })

  it('no guide quotes a W4 or W5 marker in other words', () => {
    const paraphrased: string[] = []
    for (const [file, text] of guides) {
      for (const line of text.split(/\r?\n/)) {
        if (/\/\/\s*W4\b/.test(line) && !line.includes(w4 ?? '?')) paraphrased.push(`${file}: ${line.trim()}`)
        if (/\{\/\*\s*W5\b/.test(line) && !line.includes(w5 ?? '?')) paraphrased.push(`${file}: ${line.trim()}`)
      }
    }
    expect(paraphrased).toEqual([])
  })

  it("the README gives W6's steps in the same words as the book-slot README, RepairChoice first", () => {
    const bookSlot = read('src/tasks/book-slot/README.md')
    // Without the first step RepairChoice stays undefined, and the types and the tests fail.
    const steps = [
      'remove the `//` in front of every line of the function\n     `RepairChoice` (marked W6). Then replace the whole line\n     `{/* W6: <RepairChoice repairs={props.repairs} /> */}` with `<RepairChoice repairs={props.repairs} />`.',
      'switch on the two lines the W6 comment in\n     createBooking.ts names: remove the `//` in front of `const repairs = formData.getAll(\'repairs\')…`',
    ]
    const flat = (text: string) => text.replace(/\s+/g, ' ')
    for (const step of steps) {
      expect(readme).toContain(step)
      expect(flat(bookSlot)).toContain(flat(step))
    }
    expect(readme.indexOf('`RepairChoice` (marked W6)')).toBeLessThan(readme.indexOf('the two lines the W6 comment'))
    // The old words pointed at the wrong place; only the course-check contract still uses them.
    for (const file of ['README.md', 'src/tasks/book-slot/README.md', 'src/components/site/BookingForm.tsx']) {
      expect(read(file), file).not.toMatch(/lines marked W6/)
    }
    // The line it means is really there.
    expect(read('src/components/site/BookingForm.tsx')).toContain('{/* W6: <RepairChoice repairs={props.repairs} /> */}')
  })

  it('names Node 22 as agreed, and no other version as tested', () => {
    expect(read('.nvmrc').trim()).toBe('22')
    expect(readme).toContain('Node 22 (the LTS this starter is tested on)')
    expect(localSetup).toContain('Node 22 (the LTS this starter is tested on)')
    for (const [file, text] of guides) expect(text, file).not.toMatch(/Node(\.js)? 2[3-9]\b/)
  })

  it('calls what W4 makes "your copy of the starter website", never a team website', () => {
    expect(firstHour).toMatch(/your copy of the starter website/i)
    for (const [file, text] of guides) expect(text, file).not.toMatch(/team website/i)
  })

  it('quotes the AI-note heading exactly as the pull request template holds it', () => {
    const heading = '## AI note: what I asked AI, and what I checked'
    expect(read('.github/pull_request_template.md')).toContain(heading)
    expect(firstHour).toContain(heading)
    for (const [file, text] of guides) {
      let fenced = false
      for (const line of text.split(/\r?\n/)) {
        if (line.startsWith('```')) fenced = !fenced
        // A guide's own heading (such as "## AI note: missing.") is not a quote of the template's.
        if (!fenced && line.startsWith('## ')) continue
        if (/## AI note/.test(line)) expect(line, file).toContain(heading)
      }
    }
  })

  it('names the six CI jobs exactly as .github/workflows/ci.yml does', () => {
    const ci = read('.github/workflows/ci.yml')
    const jobs = [...ci.slice(ci.indexOf('\njobs:\n')).matchAll(/^ {2}([a-z-]+):$/gm)].map((match) => match[1])
    expect(jobs).toHaveLength(6)
    for (const job of jobs) expect(firstHour).toContain(`\`${job}\``)
  })

  it('says "user", never "visitor", and never sends anyone to a teacher', () => {
    for (const [file, text] of guides) {
      expect(text, file).not.toMatch(/\bvisitors?\b/i)
      expect(text, file).not.toMatch(/ask your teacher/i)
    }
  })

  it('the Vercel functions run in Frankfurt, next to the database, as the first-hour guide says', () => {
    expect(JSON.parse(read('vercel.json'))).toEqual({ regions: ['fra1'] })
    expect(firstHour).toContain('Frankfurt (eu-central-1)')
    expect(firstHour).toContain('fra1')
  })
})

// ---------------------------------------------------------------------------------------------------
// The project document templates
// ---------------------------------------------------------------------------------------------------

describe('the project document templates', () => {
  it('exist where the course-check contract says the final check reads them', () => {
    const contract = read('docs/COURSE-CHECK-CONTRACT.md')
    const start = contract.indexOf('## Project documents (final check)')
    expect(start).toBeGreaterThan(-1)
    const end = contract.indexOf('\n## ', start + 1)
    const section = contract.slice(start, end === -1 ? undefined : end)
    // Four files by path, and the decisions folder: at least two filled records, under any names.
    expect(section).toContain(
      'reads four files by path: `docs/brief.md`, `docs/requirements.md`, `docs/test-report.md` and `docs/handover.md`',
    )
    expect(section).toContain('It reads the folder `docs/decisions/`, which passes when at least TWO `.md` files in it other than `README.md` contain no `TODO:`, under any names')
    for (const file of TEMPLATES) expect(exists(file), file).toBe(true)
    const records = filesIn('docs/decisions', (name) => name.endsWith('.md') && name !== 'README.md')
    expect(records.length, 'at least two decision records to start from').toBeGreaterThanOrEqual(2)
  })

  // The course's chapters "The project documents" and "Finishing and handing over" teach these
  // headings, in this order, and their activities and questions rely on them: change them only
  // together with those chapters.
  const DECISION_HEADINGS = [
    'The question',
    'Options considered',
    'The decision',
    'Why',
    'Consequences',
    'Facts read on',
    'Review when',
  ]
  const HEADINGS: Record<string, string[]> = {
    'docs/brief.md': ['What the site is for', 'Its users', 'The two tasks, ranked', 'Constraints', 'Not in this version'],
    'docs/decisions/analytics.md': DECISION_HEADINGS,
    'docs/decisions/integration.md': DECISION_HEADINGS,
    'docs/test-report.md': [
      'What was tested, and how',
      'What we saw',
      'What we changed, and the retest',
      'The release check',
      'Not tested yet',
    ],
    'docs/handover.md': ['Who owns what', 'Left out, and in which order', 'How you will know it works'],
    // The team kit's own templates, in its order.
    'docs/team-agreement.md': [
      'Members, roles and pairs',
      'How we communicate',
      'How we decide',
      'When a pull request is done',
      'The AI note',
      'When someone stops contributing',
      'Agreed by',
    ],
    'docs/content-structure.md': ['Content inventory', 'Content model', 'Sitemap', 'Navigation labels', 'Each user task, step by step'],
    'docs/design-rationale.md': [
      'Sketches',
      'Palette and type',
      'Layout at phone and laptop width',
      'The principles we applied',
      'Forms and feedback',
      'What makes it our own',
    ],
  }

  it.each(Object.entries(HEADINGS))('%s has the chapters\' section headings, in order', (file, headings) => {
    expect(sectionsOf(read(file)).map(({ heading }) => heading)).toEqual(headings)
  })

  it('the three team templates say on their first line that a learner working alone can delete them', () => {
    for (const file of TEAM_TEMPLATES) {
      expect(read(file).split(/\r?\n/)[0], file).toBe('For teams; a learner working alone can delete this file.')
    }
    expect(read('README.md')).toContain(
      'If you work in a team, you also fill in `docs/team-agreement.md`, `docs/content-structure.md` and `docs/design-rationale.md`.',
    )
  })

  it('each requirement has its id, what it serves, its check and its result', () => {
    const header = read('docs/requirements.md')
      .split(/\r?\n/)
      .find((line) => line.startsWith('|'))
    expect(header).toBe('| Id | Serves | Check | Result |')
  })

  it('the decision records README names the same seven headings, in order', () => {
    const named = [...read('docs/decisions/README.md').matchAll(/^\s+\d+\.\s+\*\*(.+?):\*\*/gm)].map((match) => match[1])
    expect(named).toEqual(DECISION_HEADINGS)
  })

  it('the decision records README asks for at least two records, as the final check does', () => {
    expect(read('docs/decisions/README.md')).toContain('at least two decision records')
  })

  it('the decision records README is instructions only: it has no TODO:', () => {
    expect(read('docs/decisions/README.md')).not.toContain('TODO:')
  })

  it('TODO: marks only the places a learner fills in, never an instruction', () => {
    // The final check passes once no TODO: is left, so an instruction that said "TODO:" would stay
    // behind in a finished document and fail it.
    for (const file of TEMPLATES) {
      for (const line of read(file).split(/\r?\n/).filter((text) => text.includes('TODO:'))) {
        expect(line, file).toMatch(/^\s*((\d+\.|-)\s+)?TODO:|\|\s*TODO:/)
      }
    }
  })

  it("the leftovers check never reads them (they are the learner's own documents)", () => {
    for (const file of TEMPLATES) expect(inScope(file), file).toBe(false)
  })

  // A learner fills these in, and the course's final check passes only once no TODO: is left. So this
  // check would fail in every finished project: it runs only for the template itself, in the
  // maintainers' publish steps, before it is published: STARTER_TEMPLATE=1.
  it.runIf(process.env.STARTER_TEMPLATE === '1')('in the template, each one a learner fills in still has a TODO:', () => {
    for (const file of TEMPLATES.filter((name) => name !== 'docs/decisions/README.md')) {
      expect(read(file), file).toContain('TODO:')
    }
  })
})
