# Campus Cycle: the course starter

Campus Cycle is a small, complete website for a made-up bicycle repair service at a college. It is
the starter of the course "Building better websites": you make your own copy, put it online, and
learn by changing it. Later you can turn your copy into a site about your own topic.

**What you get:**

- **A live website with a CMS.** The editing screen is at `/admin`, part of the site itself. Editors
  change the pages, workshops, prices and images there, without touching code.
- **Two example user tasks**, each small and commented, made to be adapted:
  - *find a workshop* by topic and level (`/workshops`);
  - *book a time slot* at the Saturday repair clinic (`/clinics/<slug>`).
- **Safety for your live database.** Its tables change only through migrations (migrations: the files
  that build and change the database's tables), and the build checks that every one has run. The
  starter's commands refuse to touch the live data from your own computer, and a preview that points
  at it stops.
- **CI checks** on GitHub for every change: lint, types, tests, migrations, the AI note and the site
  in a real browser.

It is built with Next.js 16 and Payload CMS 3 on a Postgres database (Neon), with images in Vercel
Blob, Tailwind CSS 4, and TypeScript.

**What it costs:** nothing. You use free accounts: GitHub, Vercel's Hobby plan, Neon's free plan, and
Blob through Vercel. Each provider lists its free limits on its pricing page.

---

## Get your own copy

Five steps, all in your browser. [The first-hour guide](docs/guides/first-hour.md) shows every click,
with what you should see after each one.

1. **Use this template** on GitHub: a repository of your own, named `campuscycle-<your name>`.
2. **Import it into Vercel** as a project with the same name, with three settings: `PAYLOAD_SECRET`,
   `FIRST_ADMIN_EMAIL` and `FIRST_ADMIN_PASSWORD`. The first build stops with "NOT CONFIGURED YET":
   that is expected.
3. **Connect Neon and Blob from inside Vercel** (Storage → Create Storage): Neon in Frankfurt,
   connected to Production only; Blob Public, with its read-write token.
4. **Redeploy** (Deployments → **…** → **Redeploy**, never "Promote to Production"). The build log
   shows `MIGRATIONS: verified committed migrations` and `SEED: verified`.
5. **Log in to `/admin`** with your `FIRST_ADMIN_EMAIL` and `FIRST_ADMIN_PASSWORD`.

## Run it on your own computer

In short (the [local set-up guide](docs/guides/local-setup.md) explains each step):

1. Install Node 22 (the LTS this starter is tested on).
2. Clone your repository, then run `npm ci`.
3. Make a free Neon database **of your own**, in your own Neon account. Never use your live site's.
4. Copy `.env.example` to `.env.local` and fill it in, with your own database's address as
   `DATABASE_URL`.
5. Run `npm run migrate`, then `npm run seed`, then `npm run dev`, and open <http://localhost:3000>.

## Where things are

| Folder or file | What is in it |
| --- | --- |
| `src/collections` | The content model: one file per collection (workshops, topics, clinics, time slots, bookings, …) |
| `src/globals/SiteFacts.ts` | **Site facts**: the pricing rule, the place and the e-mail address, kept once for every page |
| `src/app/(site)` | The public pages, one folder per address |
| `src/components/site` | The parts the pages are made of: header, hero, cards, filters, booking form, … |
| `src/tasks/find-workshop`, `src/tasks/book-slot` | The two example user tasks, each with a README on how it works and how to adapt it |
| `src/content/campus-cycle.ts` | The example's facts: workshops, topics, prices, the clinic's hours |
| `src/seed` | The example content and its photos, added once to a new database |
| `src/app/(site)/globals.css` | The design tokens: every colour, font, size and space, in one place |
| `src/migrations` | The migrations: every change to the database's tables, in order |
| `scripts` | The build, the migration and seed runners, the guard that protects your live database, and the CI checks |
| `docs/guides` | The guides: [first hour](docs/guides/first-hour.md), [local set-up](docs/guides/local-setup.md), [troubleshooting](docs/guides/troubleshooting.md), [UX decisions](docs/guides/ux-decisions.md) |
| `docs/brief.md`, `docs/requirements.md`, `docs/decisions`, `docs/test-report.md`, `docs/handover.md` | Your project documents, to fill in, with at least two decision records in `docs/decisions` |

If you work in a team, you also fill in `docs/team-agreement.md`, `docs/content-structure.md` and `docs/design-rationale.md`.

The route `/api/course-check` answers the course's checks about your warm-ups; what it answers is
fixed in [the course-check contract](docs/COURSE-CHECK-CONTRACT.md). Do not change either.

**The marked places.** The course's warm-ups ask you to change three places, each marked in the code:

- W4: in `src/components/site/Hero.tsx`, the tagline under the line
  `// W4: put your own name in this tagline`.
- W5: in `src/app/(site)/clinics/[slug]/page.tsx`, a list goes on the line after
  `{/* W5: show the clinic's "What to bring" list here, the same way this page shows its prices below. */}`.
- W6: after you add the `repairs` relationship to bookings (with its migration):
  1. In `src/components/site/BookingForm.tsx`, remove the `//` in front of every line of the function
     `RepairChoice` (marked W6). Then replace the whole line
     `{/* W6: <RepairChoice repairs={props.repairs} /> */}` with `<RepairChoice repairs={props.repairs} />`.
  2. In `src/tasks/book-slot/createBooking.ts`, switch on the two lines the W6 comment in
     createBooking.ts names: remove the `//` in front of `const repairs = formData.getAll('repairs')…`
     and in front of `repairs,` in `payload.create`.

  The steps, and how to check the result, are in [the book-slot README](src/tasks/book-slot/README.md#w6-let-the-user-choose-repairs).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the site on your computer at <http://localhost:3000>, after checking that your database is not the live one |
| `npm run build` | The build Vercel runs. On Vercel it first migrates (and, for your live site, records which database is the live one and seeds), then builds the site |
| `npm start` | Runs a site that `npm run build` built |
| `npm run migrate` | Applies the committed migrations to your own database, and checks that every one is there |
| `npm run migrate:create -- <name>` | Creates a migration for your change to the content model |
| `npm run seed` | Creates your admin account and adds the example content (once). `npm run seed -- --again` adds back deleted example records |
| `npm run generate` | Regenerates `src/payload-types.ts` and the admin's import map after a model change |
| `npm run lint` | Looks for mistakes in the code |
| `npm run typecheck` | Checks the TypeScript types |
| `npm test` | Runs the tests (they use their own database in memory, never yours) |
| `npm run check` | The browser checks, against a site that is already running (CI runs them for you) |

**Why there is no `npm run payload`.** Payload's own tutorials use a `payload` script. This starter
leaves it out on purpose. `dev`, `migrate`, `migrate:create` and `seed` go through a guard
(`scripts/guard.mjs`) that refuses your live database; the raw `payload` command has no such guard.
And `payload migrate` once reported success without migrating anything, so `npm run migrate` checks
that every migration really is in the database. If you need another Payload command, run it only
against your own database: `npx cross-env NODE_OPTIONS=--no-deprecation payload <command>`.

**What `cross-env NODE_OPTIONS=--no-deprecation` is for.** Payload's tools make Node print
deprecation warnings that are not about your code. `NODE_OPTIONS=--no-deprecation` hides them.
`cross-env` sets that option the same way on Windows, macOS and Linux.

## Two optional extras

- **The members' area** is off until you set `MEMBERS_AREA=on`. It adds a log-in for members and a
  "My bookings" page. See [the local set-up guide](docs/guides/local-setup.md#optional-the-members-area).
- **Analytics** are off until `NEXT_PUBLIC_ANALYTICS` names a tool. Only `vercel` (Vercel Web
  Analytics) is built in. On the free Hobby plan it records page views only; the site's two events
  (`filter_used` and `booking_saved`) need a paid plan. To use another tool, add it inside `track()`
  in `src/lib/analytics.ts`; the comment at the top of that file shows how. Never send personal data.

## Where to go next in the course

- "Our starter, explained": a tour of this code.
- "Content and the CMS": working with `/admin`, collections and records.
- The module on the content model and ER modelling: the many-to-many between workshops and topics,
  which W6 builds for bookings and repairs.
- "The project documents": filling in your brief, requirements, decisions, test report and hand-over.
- "Finishing and handing over": handing your site to its next owner.

And the guides: [first hour](docs/guides/first-hour.md),
[local set-up](docs/guides/local-setup.md), [troubleshooting](docs/guides/troubleshooting.md) and
[UX decisions](docs/guides/ux-decisions.md).

## Rules that keep you safe

- **Test data only.** Never put real personal data in this site: no real names, e-mail addresses or
  photos of people. The site tells its users the same.
- **Never "Promote to Production"** on Vercel. Use **Redeploy**, and check that the build log shows
  `MIGRATIONS: verified committed migrations`.
- **Never paste your live database's address into `.env.local`.** `npm run dev`, `npm run migrate`,
  `npm run migrate:create`, `npm run seed` and the browser checks refuse it; `npm run build` and
  `npm start` do not.
- **Secrets only in Vercel and in `.env.local`.** Never in a file you commit.

## Licence and credits

- The code: MIT licence, in [LICENSE](LICENSE). You may use, change and share this code; keep the
  LICENSE file in your copy.
- The photos: from Wikimedia Commons, each under its own licence. See
  [src/seed/images/SOURCES.md](src/seed/images/SOURCES.md).
- The font: Hanken Grotesk, under the SIL Open Font Licence.
