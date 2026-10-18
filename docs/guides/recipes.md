# Recipes: copy-paste changes for your own site

Each recipe is one change a team project needs, written out in full: the file, the exact lines, the
commands, and what you should see. Copy them and rename the words to your own topic. The examples are
for a made-up team site, **Riverside Voices**, that rents practice rooms to choirs: its rooms are the
starter's clinic under a new name, and it adds equipment (a piano, music stands) to each room.

Every recipe was run once, in this order, on a fresh copy of the starter, with the laptop database
from [the local set-up guide](local-setup.md): after each one the site worked, and at the end
`npm test`, `npm run typecheck`, `npm run lint`, the leftovers check, the build and the browser checks
were all green.

**For every recipe:**

- Start from an up-to-date `main`, on a new branch: `git switch main`, `git pull`, then
  `git switch -c <a short name>`. One recipe, one branch, one pull request.
- Keep `npm run dev` running in one terminal while you work (unless the recipe says to stop it), and
  run the commands in a second terminal.
- Finish with a pull request: push the branch, open the pull request, fill in the template (the AI
  note too), wait until CI is green, then merge.

| Recipe | What it does |
| --- | --- |
| [Before you start: remove the example](#before-you-start-remove-the-example) | Takes the workshops, topics and repairs out, once, first |
| [R0](#r0-the-team-code-in-the-footer) | The team code in the footer |
| [R1](#r1-rename-the-site) | Rename the site |
| [R2](#r2-add-a-field-and-its-migration) | Add a field, and its migration |
| [R3](#r3-a-plain-page-and-its-menu-link) | A plain page, and its menu link |
| [R4](#r4-a-new-collection) | A new collection |
| [R5](#r5-keep-an-example-collection-under-your-name) | Keep an example collection under your own name |
| [R6](#r6-a-many-to-many-shown-from-both-sides) | A many-to-many, shown from both sides |
| [R7](#r7-a-list-page-with-a-filter-in-the-address) | A list page with a filter in the address |
| [R8](#r8-make-your-migration-again-when-main-moved) | Make your migration again when `main` moved |
| [R9](#r9-one-more-booking-form-field) | One more field in the booking form |
| [R10](#r10-the-booking-becomes-yours-with-the-least-code) | The booking becomes yours, with the least code |
| [R11](#r11-openstreetmap-on-the-contact-page) | OpenStreetMap on the contact page |

---

## Before you start: remove the example

The starter's workshops, topics and repairs are the example of a site you do not build. One command
takes them out, with their pages, components, tests, photos and their part of the seed, and makes the
migration that removes their tables. It keeps the clinic, its time slots and bookings, and the booking
task: in R5 and R10 they become your own booking. Do it **first**, before the other recipes: it only
works on files that are still as the starter has them.

1. On a new branch, with nothing uncommitted, and `.env.local` filled in:

   ```bash
   git switch -c remove-example
   npm run remove-example
   ```

   **You should see:** the 19 files it deletes and the 24 it changes, then
   `This was a dry run: nothing was changed.`

2. Do it:

   ```bash
   npm run remove-example -- --yes
   ```

   **You should see:** `Done: 19 files deleted, 24 changed.`, then
   `Made safe: src/migrations/<date>_remove_example.ts (rows first, IF EXISTS on every DROP; ...)`,
   then the types generated, and a list of the next commands.

3. The next commands, as it prints them:

   ```bash
   npm run migrate
   npm run dev
   ```

   **You should see:** `Migrated: <date>_remove_example`, then a site with Home, Repair clinic,
   About and Contact in the menu, and no workshops. Stop `npm run dev` with **Ctrl+C**, run `npm test`,
   then commit and push:

   ```bash
   git add -A
   git commit -m "Remove the example workshops, topics and repairs"
   git push -u origin remove-example
   ```

4. In the pull request, under `## Why this removes or renames`, paste the text the command printed
   (it starts with `npm run remove-example: the migration drops the example tables`). CI's removals
   check asks for it.

After the merge, Vercel runs the same migration on your live site: the example's workshops, topics and
prices disappear there too. **The page texts stay as they were**: the home, about and contact pages
already in your database still talk about workshops. Change them in `/admin` → **Pages**, live and on
your laptop.

If it says `Nothing removed:`, read the rest of the line: you have uncommitted changes, `.env.local`
has no `DATABASE_URL` line, or a file it changes is no longer the starter's (it names the file).
Nothing was changed. Undo your change to that file (`git restore <file>`), or start from a fresh copy.

---

## R0. The team code in the footer

In `src/components/site/Footer.tsx`, replace the last line of text (inside the last `<p>`):

```tsx
          Campus Cycle is a fictional example site for the course Building better websites.
```

with this line, with your own team code:

```tsx
          {SITE_NAME} is a fictional example site for the course Building better websites. Team code: T29-7G6N.
```

`{SITE_NAME}` is the site's name from `src/content/campus-cycle.ts`, so R1 renames it here too.

**You should see:** at the bottom of every page, `... Team code: T29-7G6N.`

---

## R1. Rename the site

1. **The name, everywhere at once.** In VS Code: **Edit** → **Replace in Files** (Ctrl+Shift+H). Search
   `Campus Cycle`, replace with your site's name (`Riverside Voices`), **files to include:** `src`,
   with **Match Case** on. Then **Replace All**.
2. **What is left.** In the terminal:

   ```bash
   node scripts/ci/leftovers.mjs
   ```

   It lists each line that still has the example's place or e-mail address, as `file:line`. In a fresh
   copy that is three lines; change them to your own:

   ```ts
   // src/content/campus-cycle.ts
     place: 'The rehearsal house, Riverside 12',
     email: 'hello@riversidevoices.example',
   ```

   and, in the comment in `src/seed/richText.ts`, the example's place (`'Workshop B, Student Centre.'`).
   Run the command again. **You should see:**
   `Leftovers: none. Your site no longer uses the Campus Cycle example.`
3. **The words about bicycles.** These describe the example; give them your own words:
   - `src/components/site/Hero.tsx`: the tagline on the line under the W4 comment, for example
     `const TAGLINE = 'Practice rooms for choirs · a site by team 29'` (type no apostrophe in it);
   - `src/app/(site)/layout.tsx`: the `description`;
   - `src/components/site/Footer.tsx`: the short line under the name
     (`Bicycle repair and maintenance workshops at the college.`);
   - `src/seed/seed.ts`: in `PAGES`, the home page's `intro` and the about page's first `paragraph`.
4. **What is already in the database.** The seed adds the page texts and the Site facts only once, so
   your live site still shows the old ones. Change them in `/admin`: **Pages** (Home, About, Contact,
   Privacy) and **Site facts** (the place and the e-mail address). On your laptop you can start afresh
   instead: stop `npm run dev`, delete the folder `.data/db`, then `npm run migrate` and
   `npm run seed`.

**You should see:** your name in the header, the footer and the browser tab, and your tagline on the
home page. The tests read the name from `src/content`, so `npm test` stays green. With the leftovers
check at none, a team can switch on CI's leftovers job (the variable `CAMPUS_CYCLE_LEFTOVERS` with the
value `fail`, see the comment at the end of `.github/workflows/ci.yml`).

---

## R2. Add a field, and its migration

A room gets the number of people it fits. In `src/collections/Clinics.ts`, under the line
`// Add new clinic fields here, ...`, paste:

```ts
    {
      name: 'capacity',
      type: 'number',
      min: 1,
      admin: { description: 'How many people fit in the room.' },
    },
```

Then make the migration, run it, and update the types:

```bash
npm run migrate:create -- room_capacity
npm run migrate
npm run generate
```

**You should see:** `Migration created at .../src/migrations/<date>_room_capacity.ts`, then
`MIGRATIONS: verified committed migrations`. In `/admin`, a room now has the field **Capacity**.

To show it on the room's page, in `src/app/(site)/rooms/[slug]/page.tsx` (still `clinics/[slug]` before
R5), in the "At a glance" list, right after the line `<dd className="font-semibold">{formatWhen(clinic)}</dd>`:

```tsx
            {clinic.capacity && (
              <>
                <dt className="text-ink-soft">Fits</dt>
                <dd className="font-semibold">{clinic.capacity} people</dd>
              </>
            )}
```

**You should see:** "Fits 12 people" on a room's page, once you gave it a capacity in `/admin`.

Commit the collection, the page, the two new migration files, `src/migrations/index.ts` and
`src/payload-types.ts`:

```bash
git add -A
git commit -m "Rooms: how many people fit"
git push -u origin room-capacity
```

**The one rule:** leave `required` off a field you add to a collection that already has records on
the live site. The migration would make the column `NOT NULL`, and it stops on the records that have
no value yet. Check the value in the form instead (R9). A brand-new collection (R4) may use
`required`: it has no records yet.

---

## R3. A plain page, and its menu link

1. In `/admin` → **Pages** → **Create new**: a **Title** (`Opening hours`), a **Slug**
   (`opening-hours`), an **Intro** and a **Body**. **Save.** It is at `/opening-hours` at once, on the
   site where you made it (make it again in the live `/admin` for the live site).
2. The menu link, in a pull request: in `src/components/site/MainNav.tsx`, add one line to `LINKS`:

   ```tsx
   const LINKS = [
     { href: '/', label: 'Home' },
     { href: '/clinics', label: 'Repair clinic' },
     { href: '/opening-hours', label: 'Opening hours' },
     { href: '/about', label: 'About' },
     { href: '/contact', label: 'Contact' },
   ]
   ```

3. The footer has its own `LINKS` list, in `src/components/site/Footer.tsx`; it works the same way:

   ```tsx
     { href: '/opening-hours', label: 'Opening hours' },
   ```

**You should see:** "Opening hours" in the menu and the footer; on that page, its menu link is marked
as the page you are on. Keep the menu short: a few links fit on a phone.

---

## R4. A new collection

Equipment a room can have. Make the file `src/collections/Equipment.ts`:

```ts
import type { CollectionConfig } from 'payload'
import { publicContent } from '../access'
import { checkUniqueSlug } from '../lib/modelIntegrity'
import { slug } from './fields'

// A piece of equipment a room can have, such as a piano or music stands.
export const Equipment: CollectionConfig = {
  slug: 'equipment',
  labels: { singular: 'Equipment', plural: 'Equipment' },
  admin: { useAsTitle: 'name' },
  access: publicContent,
  hooks: { beforeChange: [checkUniqueSlug] },
  fields: [
    { name: 'name', type: 'text', required: true },
    slug,
    { name: 'description', type: 'textarea' },
  ],
}
```

`publicContent`: anyone may read it, only editors change it. `slug` and `checkUniqueSlug`: an address
part such as `upright-piano`, checked to be unique. Register it in `src/payload.config.ts`, with the
other imports and in the `collections` list (before `Throttle`):

```ts
import { Equipment } from './collections/Equipment'
```

```ts
  collections: [Users, Media, Pages, Clinics, TimeSlots, Bookings, Equipment, Throttle, Members],
```

Then the same commands as R2:

```bash
npm run migrate:create -- equipment
npm run migrate
npm run generate
```

**You should see:** **Equipment** in `/admin`'s menu; add two records (Upright piano, Music stands).
The course check's team section lists `equipment` among your own collections.

---

## R5. Keep an example collection under your name

The clinic, its time slots and bookings are a complete booking task. Keep them, under your own words:
that is far less work than a new one (R10 finishes it).

1. **The name in `/admin`.** In `src/collections/Clinics.ts`, right under `slug: 'clinics',`:

   ```ts
     labels: { singular: 'Room', plural: 'Rooms' },
   ```

   The slug stays `clinics`: labels need no migration.
2. **The address.** Stop `npm run dev` first (**Ctrl+C**): while it runs, Windows does not let you
   rename the folder. In VS Code's Explorer, rename the folder `src/app/(site)/clinics` to `rooms`.
3. **The links to it.** **Edit** → **Replace in Files**: search `/clinics`, replace with `/rooms`,
   **files to include:** `src, tests, checks`, **Match Case** on. **Replace All.** (The tests and the
   browser checks name the address too, so they move with it.)
4. Start `npm run dev` again.

**You should see:** `/rooms` lists the clinic records, `/rooms/<slug>` books them, the old `/clinics`
answers "not found", and `/admin` says **Rooms**.

---

## R6. A many-to-many, shown from both sides

A room has several pieces of equipment; a piece of equipment is in several rooms. The link is stored
once, on the rooms; the equipment reads it back with a join.

1. In `src/collections/Clinics.ts`, under `// Add new clinic fields here, ...`:

   ```ts
       { name: 'equipment', type: 'relationship', relationTo: 'equipment', hasMany: true },
   ```

2. In `src/collections/Equipment.ts`, after the `description` field:

   ```ts
       { name: 'rooms', type: 'join', collection: 'clinics', on: 'equipment' },
   ```

3. The migration and the types:

   ```bash
   npm run migrate:create -- room_equipment
   npm run migrate
   npm run generate
   ```

4. **The room's side.** In `src/app/(site)/rooms/[slug]/page.tsx`:
   - in `findClinic`, change `depth: 0` to `depth: 1` (the equipment then comes with its name and slug);
   - add `import Link from 'next/link'` above `import { notFound } from 'next/navigation'`;
   - after the "About" section (the `</section>` right after `{clinic.summary}`), paste:

   ```tsx
          {(clinic.equipment ?? []).length > 0 && (
            <section aria-labelledby="equipment" className="grid gap-3">
              <h2 id="equipment" className="text-2xl">Equipment</h2>
              <ul className="grid gap-1">
                {(clinic.equipment ?? []).map((item) =>
                  typeof item === 'object' ? (
                    <li key={item.id}>
                      <Link href={`/equipment/${item.slug}`}>{item.name}</Link>
                    </li>
                  ) : null,
                )}
              </ul>
            </section>
          )}
   ```

5. **The equipment's side.** A new file, `src/app/(site)/equipment/[slug]/page.tsx`:

   ```tsx
   // One piece of equipment, /equipment/<slug>: the other side of the many-to-many. It lists every room
   // that has it, read through the join on equipment (src/collections/Equipment.ts).
   import type { Metadata } from 'next'
   import Link from 'next/link'
   import { notFound } from 'next/navigation'
   import { getPayload } from 'payload'
   import { cache } from 'react'
   import { PageTitle } from '@/components/site/PageTitle'
   import config from '@/payload.config'

   export const dynamic = 'force-dynamic'

   type Props = { params: Promise<{ slug: string }> }

   // cache(): the page and its browser-tab title ask for the same record once per visit.
   const findEquipment = cache(async (slug: string) => {
     const payload = await getPayload({ config })
     const found = await payload.find({ collection: 'equipment', where: { slug: { equals: slug } }, depth: 1, limit: 1, joins: { rooms: { limit: 100 } } })
     return found.docs[0]
   })

   export async function generateMetadata({ params }: Props): Promise<Metadata> {
     const equipment = await findEquipment((await params).slug)
     return equipment ? { title: equipment.name } : {}
   }

   export default async function EquipmentPage({ params }: Props) {
     const equipment = await findEquipment((await params).slug)
     if (!equipment) notFound()
     const rooms = (equipment.rooms?.docs ?? []).filter((room) => typeof room === 'object')

     return (
       <div className="grid gap-block pb-6">
         <PageTitle title={equipment.name} intro={equipment.description} />
         <section aria-labelledby="rooms" className="grid gap-3 px-6 sm:px-10 lg:px-14">
           <h2 id="rooms" className="text-2xl">{rooms.length === 0 ? 'No room has this yet' : `Rooms with ${equipment.name}`}</h2>
           <ul className="grid gap-1">
             {rooms.map((room) => (
               <li key={room.id}>
                 <Link href={`/rooms/${room.slug}`}>{room.name}</Link>
               </li>
             ))}
           </ul>
         </section>
       </div>
     )
   }
   ```

**You should see:** in `/admin`, give two rooms their equipment. A room's page lists its equipment,
each a link; `/equipment/music-stands` lists both rooms that have music stands. The course check's
team section shows the link: `{"from":"clinics","field":"equipment","to":"equipment","join":"rooms"}`.

---

## R7. A list page with a filter in the address

`/rooms?equipment=upright-piano` lists only the rooms with a piano. The filter is a plain form that
sends with GET: it works without JavaScript, Back returns to it, and a filtered list can be shared.
Replace the whole of `src/app/(site)/rooms/page.tsx` with:

```tsx
// The rooms, /rooms, with a filter in the address: /rooms?equipment=upright-piano lists only the rooms
// that have that equipment. The filter is a plain form that sends with GET, so it works without
// JavaScript, the Back button returns to it, and a filtered list can be bookmarked or shared.
import type { Metadata } from 'next'
import { getPayload } from 'payload'
import { ButtonLink } from '@/components/site/ButtonLink'
import { FramedCard } from '@/components/site/FramedCard'
import { Notice } from '@/components/site/Notice'
import { PageTitle } from '@/components/site/PageTitle'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { formatWhen, imageFrom } from '@/lib/format'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

// The page's picture, from the media library. To use another one, upload it in /admin and put its
// file name here.
const ROOMS_IMAGE = 'clinic-tools'

export const metadata: Metadata = {
  title: 'Rooms',
  description: 'The practice rooms of Riverside Voices, with what each one has.',
}

// The address's ?equipment=... (Next.js passes it; a test may call the page without it).
type Props = { searchParams?: Promise<{ equipment?: string }> }

export default async function RoomsPage({ searchParams }: Props = {}) {
  const { equipment = '' } = (await searchParams) ?? {}
  const payload = await getPayload({ config })
  // The choices for the filter, and the one chosen (none when the address names no known equipment).
  const choices = (await payload.find({ collection: 'equipment', sort: 'name', depth: 0, limit: 100 })).docs
  const chosen = choices.find((item) => item.slug === equipment)
  const rooms = (
    await payload.find({
      collection: 'clinics',
      where: chosen ? { equipment: { in: [chosen.id] } } : {},
      sort: 'name',
      depth: 0,
      limit: 100,
    })
  ).docs
  const picture = (await payload.find({ collection: 'media', where: { filename: { contains: ROOMS_IMAGE } }, limit: 1 })).docs[0]

  return (
    <div className="grid gap-block pb-6">
      <PageTitle title="Rooms" intro="Choose a room for your group, then book an hour on its page." image={imageFrom(picture)} />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="equipment">Equipment</Label>
          <NativeSelect id="equipment" name="equipment" defaultValue={chosen?.slug ?? ''}>
            <NativeSelectOption value="">Any equipment</NativeSelectOption>
            {choices.map((item) => (
              <NativeSelectOption key={item.id} value={item.slug}>
                {item.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit">Show rooms</Button>
      </form>

      {/* role="status": a screen reader reads out how many rooms the filter left. */}
      <p role="status" className="font-semibold">
        {chosen ? `Rooms with ${chosen.name}: ${rooms.length}` : `All rooms: ${rooms.length}`}
      </p>

      {rooms.length === 0 && !chosen ? (
        <Notice tone="warning" label="Not open yet" className="max-w-3xl">
          <p className="font-heading text-xl font-extrabold">The rooms open soon</p>
          <p>When they open, you can book an hour on this page for your group.</p>
        </Notice>
      ) : rooms.length === 0 ? (
        <Notice tone="warning" label="No room" className="max-w-3xl">
          <p>No room matches this filter.</p>
          <ButtonLink href="/rooms" variant="secondary" className="mt-2 w-fit">Show all rooms</ButtonLink>
        </Notice>
      ) : (
        <ul className="grid max-w-3xl gap-block">
          {rooms.map((room) => (
            <li key={room.id} className="grid">
              <FramedCard title={room.name} href={`/rooms/${room.slug}`} accent="coral" headingLevel="h2">
                <p className="font-semibold">{formatWhen(room)}</p>
                <p>{room.summary}</p>
                <ButtonLink href={`/rooms/${room.slug}`} className="w-fit">Book an hour</ButtonLink>
              </FramedCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

One test reads the old page's words for an empty list. In `tests/integration/pages.test.tsx`, change
`expect(list).toContain('The repair clinic opens soon')` to
`expect(list).toContain('The rooms open soon')` (after R10 it already says so).

**You should see:** `/rooms` says "All rooms: 2"; choose **Upright piano** and **Show rooms**: the
address becomes `/rooms?equipment=upright-piano` and the page says "Rooms with Upright piano: 1".
An address with equipment that does not exist shows all rooms.

---

## R8. Make your migration again when main moved

Two pairs each made a migration on their own branch, and the other pair's pull request was merged
first. Your branch's migration was made from the old `main`, so it is out of date: make it again.

```bash
git switch main
git pull
git switch equipment
git merge main
```

Git stops with a conflict in `src/migrations/index.ts`. Open it in VS Code and choose
**Accept Incoming** at each conflict, then save. Then throw your own migration away and make it again
(your two files are named `<date>_<time>_<name>.ts` and `.json`):

```bash
git rm src/migrations/20261018_145705_equipment.ts src/migrations/20261018_145705_equipment.json
npm run migrate:create -- equipment
npm run migrate
```

**If `npm run migrate` stops** with `MIGRATIONS: FAILED` and `relation "equipment" already exists`:
your laptop's database still has the old version of your migration. Start it afresh: stop
`npm run dev` (**Ctrl+C**), delete the folder `.data/db`, then:

```bash
npm run migrate
npm run seed
```

Then finish:

```bash
npm run generate
git add -A
git commit -m "Merge main; equipment migration made again"
git push
```

**You should see:** `MIGRATIONS: verified committed migrations`, and on the pull request CI's
`migrations` job green. If a preview's build log says `MIGRATIONS: FAILED ON THE PREVIEW DATABASE`,
follow the link in that message (troubleshooting.md): the preview's database still has the old
migration too.

---

## R9. One more booking-form field

How many people come. Seven edits in four files; the field is optional, so a booking without it still
saves.

1. `src/collections/Bookings.ts`, under `// Add new booking fields here.`:

   ```ts
       { name: 'groupSize', label: 'Group size', type: 'number', min: 1, max: 40 },
   ```

2. `src/tasks/book-slot/createBooking.ts`, the type `BookingValues`: add `groupSize?: string;` after
   `note: string;`, so the line reads:

   ```ts
   export type BookingValues = { timeSlot: string; name: string; email: string; note: string; groupSize?: string; repairs?: string[] }
   ```

3. Same file, in `readValues`, under `note: read(formData, 'note'),`:

   ```ts
       ...(formData.has('groupSize') ? { groupSize: read(formData, 'groupSize') } : {}),
   ```

4. Same file, in `check`, under the line that checks the note:

   ```ts
     if (values.groupSize) {
       const size = Number(values.groupSize)
       if (!Number.isInteger(size) || size < 1 || size > 40) errors.groupSize = 'Enter a whole number from 1 to 40, or leave it empty.'
     }
   ```

5. Same file, in `payload.create`, under `note: values.note || undefined,`:

   ```ts
           groupSize: values.groupSize ? Number(values.groupSize) : undefined,
   ```

6. `src/tasks/book-slot/typedValues.ts`: in the `return { ... }`, right after `note: text('note'),`,
   add `...(formData.has('groupSize') ? { groupSize: text('groupSize') } : {}),`.
7. `src/components/site/BookingForm.tsx`, after the e-mail field's closing `</div>`:

   ```tsx
           <div className="grid gap-2">
             <Label htmlFor="groupSize">
               How many people <span className="font-normal text-ink-soft">(optional)</span>
             </Label>
             <Input id="groupSize" name="groupSize" type="number" inputMode="numeric" min={1} max={40} defaultValue={values.groupSize} className="scroll-mt-16" {...problem('groupSize')} />
             {errors.groupSize && <FieldError id="groupSize-error">{errors.groupSize}</FieldError>}
           </div>
   ```

Then R2's commands, with the name `group_size`. The privacy page says what the form saves: add the
group size to it in `/admin` → **Pages** → **Privacy**.

**You should see:** the field under the e-mail address. Type 99 and book: the form comes back with
"Enter a whole number from 1 to 40, or leave it empty." under the field. Type 8: the booking is saved,
and in `/admin` → **Bookings** it has **Group size** 8.

Want the field required? Then every test that sends the form must send it too (the `form` helpers in
`tests/integration/booking.test.ts`, `booking-race.test.ts`, `save-booking.test.ts` and
`members.test.ts`): keep it optional unless your task really needs it.

---

## R10. The booking becomes yours, with the least code

Keep `timeSlots`, `bookings` and the whole `src/tasks/book-slot` folder, as the starter has them.
Rename the clinic (R5), add your fields (R9), and change the words. For each row below: **Edit** →
**Replace in Files**, **files to include:** `src, tests`, **Match Case** on, **Replace All**. The tests
check the words a user reads, so they change with them.

| Search | Replace with |
| --- | --- |
| `The repair clinic opens soon` | `The rooms open soon` |
| `When it opens, you can book a time slot here and bring your bicycle for a check or a repair.` | `When they open, you can book an hour here for your group.` |
| `all repair clinics` | `all rooms` |
| `All repair clinics` | `All rooms` |
| `See the repair clinic` | `See the rooms` |
| `book a repair clinic slot` | `book an hour in a room` |
| `Book a repair clinic slot` | `Book an hour in a room` |
| `the repair clinic bookings` | `the room bookings` |
| `Repair clinic` | `Rooms` |
| `Let us fix it` | `Practise here` |
| `Choose a time, book it here, and bring your bicycle for a check or a repair.` | `Choose an hour and book it here for your group.` |
| `About the clinic` | `About the room` |
| `what is wrong with your bicycle` | `what you will rehearse` |
| `Back to the clinic` | `Back to the room` |
| `The clinic&apos;s page` | `The room&apos;s page` |

Change the order of the rows only if you know why: `Repair clinic` comes after the two longer ones
that contain it in lower case (the search is for exactly these letters, capitals included).

Then the course check. `src/course-check.config.ts` already names the bookings and their `name` field;
leave it as it is:

```ts
export const courseCheckConfig: CourseCheckConfig = {
  transactional: {
    collection: 'bookings',
    nameField: 'name',
  },
}
```

**Before every team hand-in** (from H2 on): make one booking on the live site with your team code in
the name, for example `Choir T29-7G6N`. The course's check looks for that booking.

**You should see:** a room page that speaks of rooms and hours. Book with the name `Choir T29-7G6N`,
then open `/api/course-check?include=team&code=T29-7G6N`: under `"transactional"`,
`"status":"ok"` and `"newest"` with the booking's id and time.

---

## R11. OpenStreetMap on the contact page

In `src/app/(site)/contact/page.tsx`, inside `<PlainPage>`, after the list of facts (after the `)}`
that closes `{facts.email && facts.place && ( ... )}`), paste:

```tsx
      {/* The map: OpenStreetMap's own embed, from openstreetmap.org (Share, then HTML). The title says
          what the frame shows; the link below opens the same map for people who cannot use the frame. */}
      <iframe
        title="Map: where to find us"
        src="https://www.openstreetmap.org/export/embed.html?bbox=3.7150%2C51.0515%2C3.7275%2C51.0570&layer=mapnik&marker=51.0543%2C3.7212"
        loading="lazy"
        className="h-80 w-full max-w-(--container-reading) rounded-frame border border-line"
      />
      <p>
        <a href="https://www.openstreetmap.org/?mlat=51.0543&mlon=3.7212#map=17/51.0543/3.7212">Open the map on its own page</a>
      </p>
```

Your own place: on openstreetmap.org, find it, then **Share** → **HTML**, and copy the `bbox` and
`marker` numbers from its `src` into the lines above. Do not paste OpenStreetMap's whole snippet: its
`style="..."` does not work in a `.tsx` file.

Two more things, because the map is a service of someone else:

- **The privacy page** (`/admin` → **Pages** → **Privacy**): say that the contact page shows a map from
  openstreetmap.org, which receives each user's internet address when the map loads.
- **The decision record** (`docs/decisions/integration.md`): write `OpenStreetMap` under
  **The decision**.

**You should see:** the map on `/contact`, with the marker on your place, and the link under it.
