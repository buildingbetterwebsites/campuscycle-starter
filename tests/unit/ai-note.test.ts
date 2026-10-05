// The AI note check (scripts/ci/ai-note.mjs), on pull request descriptions. The template itself
// (.github/pull_request_template.md) is checked too: as it comes, it must FAIL, because its AI note
// holds only the hint.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AI_NOTE_TITLE, checkAiNote } from '../../scripts/ci/ai-note.mjs'

const TEMPLATE = readFileSync(new URL('../../.github/pull_request_template.md', import.meta.url), 'utf8')
const HEADING = '## AI note: what I asked AI, and what I checked'
const HINT = '<!-- Write what you asked an AI tool and how you checked its answer. If you used no AI, write: No AI used. -->'

// The template with its AI note replaced by `note`.
const withNote = (note: string) => TEMPLATE.replace(HINT, note)

describe('the pull request template', () => {
  it('ends with the AI note heading, exactly as the course checkers expect, and the hint under it', () => {
    expect(AI_NOTE_TITLE).toBe('AI note: what I asked AI, and what I checked')
    expect(TEMPLATE.trimEnd().endsWith(`${HEADING}\n\n${HINT}`)).toBe(true)
  })

  it('has the sections in order, with the user checklist (never "visitor")', () => {
    const headings = TEMPLATE.split('\n').filter((line) => line.startsWith('## '))
    expect(headings).toEqual([
      '## What and why',
      '## How to check it',
      '## Screenshots',
      '## User checklist',
      '## Why this removes or renames',
      HEADING,
    ])
    for (const item of ['headings tell the story', 'keyboard', 'visible|see where the focus', 'narrow width', 'alt text', 'label', 'promises nothing it cannot keep']) {
      expect(TEMPLATE).toMatch(new RegExp(`- \\[ \\] .*(${item})`, 'i'))
    }
    expect(TEMPLATE).not.toMatch(/visitor/i)
  })
})

describe('checkAiNote', () => {
  it('fails on the template as it comes: only the hint', () => {
    const result = checkAiNote(TEMPLATE)
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/^AI note: empty\./)
    expect(result.message).toContain('If you used no AI, write: No AI used.')
  })

  it('fails on an empty section, also when the next section follows straight after', () => {
    expect(checkAiNote(withNote('')).ok).toBe(false)
    expect(checkAiNote(`${HEADING}\n\n   \n## Something else\nText`).ok).toBe(false)
    expect(checkAiNote(`${HEADING}\r\n\r\n`).ok).toBe(false)
  })

  it("fails when the hint's words are left with the <!-- --> removed", () => {
    expect(checkAiNote(withNote(HINT.replace('<!-- ', '').replace(' -->', ''))).ok).toBe(false)
  })

  it('fails when the heading is missing, or the description is empty (GitHub sends null)', () => {
    for (const body of ['', null, undefined, 'What and why: a fix.', '## AI note\n\nNo AI used.', '### AI note: what I asked AI, and what I checked\n\nNo AI used.']) {
      const result = checkAiNote(body)
      expect(result.ok).toBe(false)
      expect(result.message).toMatch(/^AI note: missing\./)
      expect(result.message).toContain(HEADING)
    }
  })

  it('passes "No AI used."', () => {
    expect(checkAiNote(withNote('No AI used.'))).toEqual({ ok: true, message: 'AI note: filled in. Thank you.' })
  })

  it('passes two sentences, also with the hint left above them', () => {
    const note = 'I asked Claude why the slot list was empty. I checked its answer by reading the query and testing it with two slots.'
    expect(checkAiNote(withNote(note)).ok).toBe(true)
    expect(checkAiNote(withNote(`${HINT}\n${note}`)).ok).toBe(true)
  })

  it('reads only its own section: text in the other sections does not count', () => {
    const body = TEMPLATE.replace('<!-- What does this change, and why?', 'No AI used.\n<!-- What does this change, and why?')
    expect(checkAiNote(body).ok).toBe(false)
  })

  it('run directly, reads PR_BODY and exits 1 on a failure, 0 on a pass', () => {
    const run = (body: string) => spawnSync(process.execPath, ['scripts/ci/ai-note.mjs'], { env: { ...process.env, PR_BODY: body, GITHUB_ACTIONS: '' }, encoding: 'utf8' })
    const failed = run(TEMPLATE)
    expect(failed.status).toBe(1)
    expect(failed.stdout).toMatch(/^AI note: empty\./)
    const passed = run(withNote('No AI used.'))
    expect(passed.status).toBe(0)
    expect(passed.stdout.trim()).toBe('AI note: filled in. Thank you.')
  })
})
