// The public pages, rendered the way the server renders them: each page is an async server component,
// so the test awaits it (that is when it reads the database) and turns the result into HTML with
// react-dom/server. Runs on the test database, filled by the real seed.
import { readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { renderToString } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { seed } from '../../src/seed/seed'
import { forgetExampleAdded, getTestPayload, resetCollections, resetSiteFacts } from '../setup/payload'
import { refuseUnlessThrowAwayTestDatabase } from '../setup/safety'

// The navigation asks Next.js which address is open (usePathname). Outside a running Next.js server
// there is none, so the test decides it here.
const where = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => where.pathname,
}))

import HomePage from '../../src/app/(site)/page'
import PlainPage, { generateMetadata } from '../../src/app/(site)/[slug]/page'
import DeeperAddress from '../../src/app/(site)/[slug]/[...rest]/page'
import ContactPage, { generateMetadata as contactMetadata } from '../../src/app/(site)/contact/page'
import ClinicsPage from '../../src/app/(site)/clinics/page'
import NotFound from '../../src/app/(site)/not-found'
import { Header } from '../../src/components/site/Header'
import { Footer } from '../../src/components/site/Footer'
import { tabTitle } from '../setup/title'

// These tests delete every example record: never on a real database.
refuseUnlessThrowAwayTestDatabase()

const clean = ['bookings', 'timeSlots', 'clinics', 'workshops', 'topics', 'repairs', 'pages', 'media', 'users']

async function resetAll(p: Payload) {
  await resetCollections(clean)
  await forgetExampleAdded()
  await resetSiteFacts()
  const folder = String(p.collections.media.config.upload.staticDir)
  for (const name of readdirSync(folder)) rmSync(path.join(folder, name), { recursive: true, force: true })
}

const html = (element: React.ReactElement) => renderToString(element)
const params = (slug: string) => ({ params: Promise.resolve({ slug }) })

// What Next.js's notFound() and permanentRedirect() throw: an error whose "digest" says what to do.
async function digestOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return String((error as { digest?: string }).digest)
  }
  return 'no error thrown'
}

describe('the public pages', () => {
  let p: Payload

  beforeAll(async () => {
    p = await getTestPayload()
    await resetAll(p)
    await seed(p, { env: {} })
  })
  afterAll(async () => resetAll(p))

  it('home: the site name, the way to the workshops, and "opens soon" while there is no clinic', async () => {
    const page = html(await HomePage())
    expect(page).toContain('Campus Cycle')
    expect(page).toContain('href="/workshops"')
    expect(page).toContain('The repair clinic opens soon')
    expect(page).not.toContain('href="/clinics/')
    // Each workshop links to its own page, with its price and day from its record.
    expect(page).toContain('href="/workshops/repair-a-puncture"')
    expect(page).toContain('EUR 15')
    expect(page).toContain('Tuesday')
    // The topics are quick links into the filtered workshop list.
    expect(page).toContain('href="/workshops?topic=tyres-and-wheels"')
    // The pricing rule comes from the Site facts global.
    expect(page).toContain('Bring your own parts and pay EUR 5 less per bicycle.')
  })

  it('one source per fact: a pricing rule changed in Site facts shows on the home page; a changed e-mail on Contact', async () => {
    const before = await p.findGlobal({ slug: 'site-facts' })
    try {
      await p.updateGlobal({
        slug: 'site-facts',
        data: { pricingRule: 'Parts cost extra (changed by an editor).', email: 'workshops@changed.example' },
        overrideAccess: true,
      })
      const home = html(await HomePage())
      expect(home).toContain('Parts cost extra (changed by an editor).')
      expect(home).not.toContain('Bring your own parts')
      const contact = html(await ContactPage())
      expect(contact).toContain('href="mailto:workshops@changed.example"')
      expect(contact).not.toContain('hello@campuscycle.example')
    } finally {
      await p.updateGlobal({
        slug: 'site-facts',
        data: { pricingRule: before.pricingRule, email: before.email },
        overrideAccess: true,
      })
    }
  })

  it('/contact shows its page record, and the e-mail address and place from Site facts as a labelled list', async () => {
    const page = html(await ContactPage())
    expect(page).toContain('<h1')
    expect(page).toContain('Contact')
    expect(page).toContain('Questions about a workshop or the repair clinic? Send us an e-mail.')
    expect(page).toContain('There is no contact form on this site: send an e-mail instead.')
    expect(page).toMatch(/<dt[^>]*>E-mail<\/dt><dd[^>]*><a href="mailto:hello@campuscycle.example">hello@campuscycle.example<\/a><\/dd>/)
    expect(page).toMatch(/<dt[^>]*>Place<\/dt><dd[^>]*>Workshop B, Student Centre<\/dd>/)
    expect(await tabTitle(contactMetadata())).toBe('Contact · Campus Cycle')
  })

  it('home: links to the newest clinic once one exists', async () => {
    const older = await p.create({
      collection: 'clinics',
      data: {
        name: 'Spring repair clinic',
        slug: 'spring-repair-clinic',
        day: 'Saturday',
        startTime: '15:00',
        endTime: '17:00',
        summary: 'An older clinic.',
      },
    })
    const clinic = await p.create({
      collection: 'clinics',
      data: {
        name: 'Saturday repair clinic',
        slug: 'saturday-repair-clinic',
        day: 'Saturday',
        startTime: '15:00',
        endTime: '17:00',
        summary: 'Bring your bicycle for a check or a small repair.',
      },
    })
    try {
      const page = html(await HomePage())
      expect(page).toContain('href="/clinics/saturday-repair-clinic"')
      expect(page).not.toContain('href="/clinics/spring-repair-clinic"')
      expect(page).not.toContain('The repair clinic opens soon')
      const list = html(await ClinicsPage())
      expect(list).toContain('href="/clinics/saturday-repair-clinic"')
      expect(list).toContain('Saturday repair clinic')
    } finally {
      await p.delete({ collection: 'clinics', id: clinic.id })
      await p.delete({ collection: 'clinics', id: older.id })
    }
  })

  it('/clinics: the truthful empty state while there is no clinic', async () => {
    const list = html(await ClinicsPage())
    expect(list).toContain('The repair clinic opens soon')
  })

  it('/about shows the about page record, with a title for the browser tab', async () => {
    const page = html(await PlainPage(params('about')))
    expect(page).toContain('About Campus Cycle')
    expect(page).toContain('Photo credits')
    expect(await tabTitle(generateMetadata(params('about')))).toBe('About Campus Cycle · Campus Cycle')
  })

  it('an unknown page calls notFound(); /home is sent to / (the home page has its own address)', async () => {
    expect(await digestOf(PlainPage(params('no-such-page')))).toMatch(/404/)
    expect(await digestOf(PlainPage(params('home')))).toMatch(/^NEXT_REDIRECT;replace;\/;308;/)
  })

  it('with an empty Site facts global (a site before its first seed), home and Contact still render cleanly', async () => {
    await resetSiteFacts()
    try {
      const home = html(await HomePage())
      const contact = html(await ContactPage())
      for (const [name, page] of [['home', home], ['contact', contact]]) {
        expect(page, name).not.toMatch(/undefined|null/)
        expect(page, name).not.toContain('mailto:')
      }
      // An empty fact is left out: no pricing note on home, no e-mail or place row on Contact.
      expect(home).not.toContain('Good to know')
      expect(contact).not.toContain('<dl')
      expect(contact).toContain('There is no contact form on this site')
    } finally {
      // The seed fills an empty global again (and keeps every record that exists).
      await seed(p, { env: {} })
    }
  })

  it('/contact gives the 404 when its page record is missing', async () => {
    const contact = (await p.find({ collection: 'pages', where: { slug: { equals: 'contact' } } })).docs[0]
    await p.delete({ collection: 'pages', id: contact.id })
    try {
      expect(await digestOf(ContactPage())).toBe('NEXT_HTTP_ERROR_FALLBACK;404')
    } finally {
      await seed(p, { env: {} })
    }
  })

  it('a deeper unknown address, such as /about/old or /a/b/c, calls notFound() too', async () => {
    expect(await digestOf(Promise.resolve().then(() => DeeperAddress()))).toBe('NEXT_HTTP_ERROR_FALLBACK;404')
  })

  it('the 404 page offers a way back to Home and to the workshops', () => {
    const page = html(<NotFound />)
    expect(page).toContain('href="/"')
    expect(page).toContain('href="/workshops"')
  })

  it('the footer reads nothing from the database: no e-mail address or place, but a link to Contact', () => {
    const footer = html(<Footer />)
    expect(footer).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/)
    expect(footer).not.toContain('mailto:')
    expect(footer).not.toContain('Workshop B')
    expect(footer).toContain('href="/contact"')
    expect(footer).toContain('href="/privacy"')
  })

  it('the main navigation is labelled "Main" and marks the page that is open', async () => {
    where.pathname = '/about'
    // Header is an async server component (it looks for a logged-in member when the optional members'
    // area is on), so the test awaits it and renders what it returns.
    const header = html(await Header())
    expect(header).toContain('aria-label="Main"')
    expect(header).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/about"|<a[^>]*href="\/about"[^>]*aria-current="page"/)
    expect(header.match(/aria-current=/g)).toHaveLength(1)
    // The repair clinic's own pages count as being in the "Repair clinic" part of the site.
    where.pathname = '/clinics/saturday-repair-clinic'
    const inClinic = html(await Header())
    expect(inClinic).toMatch(/<a[^>]*href="\/clinics"[^>]*aria-current="true"|<a[^>]*aria-current="true"[^>]*href="\/clinics"/)
    expect(html(await Header())).toContain('Skip to main content')
  })
})
