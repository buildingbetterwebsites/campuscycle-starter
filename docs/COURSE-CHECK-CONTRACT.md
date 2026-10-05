# The course-check contract (W4–W6)

This is the agreement between this starter and the course app's W4–W6 checkers. Anything a checker relies on is written here. **Change it only together with the checker.**

The route is `src/app/api/course-check/route.ts`, with its rules in `src/lib/courseCheck.ts` and its database reads in `src/lib/courseCheckResponse.ts`. Its tests are `tests/unit/courseCheck.test.ts` and `tests/integration/course-check.test.ts`, with the after-W6 fixture `tests/fixtures/config-after-w6.ts`.

### Interpretations agreed

Where the text below left a choice, the route does this:

1. A method Next.js does not pass to a route (TRACE, CONNECT or a made-up one) is refused by Next.js itself: 400, or 500 for TRACE on the dev server. It never reaches the route.
2. A 405 answer has no body, an `Allow: GET, HEAD` header and `Cache-Control: no-store`.
3. `Retry-After` is always `60`, a full minute, which is always enough.
4. The code is checked before the rate limit: an invalid code gets its 400 without reading the database, and does not count towards the 30 a minute. Valid checks count, HEAD included.
5. "Whole token": a letter in any language, a digit or a hyphen right next to the code blocks the match; other characters, such as `_`, `.` or `(`, do not.
6. A code holds only the letters A to Z and the digits 0 to 9: no letter from another alphabet passes, even one that capitalises to an English letter (such as the long s).
7. An empty or spaces-only item in `whatToBring` is left out; every other item is returned as stored, only cut to fit the limits under "The answer".
8. `booking` counts different repairs: a booking linked twice to the same repair has one repair.
9. `bookings.repairs` counts only with `relationTo: 'repairs'` as a single name; a list of collections (`['repairs']`) does not.
10. When two clinics with the code were updated at the same moment, the one created later wins.
11. Without a code, a site whose clinics have no `whatToBring` field answers `whatToBring: null`; a site without clinics answers `null` too.
12. When the database cannot be read, the details go only to the server's log, never into the 503 answer.
13. A `code` made only of spaces counts as no code: it gets the answer for the whole site, not a 400.

## The route

`GET /api/course-check` (also `HEAD`; every other standard method answers 405; Next.js itself refuses any non-standard method before the route runs). The route sits outside any login, middleware or redirect: it is a plain public route handler, and the starter has no `middleware.ts`/`proxy.ts` in front of it. It is served on the site's **production** address, for example `https://campuscycle-mina.vercel.app/api/course-check?code=BW-7F3K`. Preview addresses sit behind Vercel's login on Hobby, so checkers never fetch them.

| Request | Meaning |
| --- | --- |
| `?code=<personal or team code>` | The answer for that code (hand-ins checked by the course) |
| no `code` parameter, `code=` (empty), or a code made only of spaces | The answer for the site as a whole ("Check my work" for self-study learners, who have no personal code) |

### The code

- It is accepted in either of two forms, in any letter case, with spaces around it trimmed:
  - the course app's personal code: `BW-` followed by 4 letters or digits (`^BW-[A-Z0-9]{4}$`, for example `BW-7F3K`);
  - 4 to 8 letters and digits (`^[A-Z0-9]{4,8}$`, the original form, kept for team codes and tests).
- Any other value answers **400**.
- The code matches only as a **whole token**: the characters directly before and after it may not be letters, digits or a hyphen. Letter case is ignored.
  - `Saturday repair clinic. Code BW-7F3K.` matches `BW-7F3K`.
  - `BW-7F3KX` and `XBW-7F3K` do not.

### The answer

Status 200, `Content-Type: application/json`, `Cache-Control: no-store`. The body is exactly these three keys and nothing else:

```json
{ "clinic": true, "whatToBring": ["your bike", "a lock"], "booking": false }
```

| Key | With a code | Without a code |
| --- | --- | --- |
| `clinic` (boolean) | Some clinic's `summary` contains the code (W4) | At least one clinic exists |
| `whatToBring` (`string[]` or `null`) | The `item` values of `clinics.whatToBring`, in order, from the **most recently updated** clinic whose summary contains the code. `null` when no clinic matches, or the field does not exist or has another shape (W5) | The same list from the most recently updated clinic |
| `booking` (boolean) | Some booking whose `name` contains the code has **2 or more** `repairs` (W6) | Some booking has 2 or more repairs |

- `whatToBring` counts only when `clinics.whatToBring` is an `array` field with a `text` sub-field named `item`. Empty and whitespace-only items are left out; others are returned as stored, at most the first 50 items, each at most 200 UTF-16 code units (JavaScript string length), never splitting a character. An existing field with no rows answers `[]`.
- `booking` counts only when `bookings.repairs` is a `relationship` to `repairs` with `hasMany: true`. Otherwise it answers `false`.
- The reverse side `repairs.bookings` (a `join` on `repairs`) is what students inspect in `/admin`. The route does not read it.
- The answer **never** contains a name, an e-mail, a note, an id or a slot. It contains only the two booleans and the clinic's public list.

### Errors

| Status | Body | When |
| --- | --- | --- |
| 400 | `{ "error": "invalid_code" }` | The code is not one of the two accepted forms |
| 429 | `{ "error": "rate_limited" }`, with a `Retry-After` header in seconds | More than **30 requests a minute** from one IP address |
| 503 | `{ "error": "unavailable" }` | The database could not be read, for example while Neon wakes up from a pause. **Retry once after a few seconds.** |

A cold site can take 2–5 seconds to answer (Payload starts up, and Neon wakes up). Allow 30 seconds and one retry.

### Stability before and after W5 and W6

The route reads the fields from the running config (`payload.collections.clinics.config.flattenedFields` and `payload.collections.bookings.config.flattenedFields`). It never uses the generated types for `whatToBring` or `repairs`. So the same file compiles and answers correctly:

- before W5;
- after W5;
- after W6.

A test fixture with both fields added proves this (`tests/fixtures/config-after-w6.ts`).

## What the students add, and where

| Warm-up | Field | File | Shape |
| --- | --- | --- | --- |
| W4 | (none: content only) | `/admin` → Clinics | A clinic whose `summary` contains the personal code, and at least two time slots |
| W5 | `clinics.whatToBring` | `src/collections/Clinics.ts` | `{ name: 'whatToBring', type: 'array', fields: [{ name: 'item', type: 'text', required: true }] }` |
| W6 | `bookings.repairs` | `src/collections/Bookings.ts` | `{ name: 'repairs', type: 'relationship', relationTo: 'repairs', hasMany: true }` |
| W6 | `repairs.bookings` (reverse side) | `src/collections/Repairs.ts` | `{ name: 'bookings', type: 'join', collection: 'bookings', on: 'repairs' }` |

- Each model change brings a migration:
  - `src/migrations/<YYYYMMDD_HHMMSS>_<name>.ts`;
  - its `.json` snapshot of the same name;
  - an updated `src/migrations/index.ts`.
- W6's booking form already contains the repair choice, commented out, in `src/components/site/BookingForm.tsx`. The server side is the two lines marked W6 in `src/tasks/book-slot/createBooking.ts`.

## Other fixed names a checker may read

- **Template repository:** `buildingbetterwebsites/campuscycle-starter` (public, published on 6 October 2026). A copy made with "Use this template" reports it as GitHub's `template_repository.full_name`.
- **Vercel project name:** `campuscycle-<your name>`. This is the name the W4 check reads.
- **CI:** the workflow file is `.github/workflows/ci.yml`, with the workflow name `CI`. Its jobs:
  - `test`: lint, types and the tests;
  - `types-fresh`;
  - `migrations`: migrations apply, no migration missing, removals flagged;
  - `browser-checks`;
  - `ai-note`: pull requests only;
  - `leftovers`: off by default.

  W4's "CI is green on that commit" means GitHub's combined check status for that commit is success.
- **Pull request template:** `.github/pull_request_template.md`. The AI-note heading is exactly `## AI note: what I asked AI, and what I checked`. The `ai-note` job fails when the text under that heading is empty or still the template's placeholder. "No AI used." passes.
- **Home page:**
  - The page is `src/app/(site)/page.tsx`.
  - The component W4 students are told to change is `src/components/site/Hero.tsx`. **This path is stable.** The chapter (10.4) asks learners to put their own name in the Hero's tagline as the change. The W4 check compares the git blob sha of `src/components/site/Hero.tsx` at the student's deployed commit with the template's. The template's blob sha, recorded for its first publication (6 October 2026): `TEMPLATE_HERO_BLOB_SHA = 0c89194ec818ad7a1dec6a5eba492ffc73a8df1a`. `git rev-parse HEAD:src/components/site/Hero.tsx` on the published template's first commit gives the same value.
  - Before a clinic exists, the home page shows the exact text **"The repair clinic opens soon"**. Once one exists, it links to `/clinics/<slug>`.
- **Clinic page:** `/clinics/<slug>` shows the clinic's summary, so the personal code is visible there.

## Project documents (final check)

The starter ships a template for each of the learner's project documents.

The course app's final "Check my work" reads four files by path: `docs/brief.md`, `docs/requirements.md`, `docs/test-report.md` and `docs/handover.md`. Each passes when it exists and contains no `TODO:`. It reads the folder `docs/decisions/`, which passes when at least TWO `.md` files in it other than `README.md` contain no `TODO:`, under any names; `README.md` is never read. The starter's templates `docs/decisions/analytics.md` and `docs/decisions/integration.md` are the two records the course asks for; the check does not name them.

A team's final hand-in checks the same files and folder, plus three team files, each read by path and passing when it exists and contains no `TODO:`: `docs/team-agreement.md`, `docs/content-structure.md` and `docs/design-rationale.md`. An individual final hand-in never reads them.

In the templates, `TODO:` marks only the places a learner fills in. `docs/decisions/README.md` holds
instructions only and has no `TODO:`, which no longer matters to the check. The section headings inside the templates follow the chapters 'The project documents' and 'Finishing and handing over'; change them only together with those chapters. The paths are fixed.

## What the checker should not assume

- That the site is warm: allow for a cold start.
- That `whatToBring` is non-null before the student's W5 migration has run in production. The W5 check reads the live route after the merge's production deploy.
- That a 200 answer proves the route file is unchanged. The W6 check compares the live deployment's commit and the route file with the starter's. The route is not the only check: the course also looks at the live site and the project itself.
