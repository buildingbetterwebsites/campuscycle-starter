// Accessibility, checked by axe (the same engine as the browsers' accessibility tools) on every kind
// of page, at 390 and 1100 px. A check fails on any "serious" or "critical" problem; axe's smaller
// findings are printed but do not fail it.
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { readFixture } from './helpers'

// The test clinic's pages are known only once the global set-up has made it, so those two paths are
// read inside the check (readFixture), not here.
const pages = [
  { name: 'home', path: '/' },
  { name: 'workshops', path: '/workshops' },
  { name: 'workshops, filtered', path: '/workshops?topic=brakes-and-gears&level=beginner' },
  { name: 'a workshop', path: '/workshops/adjust-your-brakes' },
  { name: 'a topic', path: '/topics/brakes-and-gears' },
  { name: 'clinics', path: '/clinics' },
  { name: 'the clinic', path: () => `/clinics/${readFixture().clinic.slug}` },
  { name: 'the confirmation', path: () => readFixture().confirmation },
  { name: 'about', path: '/about' },
  { name: 'privacy', path: '/privacy' },
  { name: 'contact', path: '/contact' },
  { name: 'page not found', path: '/no-such-page', status: 404 },
]

for (const { name, path: where, status = 200 } of pages) {
  test(`${name}: no serious or critical accessibility problems`, async ({ page }, testInfo) => {
    const path = typeof where === 'function' ? where() : where
    const response = await page.goto(path)
    expect(response?.status()).toBe(status)
    // The page's own content is there (not a blank or half-loaded page).
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()
    const blocking = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    const minor = results.violations.filter((violation) => !blocking.includes(violation))
    if (minor.length) {
      testInfo.annotations.push({ type: 'axe (not failing)', description: minor.map((violation) => `${violation.id} (${violation.impact})`).join(', ') })
    }
    const report = blocking.map((violation) => `${violation.impact}: ${violation.id}: ${violation.help}\n  ${violation.nodes.map((node) => node.target.join(' ')).join('\n  ')}`)
    expect(report, `axe found serious or critical problems on ${path}`).toEqual([])
  })
}

// Without JavaScript, the 404 answer is right (status 404), but the page itself is blank: when a page
// calls notFound() while it is being made, Next.js 16 sends an empty page (<html id="__next_error__">)
// and draws the "not found" page with JavaScript, because its not-found boundary only works in the
// browser. Seen on the production build on 5 October 2026; a server-only not-found.tsx in the page's
// own folder changed nothing. A known limit (docs/guides/ux-decisions.md, "Known limits").
// The check below pins down exactly that state. The day Next.js renders this page on the server, it
// fails: then replace its last two lines with a check for the page's heading ("We could not find that
// page") and its link "Go to the home page", and remove the limit from the UX guide.
test('page not found, without JavaScript: a 404, and today the empty page Next.js sends (known limit)', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    for (const path of ['/no-such-page', '/workshops/no-such-workshop', '/a/b/c']) {
      expect((await page.goto(path))?.status(), path).toBe(404)
      expect(await page.locator('html').getAttribute('id'), path).toBe('__next_error__')
      expect((await page.locator('body').innerText()).trim(), path).toBe('')
    }
  } finally {
    await context.close()
  }
})
