// Example task 1, "find a workshop by topic and level", rendered the way the server renders it, on
// the test database filled by the real seed. Each page is an async server component: the test awaits
// it with the address's parts (params, searchParams) and turns the result into HTML.
import { readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { renderToString } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { seed } from '../../src/seed/seed'
import { forgetExampleAdded, getTestPayload, resetCollections, resetSiteFacts } from '../setup/payload'
import { refuseUnlessThrowAwayTestDatabase } from '../setup/safety'
import { trackSteps } from '../setup/elements'
import WorkshopsPage, { generateMetadata as listMetadata } from '../../src/app/(site)/workshops/page'
import WorkshopPage, { generateMetadata as workshopMetadata } from '../../src/app/(site)/workshops/[slug]/page'
import TopicPage, { generateMetadata as topicMetadata } from '../../src/app/(site)/topics/[slug]/page'
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

type Query = Record<string, string | string[] | undefined>
const list = async (query: Query = {}) => {
  const props = { searchParams: Promise.resolve(query) }
  return { html: renderToString(await WorkshopsPage(props)), title: await tabTitle(listMetadata(props)) }
}
const workshop = async (slug: string, query: Query = {}) =>
  renderToString(await WorkshopPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(query) }))
const topic = async (slug: string) => renderToString(await TopicPage({ params: Promise.resolve({ slug }) }))

// The workshops a page links to, by slug: one link per card (the card's title).
const listed = (html: string) => [...new Set([...html.matchAll(/href="\/workshops\/([a-z0-9-]+)/g)].map(([, slug]) => slug))].sort()

// What Next.js's notFound() throws: an error whose "digest" says what to do.
async function digestOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return String((error as { digest?: string }).digest)
  }
  return 'no error thrown'
}

describe('example task 1: find a workshop by topic and level', () => {
  let p: Payload

  beforeAll(async () => {
    p = await getTestPayload()
    await resetAll(p)
    await seed(p, { env: {} })
  })
  afterAll(async () => resetAll(p))

  it('/workshops lists every workshop, with a plain GET form whose fields have visible labels', async () => {
    const { html, title } = await list()
    expect(listed(html)).toEqual(['adjust-your-brakes', 'repair-a-puncture', 'service-a-gear-system', 'true-a-wheel'])
    expect(html).toContain('Showing all workshops — 4 workshops')
    expect(title).toBe('Workshops · Campus Cycle')
    // A plain form: it works without JavaScript, and its choices end up in the address.
    // #results: after Apply filters the browser scrolls to the results, so a phone user sees them
    // straight away instead of the top of the page again.
    expect(html).toMatch(/<form[^>]*action="\/workshops#results"[^>]*method="get"/)
    expect(html).toMatch(/<section[^>]*id="results"/)
    expect(html).toMatch(/<label[^>]*for="filter-topic"[^>]*>Topic<\/label>/)
    expect(html).toMatch(/<label[^>]*for="filter-level"[^>]*>Level<\/label>/)
    expect(html).toMatch(/<select[^>]*id="filter-topic"[^>]*name="topic"/)
    expect(html).toMatch(/<select[^>]*id="filter-level"[^>]*name="level"/)
    expect(html).toContain('All topics')
    expect(html).toContain('All levels')
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Apply filters<\/button>/)
    // Nothing to clear yet.
    expect(html).not.toContain('Clear filters')
    // The count sits in a status region, so a change is read out.
    expect(html).toMatch(/role="status"[^>]*><h2[^>]*>Showing all workshops/)
    // The topic chips are one row that wraps, below their label, not one chip per row.
    expect(html).toMatch(/<div class="grid gap-2"><span[^>]*>Topics<\/span><ul class="flex flex-wrap/)
  })

  it('?topic=brakes-and-gears&level=beginner lists only Adjust your brakes, and says so in words and in the tab title', async () => {
    const { html, title } = await list({ topic: 'brakes-and-gears', level: 'beginner' })
    expect(listed(html)).toEqual(['adjust-your-brakes'])
    expect(html).toContain('Showing beginner workshops about Brakes and gears — 1 workshop')
    expect(title).toBe('Showing beginner workshops about Brakes and gears — 1 workshop · Campus Cycle')
    // The form shows the chosen filters, and offers to clear them.
    expect(html).toMatch(/<option[^>]*value="brakes-and-gears" selected="">Brakes and gears<\/option>/)
    expect(html).toMatch(/<option[^>]*value="beginner" selected="">Beginner<\/option>/)
    expect(html).toMatch(/href="\/workshops"[^>]*>Clear filters</)
    // The card's link carries the filters forward, for the workshop page's Back link.
    expect(html).toContain('href="/workshops/adjust-your-brakes?topic=brakes-and-gears&amp;level=beginner"')
  })

  it('an empty value is no filter: "All topics" sends ?topic=', async () => {
    const { html } = await list({ topic: '', level: 'beginner' })
    expect(listed(html)).toEqual(['adjust-your-brakes', 'repair-a-puncture'])
    expect(html).toContain('Showing beginner workshops — 2 workshops')
  })

  it('counts the analytics step "filter_used" only when filters were applied, with the level and a topic this site has', async () => {
    const steps = async (query: Query) => trackSteps(await WorkshopsPage({ searchParams: Promise.resolve(query) }))
    expect(await steps({})).toEqual([])
    expect(await steps({ topic: '' })).toEqual([])
    expect(await steps({ topic: 'brakes-and-gears', level: 'beginner' })).toEqual([
      { event: 'filter_used', props: { topic: 'brakes-and-gears', level: 'beginner' }, once: '?topic=brakes-and-gears&level=beginner' },
    ])
    expect(await steps({ level: 'intermediate' })).toEqual([{ event: 'filter_used', props: { topic: '', level: 'intermediate' }, once: '?level=intermediate' }])
    // Whatever someone typed into the address is never sent: an unknown topic goes as ''. (`once` stays
    // in the browser tab, to count each choice once; it is never sent.)
    expect(await steps({ topic: 'my-own-words' })).toEqual([{ event: 'filter_used', props: { topic: '', level: '' }, once: '?topic=my-own-words' }])
  })

  it('each filter works on its own too', async () => {
    expect(listed((await list({ topic: 'tyres-and-wheels' })).html)).toEqual(['repair-a-puncture', 'true-a-wheel'])
    expect(listed((await list({ level: 'intermediate' })).html)).toEqual(['service-a-gear-system', 'true-a-wheel'])
  })

  it('?topic=unknown&level=expert: "No workshops match these filters" and a Clear filters link, not a crash or a 404', async () => {
    const { html, title } = await list({ topic: 'unknown', level: 'expert' })
    expect(listed(html)).toEqual([])
    expect(html).toContain('No workshops match these filters')
    expect(html).toContain('This site has no topic called &quot;unknown&quot;. The link may be out of date.')
    expect(html).toMatch(/href="\/workshops"[^>]*>Clear filters</)
    expect(title).toBe('No workshops match these filters · Campus Cycle')
  })

  it('an odd address is left out, never a crash: a repeated topic, a script, parts that are not filters', async () => {
    expect(listed((await list({ topic: ['tyres-and-wheels', 'brakes-and-gears'] })).html)).toEqual(['repair-a-puncture', 'true-a-wheel'])
    const { html } = await list({ topic: '<script>alert(1)</script>', utm_source: 'mail' })
    expect(listed(html)).toHaveLength(4)
    expect(html).not.toContain('<script>alert(1)')
  })

  it('/workshops/true-a-wheel shows its facts from its own fields and the Site facts global, and links to its topic', async () => {
    const html = await workshop('true-a-wheel')
    expect(html).toContain('<h1')
    expect(html).toContain('True a wheel')
    expect(html).toContain('Thursday from 19:00')
    expect(html).toContain('EUR 25')
    expect(html).toContain('Intermediate')
    expect(html).toContain('At most 6 people')
    // Shared facts, from the global (one source per fact).
    expect(html).toContain('Workshop B, Student Centre')
    expect(html).toContain('Bring your own parts and pay EUR 5 less per bicycle.')
    // Its description, in words.
    expect(html).toContain('truing stand')
    // Its topic, linked to the topic's page.
    expect(html).toMatch(/href="\/topics\/tyres-and-wheels"[^>]*>Tyres and wheels</)
    // Its parent, without a made-up path through a topic.
    expect(html).toMatch(/<nav aria-label="Breadcrumb"[^>]*>.*href="\/workshops"[^>]*>Workshops<.*aria-current="page"[^>]*>True a wheel</)
    expect(await tabTitle(workshopMetadata({ params: Promise.resolve({ slug: 'true-a-wheel' }), searchParams: Promise.resolve({}) }))).toBe('True a wheel · Campus Cycle')
  })

  it('the gear workshop says when it ends at the latest, from its latestEnd field', async () => {
    const html = await workshop('service-a-gear-system')
    // Non-breaking spaces keep "ends by 15:00" on one line.
    expect(html).toContain('Saturday from 13:00, ends\u00a0by\u00a015:00')
    await p.update({ collection: 'workshops', where: { slug: { equals: 'service-a-gear-system' } }, data: { latestEnd: '14:30' }, overrideAccess: true })
    try {
      const changed = await workshop('service-a-gear-system')
      expect(changed).toContain('ends\u00a0by\u00a014:30')
      expect(changed).not.toContain('15:00')
    } finally {
      await p.update({ collection: 'workshops', where: { slug: { equals: 'service-a-gear-system' } }, data: { latestEnd: '15:00' }, overrideAccess: true })
    }
  })

  it('the Back link keeps the filters the user came with', async () => {
    const filtered = await workshop('adjust-your-brakes', { topic: 'brakes-and-gears', level: 'beginner' })
    expect(filtered).toMatch(/href="\/workshops\?topic=brakes-and-gears&amp;level=beginner"[^>]*>Back to the filtered workshops</)
    expect(filtered).toMatch(/aria-label="Breadcrumb"[^>]*>.*href="\/workshops\?topic=brakes-and-gears&amp;level=beginner"[^>]*>Workshops</)
    const plain = await workshop('adjust-your-brakes')
    expect(plain).toMatch(/href="\/workshops"[^>]*>Back to all workshops</)
    // A filter the site does not know is not carried back.
    expect(await workshop('adjust-your-brakes', { level: 'expert' })).toMatch(/href="\/workshops"[^>]*>Back to all workshops</)
  })

  it('an unknown workshop or topic address gives the 404 page', async () => {
    expect(await digestOf(workshop('no-such-workshop'))).toBe('NEXT_HTTP_ERROR_FALLBACK;404')
    expect(await digestOf(topic('no-such-topic'))).toBe('NEXT_HTTP_ERROR_FALLBACK;404')
  })

  it('/topics/tyres-and-wheels lists Repair a puncture and True a wheel: the reverse side of the many-to-many', async () => {
    const html = await topic('tyres-and-wheels')
    expect(listed(html)).toEqual(['repair-a-puncture', 'true-a-wheel'])
    expect(html).toContain('Tyres and wheels')
    expect(html).toContain('Fix a flat tyre')
    // The cards are as complete as on /workshops: a picture with a description, and every topic of
    // the workshop (Repair a puncture is also about Everyday maintenance).
    for (const alt of [...html.matchAll(/<img[^>]*alt="([^"]*)"/g)].map(([, text]) => text)) expect(alt.length).toBeGreaterThan(10)
    expect([...html.matchAll(/<img/g)]).toHaveLength(2)
    // In the join's order (oldest first), not in whatever order the second query returns.
    expect([...html.matchAll(/<h3[^>]*><a[^>]*href="\/workshops\/([a-z0-9-]+)/g)].map(([, slug]) => slug)).toEqual(['repair-a-puncture', 'true-a-wheel'])
    const puncture = html.slice(html.indexOf('href="/workshops/repair-a-puncture'), html.indexOf('href="/workshops/true-a-wheel'))
    expect(puncture).toContain('href="/topics/everyday-maintenance"')
    expect(html).toContain('href="/workshops?topic=tyres-and-wheels"')
    expect(await tabTitle(topicMetadata({ params: Promise.resolve({ slug: 'tyres-and-wheels' }) }))).toBe('Tyres and wheels · Workshops · Campus Cycle')
    expect(listed(await topic('everyday-maintenance'))).toEqual(['adjust-your-brakes', 'repair-a-puncture'])
  })

  it('one edit in /admin shows in the list, on the workshop page and on the topic page', async () => {
    await p.update({ collection: 'workshops', where: { slug: { equals: 'true-a-wheel' } }, data: { price: 27 }, overrideAccess: true })
    try {
      expect((await list()).html).toContain('EUR 27')
      expect(await workshop('true-a-wheel')).toContain('EUR 27')
      expect(await topic('tyres-and-wheels')).toContain('EUR 27')
    } finally {
      await p.update({ collection: 'workshops', where: { slug: { equals: 'true-a-wheel' } }, data: { price: 25 }, overrideAccess: true })
    }
  })

  it('the place and the pricing rule on a workshop page follow the Site facts global', async () => {
    const before = await p.findGlobal({ slug: 'site-facts' })
    try {
      await p.updateGlobal({
        slug: 'site-facts',
        data: { place: 'Room 12 (changed by an editor)', pricingRule: 'Parts cost extra (changed by an editor).' },
        overrideAccess: true,
      })
      const html = await workshop('repair-a-puncture')
      expect(html).toContain('Room 12 (changed by an editor)')
      expect(html).toContain('Parts cost extra (changed by an editor).')
      expect(html).not.toContain('Workshop B, Student Centre')
      expect(html).not.toContain('Bring your own parts')
    } finally {
      await p.updateGlobal({ slug: 'site-facts', data: { place: before.place, pricingRule: before.pricingRule }, overrideAccess: true })
    }
  })
})
