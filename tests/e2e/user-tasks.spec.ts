// The site's two user tasks, done in a real browser at 390 and 1100 px (the two projects in
// playwright.config.ts):
//   task 1: find a workshop by topic and level, then follow a topic to its other workshops;
//   task 2: book a time slot at the repair clinic, including what happens when a user makes a mistake
//           and when the connection drops while the booking is sent.
import { expect, test, type Page } from '@playwright/test'
import { runFixture } from './global-setup'
import { BOOKING_CONFIRMATION, countBookings, MADE_UP_DATA_NOTICE, NOT_CONFIRMED, readFixture, useOwnAddress } from './helpers'

test.describe('task 1: find a workshop by topic and level', () => {
  test('filter by topic and level, open a workshop, follow its topic to the other side, and come back to the same filters', async ({ page }) => {
    await page.goto('/workshops')
    await expect(page.getByRole('heading', { level: 1, name: 'Workshops' })).toBeVisible()

    await page.getByLabel('Topic').selectOption({ label: 'Brakes and gears' })
    await page.getByLabel('Level').selectOption({ label: 'Beginner' })
    await page.getByRole('button', { name: 'Apply filters' }).click()

    // The filters are in the address, so the list can be shared and Back finds it again.
    await expect(page).toHaveURL(/\/workshops\?topic=brakes-and-gears&level=beginner#results$/)
    const results = page.locator('#results')
    await expect(results.getByRole('link', { name: 'Adjust your brakes' })).toBeVisible()
    await expect(results.getByRole('link', { name: 'Service a gear system' })).toHaveCount(0)

    await results.getByRole('link', { name: 'Adjust your brakes' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Adjust your brakes' })).toBeVisible()

    // The topic leads to its own page, which lists the workshops from the other side of the link.
    await page.getByRole('main').getByRole('link', { name: 'Brakes and gears' }).click()
    await expect(page).toHaveURL(/\/topics\/brakes-and-gears$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Brakes and gears' })).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: 'Adjust your brakes' })).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: 'Service a gear system' })).toBeVisible()

    // The browser's Back button, then the workshop page's own way back: the filters are still chosen.
    await page.goBack()
    await expect(page.getByRole('heading', { level: 1, name: 'Adjust your brakes' })).toBeVisible()
    await page.getByRole('link', { name: 'Back to the filtered workshops' }).click()
    await expect(page).toHaveURL(/\/workshops\?topic=brakes-and-gears&level=beginner/)
    await expect(page.getByLabel('Topic')).toHaveValue('brakes-and-gears')
    await expect(page.getByLabel('Level')).toHaveValue('beginner')
    await expect(page.locator('#results').getByRole('link', { name: 'Adjust your brakes' })).toBeVisible()
  })
})

test.describe('task 2: book a time slot at the repair clinic', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await useOwnAddress(page, testInfo)
  })

  // Opens the test clinic from the clinic list, as a user would.
  async function openClinic(page: Page) {
    const { clinic } = readFixture()
    await page.goto('/clinics')
    await page.getByRole('main').getByRole('link', { name: clinic.name }).first().click()
    await expect(page).toHaveURL(new RegExp(`/clinics/${clinic.slug}$`))
    await expect(page.getByRole('heading', { level: 1, name: clinic.name })).toBeVisible()
  }

  async function fillIn(page: Page) {
    await page.getByRole('radio').first().check()
    await page.getByLabel('Your name').fill('Test Person')
    await page.getByLabel('Your e-mail address').fill('test@example.com')
  }

  const requestIdOf = (page: Page) => page.locator('input[name="requestId"]').inputValue()

  test('choose a slot, give a name and an e-mail address, book, and see the confirmation word for word', async ({ page }) => {
    await openClinic(page)
    await expect(page.locator('form').filter({ has: page.locator('input[name="requestId"]') })).toContainText(MADE_UP_DATA_NOTICE)
    await fillIn(page)
    await page.getByRole('button', { name: 'Book this slot' }).click()

    await expect(page).toHaveURL(/\/clinics\/e2e-check-clinic\/booked\?ref=\d+\.[0-9a-f]{32}$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Booking saved' })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Your booking is saved.' })).toContainText(BOOKING_CONFIRMATION)
    await expect(page.getByText(BOOKING_CONFIRMATION, { exact: true })).toBeVisible()
  })

  test('a mistake: the form says what is wrong, moves the focus there, and keeps what was typed', async ({ page }) => {
    await openClinic(page)
    await page.getByLabel('Your name').fill('Test Person')
    await page.getByLabel('Your e-mail address').fill('not-an-address')
    await page.getByLabel('Note').fill('The back brake squeaks.')
    await page.getByRole('button', { name: 'Book this slot' }).click()

    const problem = page.getByRole('alert').filter({ hasText: 'Not saved' })
    await expect(problem).toBeVisible()
    await expect(problem.getByRole('link')).toHaveCount(2)
    await expect(problem.getByRole('link', { name: 'Enter your e-mail address in the right form, like name@example.com.' })).toBeVisible()
    // The keyboard focus moved to the box, so a screen reader reads it out.
    await expect(page.locator(':focus')).toContainText('Not saved')
    await expect(page.getByLabel('Your e-mail address')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Your name')).toHaveValue('Test Person')
    await expect(page.getByLabel('Your e-mail address')).toHaveValue('not-an-address')
    await expect(page.getByLabel('Note')).toHaveValue('The back brake squeaks.')
    await expect(page).toHaveURL(/\/clinics\/e2e-check-clinic$/)
  })

  test('the connection drops before the booking reaches the server: "Not confirmed", everything kept; sending again books once', async ({ page, request }) => {
    await openClinic(page)
    await fillIn(page)
    await page.getByLabel('Note').fill('Sent while offline.')
    const requestId = await requestIdOf(page)

    // The booking form's send is a POST to the clinic page's own address: make it fail as a dropped
    // connection would.
    await page.route('**/clinics/e2e-check-clinic', (route) => (route.request().method() === 'POST' ? route.abort('internetdisconnected') : route.fallback()))
    await page.getByRole('button', { name: 'Book this slot' }).click()

    const box = page.getByRole('alert').filter({ hasText: 'Not confirmed' })
    await expect(box).toBeVisible()
    await expect(box).toContainText(NOT_CONFIRMED[0])
    await expect(box).toContainText(NOT_CONFIRMED[1])
    await expect(page.getByRole('radio').first()).toBeChecked()
    await expect(page.getByLabel('Your name')).toHaveValue('Test Person')
    await expect(page.getByLabel('Your e-mail address')).toHaveValue('test@example.com')
    await expect(page.getByLabel('Note')).toHaveValue('Sent while offline.')
    expect(await requestIdOf(page)).toBe(requestId)
    expect(await countBookings(request, requestId)).toBe(0)

    // The connection is back: the same press books it, once.
    await page.unroute('**/clinics/e2e-check-clinic')
    await page.getByRole('button', { name: 'Book this slot' }).click()
    await expect(page).toHaveURL(/\/booked\?ref=/)
    await expect(page.getByText(BOOKING_CONFIRMATION, { exact: true })).toBeVisible()
    expect(await countBookings(request, requestId)).toBe(1)
  })

  test('saved, then the answer lost on the way back: sending again shows the saved booking, and there is still one', async ({ page, request }) => {
    await openClinic(page)
    await fillIn(page)
    const requestId = await requestIdOf(page)

    // The request reaches the server, which saves the booking; its answer never reaches the browser.
    await page.route('**/clinics/e2e-check-clinic', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      await route.fetch()
      await route.abort('connectionreset')
    })
    await page.getByRole('button', { name: 'Book this slot' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Not confirmed' })).toBeVisible()
    expect(await countBookings(request, requestId)).toBe(1)
    expect(await requestIdOf(page)).toBe(requestId)

    await page.unroute('**/clinics/e2e-check-clinic')
    await page.getByRole('button', { name: 'Book this slot' }).click()
    await expect(page).toHaveURL(/\/booked\?ref=/)
    await expect(page.getByText(BOOKING_CONFIRMATION, { exact: true })).toBeVisible()
    expect(await countBookings(request, requestId)).toBe(1)
  })

  test('the database fails while the clinic is shown: the error page says so, and "Try again" shows the clinic once it works', async ({ page }) => {
    const { clinic } = readFixture()
    // The clinics table is renamed for a moment (fixture.ts break): every read of a clinic fails.
    runFixture('break')
    try {
      const response = await page.goto(`/clinics/${clinic.slug}`)
      expect(response?.status()).toBe(500)
      await expect(page.getByRole('heading', { level: 1, name: 'This page could not be shown' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'All repair clinics' })).toBeVisible()
    } finally {
      runFixture('mend')
    }
    // "Try again" asks the server again (Next.js's retry), so the page now works without a reload.
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('heading', { level: 1, name: clinic.name })).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/clinics/${clinic.slug}$`))
  })
})
