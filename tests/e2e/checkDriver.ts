// The course's "Check my page" evaluator (src/checks/checks.ts) reaches a page only through a
// CheckDriver. This one drives a real browser page with Playwright: each group of checks gets a fresh
// page (begin), at 1100 px wide, as the evaluator expects, and closes it afterwards (end).
import type { Browser, BrowserContext, Page } from '@playwright/test'
import { CheckPageError, type CheckDriver, type CheckStyleProp, type CheckWidth } from '../../src/checks/checks'

// After a click, a choice or typing, the page may react (open something, show a message): give it a
// moment before the next step reads it.
const SETTLE_MS = 150

export class PlaywrightCheckDriver implements CheckDriver {
  private context?: BrowserContext
  private page?: Page
  private errors: string[] = []

  /** `path` is the page every group starts on, for example '/workshops'. */
  constructor(
    private readonly browser: Browser,
    private readonly baseURL: string,
    private readonly path: string,
  ) {}

  private get current(): Page {
    if (!this.page) throw new Error('begin() was not called')
    return this.page
  }

  async begin() {
    this.errors = []
    this.context = await this.browser.newContext({ baseURL: this.baseURL, viewport: { width: 1100, height: 800 } })
    this.page = await this.context.newPage()
    // A script error on the page stops the run, as in the course's checker ("Fix it first").
    this.page.on('pageerror', (error) => this.errors.push(error.message))
    const response = await this.page.goto(this.path)
    if (!response || response.status() >= 400) throw new CheckPageError(`${this.path} answered ${response?.status() ?? 'nothing'}`)
    this.stopOnPageError()
  }

  async end() {
    await this.context?.close()
    this.context = undefined
    this.page = undefined
  }

  private stopOnPageError() {
    if (this.errors.length) throw new CheckPageError(this.errors.join('; '))
  }

  async count(selector: string) {
    this.stopOnPageError()
    return this.current.locator(selector).count()
  }

  // The text a user sees (innerText): text hidden with CSS does not count.
  async text(selector: string) {
    this.stopOnPageError()
    const found = this.current.locator(selector).first()
    return (await found.count()) ? found.innerText() : null
  }

  async style(selector: string, props: CheckStyleProp[]) {
    this.stopOnPageError()
    const found = this.current.locator(selector).first()
    if (!(await found.count())) return null
    return found.evaluate((element, names) => {
      const computed = getComputedStyle(element) as unknown as Record<string, string>
      return Object.fromEntries(names.map((name) => [name, computed[name]]))
    }, props)
  }

  async loaded(selector: string) {
    this.stopOnPageError()
    const found = this.current.locator(selector).first()
    if (!(await found.count())) return false
    return found.evaluate((element) => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0)
  }

  async click(selector: string) {
    const found = this.current.locator(selector).first()
    if (!(await found.count())) return false
    await found.click()
    await this.current.waitForTimeout(SETTLE_MS)
    return true
  }

  async type(selector: string, text: string) {
    const found = this.current.locator(selector).first()
    if (!(await found.count())) return false
    await found.fill(text)
    await this.current.waitForTimeout(SETTLE_MS)
    return true
  }

  async select(selector: string, value: string) {
    const found = this.current.locator(selector).first()
    if (!(await found.count())) return false
    await found.selectOption(value)
    await this.current.waitForTimeout(SETTLE_MS)
    return true
  }

  async setWidth(width: CheckWidth) {
    await this.current.setViewportSize({ width, height: 800 })
    await this.current.waitForTimeout(SETTLE_MS)
  }
}
