// Shared by the browser checks: where the site is, the test clinic, and a few helpers.
import { createHash } from 'node:crypto'
import type { APIRequestContext, Page, TestInfo } from '@playwright/test'
import type { Fixture } from './fixture'

// The site under test: a production build (next build, then next start) with the seed.
export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3100'

// The words the checks expect, exactly as the site shows them (src/content/campus-cycle.ts and the
// booking form). Module 10's booking chapter quotes them too.
export const MADE_UP_DATA_NOTICE = 'This is a practice project: use made-up details; no one will contact you.'
export const BOOKING_CONFIRMATION = `Your booking is saved. ${MADE_UP_DATA_NOTICE}`
export const NOT_CONFIRMED = [
  'We could not reach the server, so we cannot say whether your booking was saved.',
  'Check your internet connection and press "Book this slot" again. You will not be booked twice.',
]

export function readFixture(): Fixture {
  if (!process.env.E2E_FIXTURE) throw new Error('No test clinic: run the checks with npm run check (its global set-up makes one).')
  return JSON.parse(process.env.E2E_FIXTURE) as Fixture
}

/**
 * Gives this test its own made-up device address. The booking form allows 5 bookings an hour per
 * address (src/tasks/book-slot/guards.ts reads x-forwarded-for); without this, every check that books
 * would share one address and run into that limit.
 */
export async function useOwnAddress(page: Page, testInfo: TestInfo) {
  const n = createHash('sha256').update(`${testInfo.project.name}:${testInfo.titlePath.join('/')}:${Date.now()}`).digest()
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': `10.${n[0]}.${n[1]}.${n[2]}` })
}

/**
 * How many bookings have this request id, read through Payload's REST API as the first editor
 * (FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD, the same settings the seed used). Bookings are
 * private: only an editor may read them.
 */
export async function countBookings(request: APIRequestContext, requestId: string): Promise<number> {
  const login = await request.post(new URL('/api/users/login', BASE_URL).href, {
    data: { email: process.env.FIRST_ADMIN_EMAIL, password: process.env.FIRST_ADMIN_PASSWORD },
  })
  if (!login.ok()) throw new Error(`Could not log in as the first editor (${login.status()}): set FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD as for the seed.`)
  const { token } = (await login.json()) as { token: string }
  const found = await request.get(new URL('/api/bookings', BASE_URL).href, {
    params: { 'where[requestId][equals]': requestId, depth: '0', limit: '10' },
    headers: { Authorization: `JWT ${token}` },
  })
  if (!found.ok()) throw new Error(`Could not read the bookings (${found.status()}).`)
  return ((await found.json()) as { totalDocs: number }).totalDocs
}
