// The CI workflow's fixed names are a contract with the course's checkers
// (docs/COURSE-CHECK-CONTRACT.md, "Other fixed names"), and two of its settings protect the
// repository. This reads .github/workflows/ci.yml as text and checks them.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ci = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8')

describe('.github/workflows/ci.yml', () => {
  it('is the workflow "CI" with exactly the six jobs the course checkers know, in order', () => {
    expect(ci).toMatch(/^name: CI$/m)
    // The job names: two spaces in, after the line "jobs:" (the triggers above are indented the same way).
    const jobs = [...ci.slice(ci.indexOf('\njobs:\n')).matchAll(/^ {2}([a-z-]+):$/gm)].map((match) => match[1])
    expect(jobs).toEqual(['test', 'types-fresh', 'migrations', 'browser-checks', 'ai-note', 'leftovers'])
  })

  it('runs every job again when a pull request is edited, so each commit keeps a full result', () => {
    // "edited": saving a fixed AI note (or a reason for a removal) runs the checks again without a new
    // commit. Every job runs on it, not only ai-note: an edit cancels the run still in progress for
    // the same pull request (the concurrency group below), and a partial re-run would leave that
    // commit without test results.
    expect(ci).toMatch(/^ {2}pull_request:\n(?: {4}#.*\n)* {4}types: \[opened, synchronize, reopened, edited\]$/m)
    expect(ci).toMatch(/^ {2}push:\n {4}branches: \[main\]$/m)
  })

  it('groups runs per branch or pull request', () => {
    expect(ci).toMatch(/^concurrency:\n {2}group: ci-\$\{\{ github\.ref \}\}$/m)
  })

  it('only reads the repository: contents read, and no job asks for more', () => {
    expect(ci).toMatch(/^permissions:\n {2}contents: read\n/m)
    expect(ci.match(/^\s*permissions:/gm)).toHaveLength(1)
  })

  it('never uses pull_request_target, which would run a stranger’s pull request with write access', () => {
    expect(ci).not.toContain('pull_request_target')
  })

  it('cancels outdated runs only for pull requests, never on main', () => {
    expect(ci).toMatch(/^ {2}cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}$/m)
  })

  it('passes the pull request description only through env, never into a command line', () => {
    const lines = ci.split('\n')
    const uses = lines.filter((line) => line.includes('github.event.pull_request.body'))
    expect(uses.length).toBeGreaterThan(0)
    for (const line of uses) expect(line).toMatch(/^\s+PR_BODY: \$\{\{ github\.event\.pull_request\.body \}\}$/)
  })

  it('runs ai-note only for pull requests, and leftovers only when switched on', () => {
    expect(ci).toMatch(/ {2}ai-note:\n {4}if: github\.event_name == 'pull_request'/)
    expect(ci).toMatch(/ {2}leftovers:\n {4}if: vars\.CAMPUS_CYCLE_LEFTOVERS == 'fail'/)
  })
})
