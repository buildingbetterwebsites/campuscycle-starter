// The site's own rules (checks/checks.json), run through the course's "Check my page" evaluator
// (src/checks/checks.ts) in a real browser, at 1100 px and at 390 px (the two projects). A failing
// group prints its fix sentence: the same words a learner sees in the course.
import { expect, test } from '@playwright/test'
import { byCriterion, evaluate } from '../../src/checks/checks'
import { PlaywrightCheckDriver } from './checkDriver'
import { pagesToCheck, readChecksFile } from './checksFile'
import { BASE_URL, readFixture } from './helpers'

const file = readChecksFile()

for (const page of pagesToCheck(file)) {
  test(`checks.json: ${page.path}`, async ({ browser }, testInfo) => {
    const path = page.path.replace('{test-clinic}', () => readFixture().clinic.slug)
    // The evaluator starts every group at 1100 px; at the phone width, each group first narrows the page.
    const width = testInfo.project.use.viewport?.width
    const groups = width === 390 ? page.groups.map((group) => ({ ...group, steps: [{ width: 390 as const }, ...group.steps] })) : page.groups

    const run = await evaluate(groups, new PlaywrightCheckDriver(browser, BASE_URL, path))
    expect(run.status === 'page-error' ? `${run.message} (${run.detail})` : 'no page error').toBe('no page error')
    const failures = run.groups
      .filter((group) => group.status !== 'pass')
      .map((group) => `${file.criteria[group.criterion]} → ${group.status}: ${group.fix} [${group.detail ?? ''}]`)
    expect(failures, `${path} at ${width} px`).toEqual([])
    // Every criterion that has groups here was checked, and passed.
    expect([...byCriterion(run).values()].every((result) => result.status === 'pass')).toBe(true)
  })
}
