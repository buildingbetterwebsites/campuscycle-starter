# Example task 1: find a workshop by topic and level

A user who wants to learn a bicycle repair opens **Workshops**, picks a topic and a level, and gets the
matching workshops. From a workshop they can open its topics; a topic's page lists every workshop on
that topic.

## Where it lives

| File | What it does |
|---|---|
| `src/tasks/find-workshop/filters.ts` | Reads the filters from the address (`?topic=…&level=…`), leaves out anything it cannot use, and says the result in words |
| `src/tasks/find-workshop/queries.ts` | Turns the filters into a question for the database (a Payload `where`) |
| `src/app/(site)/workshops/page.tsx` | The list page: the filter form, the result line and the cards |
| `src/app/(site)/workshops/[slug]/page.tsx` | One workshop's page, with a Back link to the same filtered list |
| `src/app/(site)/topics/[slug]/page.tsx` | One topic's page, listing its workshops from the other side of the link |
| `src/components/site/WorkshopFilters.tsx`, `WorkshopCard.tsx`, `TopicList.tsx`, `ParentLink.tsx` | The parts those pages are made of |
| `tests/unit/filters.test.ts`, `tests/integration/find-workshop.test.tsx` | The tests |

## Why it is built this way

- **The filters live in the web address.** The form uses `method="get"`, so choosing filters only
  changes the address. A filtered list can then be shared and bookmarked, Back returns to it, and it
  works without JavaScript.
- **An address can say anything.** Someone can type `?level=expert`, or follow an old link to a topic
  that was removed. The page leaves out what it cannot use and never crashes:
  - an empty value, such as `?topic=` (what the form sends for "All topics"), means no filter;
  - an unknown level, such as `?level=expert`, is ignored, so the list shows the workshops of every
    level (and the form shows "All levels");
  - an unknown topic, such as `?topic=unicycles`, gives an empty list with "No workshops match these
    filters" and a **Clear filters** link. It is not a "page not found": the list itself still exists.

  Why the two differ: a level is one of a fixed set written in the code, so any other value can only
  be a typing mistake, and leaving it out is safe. A topic is a record an editor can rename or remove,
  so an unknown topic usually means an old link, and showing every workshop would pretend the topic
  still had them.
- **After "Apply filters" the page opens at the results** (`/workshops?…#results`), so on a phone the
  user sees them without scrolling past the form again.
- **An unknown workshop or topic page is a real "not found" (404)**: that page does not exist.
- **Every fact comes from one place.** A workshop's level, day, times, price and group size are its
  own fields; the place and the pricing rule are in the Site facts global (`/admin` → Site facts).
  The description is only words about what you learn, so a price changed in /admin is right
  everywhere at once.

## Adapting it to your own site

Say your site lists concerts, and users filter them by genre and by city.

Change these three files:

1. **`filters.ts`**: your filters and their allowed values. Rename `topic` to `genre`, and replace
   `LEVELS` with your own list (or check a city's slug the way a topic's slug is checked). Change
   `filterSummary` so the result line reads well ("Showing jazz concerts in Ghent — 3 concerts").
2. **`queries.ts`**: which field each filter checks. A many-to-many link (like a workshop's topics)
   uses `in`; a single choice (like the level) uses `equals`.
3. **`src/app/(site)/workshops/page.tsx`** (move it to your own address, for example
   `src/app/(site)/concerts/page.tsx`): the collection it reads, its title and intro, and which
   options the form offers.

Then rename the components' labels ("Topic", "Level") and the card's facts in `WorkshopCard.tsx`.

These stay as they are, because they make the task work for every user:

- the plain GET form with a visible label above each field and an **Apply filters** button;
- reading the address carefully, and the empty result with **Clear filters**;
- the result line in words, which is also the browser tab's title (a screen reader reads it out when
  the page opens);
- the Back link that carries the filters (`filterQuery`);
- `export const dynamic = 'force-dynamic'` on each page, so an editor's change shows at once;
- the tests: change their names and values to your content, and keep what they check.

## Updating a site that already has the example content

The example content is added once per database. A database seeded before this task was added still
has the gear workshop's "It ends by 15:00 at the latest." as a sentence in its description, and no
"Ends at the latest" value. To bring it in line, open the workshop "Service a gear system" in /admin,
set **Ends at the latest** to 15:00, and delete that sentence from the description. (Or start from a
fresh database and seed it. `npm run seed -- --again` does not help here: it only adds records that
are missing, and never changes one that exists.)
