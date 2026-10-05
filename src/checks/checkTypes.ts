// VENDORED: do not edit; copy again from the course to update.
// A copy of the course's "Check my page" evaluator, so this site is checked by the same rules, in the
// same words, as the course's exercises (CI's browser-checks job runs checks/checks.json through it).
//   Copied from the course app's checker.
//   Source file: shared/exercises/checkTypes.ts
// The one change from the source: none.

/**
 * The check vocabulary an exercise carries: the style properties and widths a check may use, and the shape of a step
 * and a group. Pure data and types, no imports, so both sides can hold them (`shared/` is a leaf: it imports neither
 * `src/` nor `api/`). The evaluator and its limits stay in src/lib/exercises/checks.ts, which re-exports these.
 */

/** Computed-style properties a check may read (camelCase, as `getComputedStyle` names them). */
export const CHECK_STYLE_PROPS = [
  'display', 'flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'gap', 'rowGap', 'columnGap',
  'width', 'maxWidth', 'height', 'boxSizing',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'borderLeftWidth', 'borderLeftStyle', 'borderLeftColor',
  'backgroundColor', 'color', 'fontSize', 'fontWeight', 'textAlign', 'textDecorationLine', 'visibility', 'position',
] as const
export type CheckStyleProp = typeof CHECK_STYLE_PROPS[number]

/** The two page widths a check can ask for: a phone and a laptop. The hidden page starts at 1100. */
export const CHECK_WIDTHS = [390, 1100] as const
export type CheckWidth = typeof CHECK_WIDTHS[number]

export type CheckStep =
  | { click: string }
  | { type: [string, string] }
  | { select: [string, string] }
  | { width: CheckWidth }
  | { selector: string; count: number }
  | { selector: string; text: string }
  | { selector: string; textIncludes: string }
  | { selector: string; style: Partial<Record<CheckStyleProp, string>> }
  | { selector: string; loaded: true }

export interface CheckGroup {
  /** Index into the exercise's successCriteria. Criteria without a group stay learner self-checks. */
  criterion: number
  steps: CheckStep[]
  /** What to change, in plain words, shown when this group fails. */
  fix: string
}
