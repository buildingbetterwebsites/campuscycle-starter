// Which of the starter's tests run in this copy. One question decides it: is this copy still the
// Campus Cycle example?
//
//   'example'  Still Campus Cycle (also after W4, W5, W6 and npm run remove-example): every test runs.
//   'site'     The site has a name of its own (docs/guides/recipes.md, R1): only the tests that hold for
//              any site run. Those are the ones in tests/site, and the browser checks that read the
//              site's own checks/checks.json. The starter's tests of the Campus Cycle example and of
//              the starter itself are left out, also from the type check and from the build.
//   'all'      The template itself, before anyone changed it: every test, and the few that hold only
//              there (a learner's W5 and W6 changes end them).
//
// The copy is Campus Cycle while src/content/campus-cycle.ts gives the site that name. The file is
// read as text and never imported: in a team's copy it may have another name, or be gone.
//
// The setting STARTER_TESTS overrides the answer: STARTER_TESTS=all or STARTER_TESTS=site. The
// template's own CI sets all (.github/workflows/ci.yml), so its tests can never be left out by mistake.
//
// The tests that are left out in 'site' are listed once, in tsconfig.site.json (its "exclude"): the type
// check and the build read that file themselves, and Vitest and Playwright get the list from here.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

export const SITE_TSCONFIG = 'tsconfig.site.json'

/**
 * Is this copy still the Campus Cycle example?
 *
 * @param {string} [root] the project's folder
 */
export function isCampusCycle(root = ROOT) {
  try {
    const content = readFileSync(path.join(root, 'src/content/campus-cycle.ts'), 'utf8')
    return /^export const SITE_NAME\s*=\s*['"]Campus Cycle['"]/m.test(content)
  } catch {
    return false
  }
}

/**
 * Which tests run in this copy (see the top of this file).
 *
 * @param {Record<string, string | undefined>} [env]
 * @param {string} [root] the project's folder
 * @returns {'all' | 'example' | 'site'}
 */
export function starterTests(env = process.env, root = ROOT) {
  const forced = env.STARTER_TESTS
  // The older name for the template's own run: stop, so that run never passes with tests left out.
  if (env.STARTER_TEMPLATE) throw new Error('STARTER_TEMPLATE is no longer read: set STARTER_TESTS=all instead.')
  if (forced === 'all' || forced === 'site') return forced
  if (forced) throw new Error(`STARTER_TESTS is "${forced}": set it to all or to site, or leave it out.`)
  return isCampusCycle(root) ? 'example' : 'site'
}

/**
 * The starter's tests of the Campus Cycle example and of the starter itself, with the helpers only
 * they use: the paths under tests/ that tsconfig.site.json leaves out.
 *
 * @param {string} [root] the project's folder
 * @returns {string[]}
 */
export function exampleTests(root = ROOT) {
  // A tsconfig file may start with comment lines, which JSON itself does not allow.
  const json = readFileSync(path.join(root, SITE_TSCONFIG), 'utf8').replace(/^\s*\/\/.*$/gm, '')
  return JSON.parse(json).exclude.filter((/** @type {string} */ entry) => entry.startsWith('tests/'))
}
