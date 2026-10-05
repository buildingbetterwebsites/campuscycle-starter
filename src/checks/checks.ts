// VENDORED: do not edit; copy again from the course to update.
// A copy of the course's "Check my page" evaluator, so this site is checked by the same rules, in the
// same words, as the course's exercises (CI's browser-checks job runs checks/checks.json through it).
//   Copied from the course app's checker.
//   Source file: src/lib/exercises/checks.ts
// The changes from the source:
// - it imports the check vocabulary from ./checkTypes.js (the copy next to it) instead of
//   ../../../shared/exercises/checkTypes.js;
// - one word in the comment below differs from the source: it says "checked code questions".

/**
 * "Check my page": declarative checks for an exercise's success criteria, and the one evaluator that runs them.
 *
 * Pure on purpose: no imports beyond the shared check vocabulary (types and constants), no DOM, no components. The page is reached only through a `CheckDriver`, so the same
 * evaluator runs in the player (a hidden preview, over the exercise bridge), in the authoring scripts (puppeteer)
 * and, later, on the server for checked code questions. A unit test holds this module to that.
 *
 * A group belongs to one success criterion and runs in a fresh page. Its steps run in order: actions change the
 * page (click, type, select, width), expectations read it (count, text, textIncludes, style, loaded). The first
 * step that fails ends the group, and the learner sees the group's `fix` sentence.
 */

export { CHECK_STYLE_PROPS, CHECK_WIDTHS } from './checkTypes.js'
import type { CheckStep, CheckGroup, CheckStyleProp, CheckWidth } from './checkTypes.js'
export type { CheckStep, CheckGroup, CheckStyleProp, CheckWidth }

export const CHECK_LIMITS = {
  groups: 20,
  steps: 12,
  styleProps: 12,
  selector: 200,
  value: 200,
  fix: 300,
  /** Text a page reports back, after its spaces are collapsed. */
  text: 400,
  stepMs: 2000,
  /** One group's run: starting its fresh page and every step. */
  runMs: 10_000,
} as const

export const PAGE_ERROR_MESSAGE = 'Your page stopped with an error. Fix it first.'
/** When the check itself failed in a way nobody planned for (not the learner's page). */
export const CHECK_FAILED_MESSAGE = 'The check could not finish. Choose Check again.'

/** Thrown by a driver when the page itself stopped (a script error, or it never started). */
export class CheckPageError extends Error {}

/**
 * One page per group. `begin` opens a fresh one at 1100 px; `end` closes it. Queries answer about the first
 * matching element (`count` about all); `null` or `false` means nothing matched. Actions return false when
 * nothing matched, and resolve after the page has had a moment to react.
 */
export interface CheckDriver {
  begin(): Promise<void>
  end(): Promise<void>
  count(selector: string): Promise<number>
  text(selector: string): Promise<string | null>
  style(selector: string, props: CheckStyleProp[]): Promise<Record<string, string> | null>
  loaded(selector: string): Promise<boolean>
  click(selector: string): Promise<boolean>
  type(selector: string, text: string): Promise<boolean>
  select(selector: string, value: string): Promise<boolean>
  setWidth(width: CheckWidth): Promise<void>
}

export interface GroupResult {
  criterion: number
  fix: string
  status: 'pass' | 'fail' | 'timeout'
  /** The step that failed or ran out of time. */
  step?: number
  /** For authors and scripts, never shown to learners. */
  detail?: string
}

export type CheckRun =
  | { status: 'done'; groups: GroupResult[] }
  | { status: 'page-error'; message: string; detail: string; groups: GroupResult[] }

export interface EvaluateOptions { stepMs?: number; runMs?: number; now?: () => number }

/** Spaces, tabs and line breaks count as one space, and none at either end: HTML shows text that way. */
export const collapseSpace = (value: string) => value.replace(/\s+/g, ' ').trim()

class StepTimeout extends Error {}

function within<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new StepTimeout('timeout')), Math.max(0, ms))
    work.then(value => { clearTimeout(timer); resolve(value) }, error => { clearTimeout(timer); reject(error) })
  })
}

/** Runs one step; returns a reason when it fails, or null. */
async function runStep(step: CheckStep, driver: CheckDriver): Promise<string | null> {
  if ('click' in step) return await driver.click(step.click) ? null : `nothing matches ${step.click} to click`
  if ('type' in step) return await driver.type(step.type[0], step.type[1]) ? null : `nothing matches ${step.type[0]} to type in`
  if ('select' in step) return await driver.select(step.select[0], step.select[1]) ? null : `nothing matches ${step.select[0]} to choose from`
  if ('width' in step) { await driver.setWidth(step.width); return null }
  const { selector } = step
  if ('count' in step) {
    const found = await driver.count(selector)
    return found === step.count ? null : `${selector}: expected ${step.count}, found ${found}`
  }
  if ('text' in step || 'textIncludes' in step) {
    const raw = await driver.text(selector)
    if (raw === null) return `nothing matches ${selector}`
    const found = collapseSpace(raw)
    if ('text' in step) return found === collapseSpace(step.text) ? null : `${selector}: expected text "${step.text}", found "${found}"`
    return found.includes(collapseSpace(step.textIncludes)) ? null : `${selector}: expected text including "${step.textIncludes}", found "${found}"`
  }
  if ('style' in step) {
    const props = Object.keys(step.style) as CheckStyleProp[]
    const found = await driver.style(selector, props)
    if (!found) return `nothing matches ${selector}`
    const wrong = props.filter(prop => found[prop] !== step.style[prop])
    return wrong.length ? `${selector}: ${wrong.map(prop => `${prop} expected ${step.style[prop]}, found ${found[prop]}`).join('; ')}` : null
  }
  return await driver.loaded(selector) ? null : `${selector}: no image that finished loading`
}

async function runGroup(group: CheckGroup, driver: CheckDriver, stepMs: number, runMs: number, now: () => number): Promise<GroupResult> {
  const started = now()
  const left = () => runMs - (now() - started)
  const result = (status: GroupResult['status'], step?: number, detail?: string): GroupResult => ({ criterion: group.criterion, fix: group.fix, status, ...(step === undefined ? {} : { step }), ...(detail ? { detail } : {}) })
  try {
    await within(driver.begin(), left())
  } catch (error) {
    if (error instanceof StepTimeout) return result('timeout', undefined, 'the page did not start in time')
    throw error
  }
  for (const [index, step] of group.steps.entries()) {
    if (left() <= 0) return result('timeout', index, 'the run limit was reached')
    try {
      const failure = await within(runStep(step, driver), Math.min(stepMs, left()))
      if (failure) return result('fail', index, failure)
    } catch (error) {
      if (error instanceof StepTimeout) return result('timeout', index, 'the page did not answer in time')
      throw error
    }
  }
  return result('pass')
}

/** Runs every group in its own fresh page, in order. A page error stops the run. */
export async function evaluate(groups: CheckGroup[], driver: CheckDriver, options: EvaluateOptions = {}): Promise<CheckRun> {
  const stepMs = options.stepMs ?? CHECK_LIMITS.stepMs, runMs = options.runMs ?? CHECK_LIMITS.runMs, now = options.now ?? Date.now
  const results: GroupResult[] = []
  for (const group of groups) {
    try {
      results.push(await runGroup(group, driver, stepMs, runMs, now))
    } catch (error) {
      if (error instanceof CheckPageError) return { status: 'page-error', message: PAGE_ERROR_MESSAGE, detail: error.message, groups: results }
      throw error
    } finally {
      await driver.end().catch(() => undefined)
    }
  }
  return { status: 'done', groups: results }
}

/**
 * `evaluate` for the player: it always settles. An unexpected failure (not a `CheckPageError`) becomes a page-error
 * run with CHECK_FAILED_MESSAGE, so the panel never stays on "Checking…". Scripts call `evaluate` and see the error.
 */
export async function evaluateForLearner(groups: CheckGroup[], driver: CheckDriver, options: EvaluateOptions = {}): Promise<CheckRun> {
  try {
    return await evaluate(groups, driver, options)
  } catch (error) {
    return { status: 'page-error', message: CHECK_FAILED_MESSAGE, detail: String(error), groups: [] }
  }
}

export type CriterionResult = { status: 'pass' } | { status: 'fail'; fix: string } | { status: 'timeout' }

/** One result per checked criterion: it passes only when all its groups pass; the first failing group speaks. */
export function byCriterion(run: CheckRun): Map<number, CriterionResult> {
  const results = new Map<number, CriterionResult>()
  for (const group of run.groups) {
    const current = results.get(group.criterion)
    if (current && current.status !== 'pass') continue
    results.set(group.criterion, group.status === 'pass' ? { status: 'pass' } : group.status === 'fail' ? { status: 'fail', fix: group.fix } : { status: 'timeout' })
  }
  return results
}

/** The criteria that have checks, in order. */
export const checkedCriteria = (groups: CheckGroup[] | undefined) => [...new Set((groups ?? []).map(group => group.criterion))].sort((a, b) => a - b)
