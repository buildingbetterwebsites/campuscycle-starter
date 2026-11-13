// checks/checks.json must stay something the course's evaluator (src/checks/checks.ts) can run: every
// step in its vocabulary, within its limits, and every rule (criterion) used. The browser check
// (tests/e2e/checks.spec.ts) then runs it on the real site.
import { describe, expect, it } from 'vitest'
import { CHECK_LIMITS, CHECK_STYLE_PROPS, CHECK_WIDTHS, type CheckStep } from '../../src/checks/checks'
import { pagesToCheck, readChecksFile } from '../e2e/checksFile'

const file = readChecksFile()
const pages = pagesToCheck(file)

// The one shape each kind of step may have (the CheckStep type in src/checks/checkTypes.ts).
function stepProblem(step: CheckStep): string | null {
  const keys = Object.keys(step).sort().join(',')
  const short = (value: unknown, limit: number) => typeof value === 'string' && value.length > 0 && value.length <= limit
  if ('click' in step) return keys === 'click' && short(step.click, CHECK_LIMITS.selector) ? null : 'click'
  if ('type' in step) return keys === 'type' && short(step.type[0], CHECK_LIMITS.selector) && step.type[1].length <= CHECK_LIMITS.value ? null : 'type'
  if ('select' in step) return keys === 'select' && short(step.select[0], CHECK_LIMITS.selector) && short(step.select[1], CHECK_LIMITS.value) ? null : 'select'
  if ('width' in step) return keys === 'width' && (CHECK_WIDTHS as readonly number[]).includes(step.width) ? null : 'width'
  if (!short(step.selector, CHECK_LIMITS.selector)) return `selector ${step.selector}`
  if ('count' in step) return keys === 'count,selector' && Number.isInteger(step.count) && step.count >= 0 ? null : 'count'
  if ('text' in step) return keys === 'selector,text' && short(step.text, CHECK_LIMITS.value) ? null : 'text'
  if ('textIncludes' in step) return keys === 'selector,textIncludes' && short(step.textIncludes, CHECK_LIMITS.value) ? null : 'textIncludes'
  if ('style' in step) {
    const props = Object.keys(step.style)
    return keys === 'selector,style' && props.length <= CHECK_LIMITS.styleProps && props.every((prop) => (CHECK_STYLE_PROPS as readonly string[]).includes(prop)) ? null : 'style'
  }
  if ('loaded' in step) return keys === 'loaded,selector' && step.loaded === true ? null : 'loaded'
  return `unknown step ${keys}`
}

describe('checks/checks.json', () => {
  it('names its rules, and every rule is checked somewhere', () => {
    expect(file.criteria.length).toBeGreaterThan(0)
    const used = new Set(pages.flatMap((page) => page.groups.map((group) => group.criterion)))
    expect([...used].sort()).toEqual(file.criteria.map((_, index) => index))
  })

  it('stays within the evaluator\'s vocabulary and limits, with room for the 390 px step', () => {
    for (const page of pages) {
      expect(page.groups.length, page.path).toBeLessThanOrEqual(CHECK_LIMITS.groups)
      for (const group of page.groups) {
        expect(group.steps.length, `${page.path}: ${group.fix}`).toBeLessThanOrEqual(CHECK_LIMITS.steps - 1)
        expect(group.fix.length).toBeLessThanOrEqual(CHECK_LIMITS.fix)
        expect(file.criteria[group.criterion]).toBeDefined()
        expect(group.steps.map(stepProblem).filter(Boolean), `${page.path}: ${group.fix}`).toEqual([])
      }
    }
  })
})
