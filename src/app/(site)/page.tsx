// The home page. It shows the two things a user comes to do, kept apart so neither hides the other:
// find a workshop, or book the repair clinic. Everything on it comes from the records editors keep
// in /admin (the home page's title and intro, the workshops, the topics, the clinic, and the pricing
// rule in the Site facts global), never from a copy typed here, so a price changed in /admin is right
// on every page at once.
import { getPayload } from 'payload'
import { ButtonLink } from '@/components/site/ButtonLink'
import { FramedCard } from '@/components/site/FramedCard'
import { Hero } from '@/components/site/Hero'
import { Notice } from '@/components/site/Notice'
import { Badge } from '@/components/ui/badge'
import { SITE_NAME } from '@/content/campus-cycle'
import { formatPrice, formatWhen, imageFrom, levelLabel } from '@/lib/format'
import config from '@/payload.config'

// Read the database on every visit, never once while the site is built: editors' changes then show
// at once, and the build needs no database.
export const dynamic = 'force-dynamic'

// The home page's picture, from the media library. To use another one, upload it in /admin and put
// its file name here.
const HOME_IMAGE = 'workshop-tools'

export default async function HomePage() {
  const payload = await getPayload({ config })
  // One after the other, not all at once: simple to read, and quick enough for a page this small.
  const home = (await payload.find({ collection: 'pages', where: { slug: { equals: 'home' } }, limit: 1 })).docs[0]
  const picture = (await payload.find({ collection: 'media', where: { filename: { contains: HOME_IMAGE } }, limit: 1 })).docs[0]
  const workshops = (await payload.find({ collection: 'workshops', sort: 'createdAt', depth: 1, limit: 50 })).docs
  const topics = (await payload.find({ collection: 'topics', sort: 'name', depth: 0, limit: 50 })).docs
  // The newest clinic: the one a user can book now.
  const clinic = (await payload.find({ collection: 'clinics', sort: '-createdAt', depth: 0, limit: 1 })).docs[0]
  // The facts several pages share, such as the pricing rule (src/globals/SiteFacts.ts).
  const facts = await payload.findGlobal({ slug: 'site-facts', depth: 0 })

  return (
    <div className="grid gap-section pt-6 sm:pt-10">
      <Hero
        title={home?.title ?? SITE_NAME}
        text={home?.intro}
        image={imageFrom(picture)}
        actions={
          <>
            <ButtonLink href="/workshops" size="lg">Find a workshop</ButtonLink>
            <ButtonLink href={clinic ? `/clinics/${clinic.slug}` : '/clinics'} variant="secondary" size="lg">
              Repair clinic
            </ButtonLink>
          </>
        }
      />

      <section aria-labelledby="choose" className="grid gap-block">
        <h2 id="choose" className="text-2xl">What would you like to do?</h2>
        <div className="grid gap-block md:grid-cols-2">
          <div className="framed grid content-start gap-4 p-6 offset-purple sm:p-8">
            <Badge tone="purple">Learn it yourself</Badge>
            <h3 className="text-xl">Find a workshop</h3>
            <p>Short maintenance workshops in small groups. Choose a topic:</p>
            <ul className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <li key={topic.id}>
                  {/* min-h-11: 44 px high, a target a finger can hit easily. */}
                  <ButtonLink href={`/workshops?topic=${topic.slug}`} variant="secondary" size="sm" className="min-h-11">
                    {topic.name}
                  </ButtonLink>
                </li>
              ))}
            </ul>
            <ButtonLink href="/workshops" className="w-fit">See all workshops</ButtonLink>
          </div>
          <div className="framed grid content-start gap-4 p-6 offset-coral sm:p-8">
            <Badge tone="coral">Let us fix it</Badge>
            <h3 className="text-xl">Repair clinic</h3>
            {clinic ? (
              <>
                <p className="font-semibold">{clinic.name} · {formatWhen(clinic)}</p>
                <p>{clinic.summary}</p>
                <ButtonLink href={`/clinics/${clinic.slug}`} className="w-fit">Book a time slot</ButtonLink>
              </>
            ) : (
              <>
                <p className="font-semibold">The repair clinic opens soon</p>
                <p>When it opens, you can book a time slot here and bring your bicycle for a check or a repair.</p>
              </>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="workshops" className="grid gap-block">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="workshops" className="text-2xl">The workshops</h2>
          <ButtonLink href="/workshops" variant="link">All workshops and topics</ButtonLink>
        </div>
        {/* One colour for every workshop card: purple means workshops, coral means the clinic. */}
        <ul className="grid gap-block lg:grid-cols-2">
          {workshops.map((workshop) => (
            <li key={workshop.id} className="grid">
              <FramedCard
                title={workshop.title}
                href={`/workshops/${workshop.slug}`}
                image={imageFrom(workshop.image)}
                accent="purple"
              >
                <Badge tone={workshop.level === 'beginner' ? 'mint' : 'yellow'}>{levelLabel(workshop.level)}</Badge>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  <dt className="text-ink-soft">When</dt>
                  <dd className="font-semibold">{formatWhen(workshop)}</dd>
                  <dt className="text-ink-soft">Price</dt>
                  <dd className="font-semibold">{formatPrice(workshop.price)}</dd>
                </dl>
              </FramedCard>
            </li>
          ))}
        </ul>
        {facts.pricingRule && (
          <Notice>
            <p>{facts.pricingRule}</p>
          </Notice>
        )}
      </section>
    </div>
  )
}
