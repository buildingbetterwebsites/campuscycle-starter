// The Campus Cycle example's checks/checks.json: the pages it must check, and one page run through the
// course's evaluator (src/checks/checks.ts). The rules for any site's checks.json are in
// tests/site/checks-json.test.ts.
import { describe, expect, it } from 'vitest'
import { evaluate, type CheckDriver } from '../../src/checks/checks'
import { pagesToCheck, readChecksFile } from '../e2e/checksFile'
import { EXAMPLE } from '../setup/example'

const file = readChecksFile()
const pages = pagesToCheck(file)

describe('checks/checks.json', () => {
  it('checks the pages a user reaches, starting with the two tasks', () => {
    const paths = pages.map((page) => page.path)
    // The example's workshop pages only while the site has them (tests/setup/example.ts).
    const workshopPages = EXAMPLE.workshopPages ? ['/workshops', '/workshops/adjust-your-brakes', '/topics/brakes-and-gears'] : []
    for (const path of ['/', ...workshopPages, '/clinics', '/clinics/{test-clinic}', '/about', '/privacy']) {
      expect(paths).toContain(path)
    }
    expect(paths.every((path) => path.startsWith('/'))).toBe(true)
  })

  it('checks every page for one h1, its landmarks and alt text; the clinic for labels and the practice-project notice', () => {
    const everyPage = JSON.stringify(file.everyPage)
    for (const selector of ['"h1"', 'body > header', 'main', 'body > footer', 'img:not([alt])']) expect(everyPage).toContain(selector)
    const clinic = JSON.stringify(pages.find((page) => page.path === '/clinics/{test-clinic}'))
    for (const field of ['name', 'email', 'note']) expect(clinic).toContain(`label[for=\\"${field}\\"]`)
    expect(clinic).toContain('This is a practice project: use made-up details; no one will contact you.')
  })

  it('runs through the evaluator: a page that answers every step right passes, one that does not fails with its fix', async () => {
    const page = pages.find((candidate) => candidate.path === '/clinics/{test-clinic}')!
    // A stand-in page that answers each step the way a good page does.
    const good = (): CheckDriver => ({
      begin: async () => {},
      end: async () => {},
      count: async (selector) => {
        const expected = page.groups.flatMap((group) => group.steps).find((step) => 'count' in step && step.selector === selector)
        return expected && 'count' in expected ? expected.count : 0
      },
      text: async () => 'Your name … This is a practice project: use made-up details; no one will contact you. Book this slot',
      style: async () => null,
      loaded: async () => true,
      click: async () => true,
      type: async () => true,
      select: async () => true,
      setWidth: async () => {},
    })
    const passed = await evaluate(page.groups, good())
    expect(passed.status).toBe('done')
    expect(passed.groups.map((group) => group.status)).toEqual(page.groups.map(() => 'pass'))

    // Two h1s and no notice: the headings rule and the notice rule fail, each with its fix.
    const bad = { ...good(), count: async (selector: string) => (selector === 'h1' ? 2 : good().count(selector)), text: async () => 'Your name Book this slot' }
    const failed = await evaluate(page.groups, bad)
    expect(failed.groups.filter((group) => group.status === 'fail').map((group) => group.criterion)).toEqual([0, 4])
  })
})
