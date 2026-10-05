// Reads checks/checks.json: the pages to check and, for each, its groups of checks in the course
// evaluator's own vocabulary (src/checks/checks.ts). Shared by the browser check (checks.spec.ts) and
// the unit test that keeps the file valid (tests/unit/checks-json.test.ts).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { CheckGroup } from '../../src/checks/checks'

export type ChecksFile = {
  about: string[]
  criteria: string[]
  everyPage: CheckGroup[]
  pages: { path: string; groups?: CheckGroup[] }[]
}

export function readChecksFile(root = process.cwd()): ChecksFile {
  return JSON.parse(readFileSync(path.join(root, 'checks', 'checks.json'), 'utf8')) as ChecksFile
}

/** Every page with all of its groups: the ones for every page first, then its own. */
export function pagesToCheck(file: ChecksFile): { path: string; groups: CheckGroup[] }[] {
  return file.pages.map((page) => ({ path: page.path, groups: [...file.everyPage, ...(page.groups ?? [])] }))
}
