// The facts of the example site. When you turn the starter into your own project, this file and the
// seed are where the example content lives.
//
// Campus Cycle is a made-up bicycle repair service at a college. Every fact here comes from the
// course's Campus Cycle fact sheet, so the site, the lessons and the exercises all tell the same story.
//
// The seed (src/seed/seed.ts) copies these facts into the database ONCE per database: after its first
// complete run it notes in the database that the example was added, and every later run, on each
// deploy too, adds nothing. From then on the records live in the database, editors change them in
// /admin, and this file is no longer read for them. Nothing you delete or change in /admin comes back
// after a deploy.
//
// To replace the example with your own content:
// - before your first deploy: change the facts here and the page texts in src/seed/seed.ts;
// - after it: edit the records in /admin (changing this file then changes nothing on the site);
// - each workshop needs a line in SUMMARIES, its text in DESCRIPTIONS and a photo <slug>.jpg listed
//   in IMAGES (all in src/seed/seed.ts);
// - to start from an empty site instead, set ADD_EXAMPLE_CONTENT to false in src/seed/seed.ts before
//   your first deploy; after it, delete the example records in /admin (they do not come back).
//
// `as const` makes every value here fixed: TypeScript then knows, for example, that the puncture
// workshop's day is exactly 'Tuesday', not just "some text", and warns about a typo anywhere it is used.

// The site's name: in the header, the footer and every browser tab ("<Page> · Campus Cycle", from
// SITE_TITLE below). Change it here, once.
export const SITE_NAME = 'Campus Cycle'

// The browser tab's title. The home page shows the name alone; every other page gives only its own part
// (such as "Workshops") and Next.js adds " · " and the name after it, so a tab or a bookmark says both
// what the page is and which site it belongs to. Used by src/app/(site)/layout.tsx.
export const SITE_TITLE = { default: SITE_NAME, template: `%s · ${SITE_NAME}` }

export const CAMPUS_CYCLE = {
  // The place, the e-mail address and the pricing rule (below) go into the Site facts global
  // (src/globals/SiteFacts.ts): every page that shows them reads them from there.
  place: 'Workshop B, Student Centre',
  email: 'hello@campuscycle.example',
  // Only the puncture workshop has a stated end time. The others have none on purpose: never make one
  // up. The gear workshop must end by 15:00 (its latestEnd), because the Saturday repair clinic uses
  // the same room from 15:00. That is a limit, not an end time.
  workshops: [
    {
      title: 'Repair a puncture',
      slug: 'repair-a-puncture',
      level: 'beginner',
      day: 'Tuesday',
      startTime: '18:30',
      endTime: '20:00',
      price: 15,
      topics: ['tyres-and-wheels', 'everyday-maintenance'],
    },
    {
      title: 'Adjust your brakes',
      slug: 'adjust-your-brakes',
      level: 'beginner',
      day: 'Saturday',
      startTime: '10:00',
      price: 15,
      topics: ['brakes-and-gears', 'everyday-maintenance'],
    },
    {
      title: 'Service a gear system',
      slug: 'service-a-gear-system',
      level: 'intermediate',
      day: 'Saturday',
      startTime: '13:00',
      latestEnd: '15:00',
      price: 25,
      topics: ['brakes-and-gears'],
    },
    {
      title: 'True a wheel',
      slug: 'true-a-wheel',
      level: 'intermediate',
      day: 'Thursday',
      startTime: '19:00',
      price: 25,
      topics: ['tyres-and-wheels'],
    },
  ],
  // Three topics that overlap: the puncture and brakes workshops each have two topics, so the site can
  // show a many-to-many link from both sides.
  topics: [
    {
      name: 'Tyres and wheels',
      slug: 'tyres-and-wheels',
      description: 'Fix a flat tyre and get a buckled wheel running straight again.',
    },
    {
      name: 'Brakes and gears',
      slug: 'brakes-and-gears',
      description: 'Adjusting brakes and servicing gear systems.',
    },
    {
      name: 'Everyday maintenance',
      slug: 'everyday-maintenance',
      description: 'Everyday jobs on your own bicycle: mending a puncture and adjusting your brakes.',
    },
  ],
  // The Saturday repair clinic's price list. The fact sheet gives only each repair's name and price,
  // so the seed leaves each repair's description empty: typing the price into it would keep a second
  // copy that goes stale when an editor changes the price. An editor can add a description in /admin.
  repairs: [
    {
      name: 'Check',
      price: 10,
    },
    {
      name: 'Each small repair',
      price: 5,
    },
    {
      name: 'Full service',
      price: 45,
    },
  ],
  groupSize: 6,
  pricingRule: 'Tools, a tutor and standard parts are included. Bring your own parts and pay EUR 5 less per bicycle.',
  // The clinic is NOT in the seed: you add it yourself in /admin (a later exercise in the course asks
  // you to add it), with its time slots. These are the agreed facts for it: Saturday 15:00 to 17:00,
  // four 30-minute slots, two bicycles per slot.
  // Nothing reads these; they are here so you type the same values in /admin.
  clinicDefaults: {
    day: 'Saturday',
    startTime: '15:00',
    endTime: '17:00',
    slotMinutes: 30,
    placesPerSlot: 2,
    slotTimes: ['15:00', '15:30', '16:00', '16:30'],
  },
} as const

// Shown on the booking form, in the booking confirmation and on the privacy page. One copy here, so
// the three places can never say it differently. (The browser checks keep their own copy on purpose,
// in tests/e2e/helpers.ts, so a change here shows up there.)
export const MADE_UP_DATA_NOTICE = 'This is a practice project: use made-up details; no one will contact you.'

// What the booking confirmation page shows after a booking was saved.
export const BOOKING_CONFIRMATION = `Your booking is saved. ${MADE_UP_DATA_NOTICE}`

// The kinds of value above, for code that wants to name them, for example `(w: CampusCycleWorkshop)`.
export type CampusCycleWorkshop = (typeof CAMPUS_CYCLE.workshops)[number]
