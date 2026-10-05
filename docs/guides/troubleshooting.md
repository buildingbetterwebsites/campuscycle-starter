# Troubleshooting: what a message means and what to do

When something goes wrong, this starter prints a message that says what happened. Find the message
below: each one has its own heading, with the message in full under it. Then read **What it means**
and **What to do**.

To find your message fast, press **Ctrl+F** (on a Mac: **Cmd+F**) and type its first few words.

The messages are in the order you are most likely to meet them:

1. [While you set up your live site](#while-you-set-up-your-live-site) (your first hour)
2. [While you use your live site](#while-you-use-your-live-site)
3. [CI on GitHub](#ci-on-github)
4. [On your own computer](#on-your-own-computer)
5. [Previews (pull requests)](#previews-pull-requests)

Where do you see a message?

- **Vercel's build log:** in your Vercel project, open **Deployments**, click the deployment, then
  open its build log. A failed build stops at the message, so it is usually near the end.
- **Your terminal:** for `npm run dev`, `npm run migrate` and `npm run seed` on your own computer.
- **GitHub:** a red cross next to a commit or a pull request. Click it, then **Details**, to see the
  check's log.

---

# While you set up your live site

<a id="no-database"></a>

## NOT CONFIGURED YET: there is no database.

> NOT CONFIGURED YET: there is no database. In Vercel: Storage → connect Neon (Postgres) to this project, then Redeploy.

**What it means:** your Vercel project has no database yet. This is **expected** on your very first
deploy: the first-hour guide tells you to deploy before you connect the database.

**What to do:** connect Neon from inside Vercel, then redeploy. The
[first-hour guide](first-hour.md#part-c-connect-the-database-and-the-image-storage) shows every
click. Check that you connected Neon to **Production**.

## NOT CONFIGURED YET: PAYLOAD_SECRET is missing or shorter than 32 characters.

> NOT CONFIGURED YET: PAYLOAD_SECRET is missing or shorter than 32 characters. In Vercel: Settings → Environment Variables → add PAYLOAD_SECRET (32 or more characters), then Redeploy.

**What it means:** the setting `PAYLOAD_SECRET` is empty, or it holds fewer than 32 characters. The
site uses it to sign log-ins, so the Vercel build stops without a long one.

**What to do:**

1. In your Vercel project, open **Settings**, then **Environment Variables**.
2. Find `PAYLOAD_SECRET`. Edit it, or add it if it is missing.
3. Give it a random text of 32 characters or more. Choose **Production and Preview** for it.
4. **Save**, then redeploy (Deployments → **…** → **Redeploy**).

## NOT CONFIGURED YET: the live database must be a Neon database

> NOT CONFIGURED YET: the live database must be a Neon database connected through Vercel Storage. In Vercel: Storage → connect Neon (Postgres) to this project (not a different kind of database), then Redeploy.

**What it means:** your live site has a database address, but it is not a Neon address. The starter
protects your live database with a check that only works with Neon, so it refuses any other kind.

**What to do:** in Vercel, open **Settings** → **Environment Variables**. Delete any database address
you typed in yourself (`DATABASE_URL`, `STORAGE_URL` and their `_UNPOOLED` partners). Then connect
Neon through **Storage**, as the first-hour guide shows, and redeploy.

## DATABASE SET UP WRONG: Conflicting DATABASE_URL and STORAGE_URL

> DATABASE SET UP WRONG: Conflicting DATABASE_URL and STORAGE_URL: they hold two different database addresses. In Vercel: Settings → Environment Variables → keep the database variables that connecting Neon added, delete the ones you added yourself, then Redeploy.

The message can also name `DATABASE_URL_UNPOOLED` and `STORAGE_URL_UNPOOLED`.

**What it means:** your project has the database address twice, under two names, and the two
addresses are different. The starter cannot know which one you meant, so it stops. This usually
happens when someone typed in a `DATABASE_URL` by hand, next to the one connecting Neon added.

**What to do:** in Vercel, open **Settings** → **Environment Variables**. Keep the variables that
connecting Neon added. Delete the ones you added yourself. Then redeploy.

## DATABASE SET UP WRONG: your database has two addresses that point at different databases

> DATABASE SET UP WRONG: your database has two addresses (DATABASE_URL and DATABASE_URL_UNPOOLED, or STORAGE_URL and STORAGE_URL_UNPOOLED) that point at different databases. In Vercel: Storage → your Neon database → disconnect it from this project, connect it again, then Redeploy.

**What it means:** Neon gives every database two addresses: one for the website and one for changes
to its tables (the `_UNPOOLED` one). Yours point at two different databases. Changing the tables of
one while the site reads the other would break the site, so the build stops.

**What to do:** in Vercel, open **Storage**, then your Neon database. Disconnect it from this project
and connect it again (to **Production** only). Then redeploy.

<a id="could-not-reach"></a>

## Could not reach your database to check which one it is

> Could not reach your database to check which one it is: (the reason). Check DATABASE_URL in .env.local (or in Vercel), then try again.

**What it means:** there is a database address, but the database did not answer. A Neon database
that has not been used for a few minutes goes to sleep, and the first connection wakes it up; that
usually takes only a few seconds. Or the address has a typing mistake.

**What to do:**

1. Try again once: redeploy on Vercel, or run your command again on your own computer.
2. Still the same? Check the address. On your own computer: the `DATABASE_URL` line in `.env.local`.
   Copy it again from Neon's **Connect** screen; it starts with `postgresql://` and ends with
   `?sslmode=require`. On Vercel: do not type addresses yourself; connecting Neon adds them.

## The database did not answer within 110 seconds.

> The database did not answer within 110 seconds. If your Neon database was asleep, try again; otherwise check the address.

**What it means:** `npm run migrate` (or the migration step of a Vercel build) waited almost two
minutes and the database never answered.

**What to do:** the same as for
[Could not reach your database](#could-not-reach).

<a id="migrations-failed"></a>

## MIGRATIONS: FAILED. The migration step did not confirm …

On Vercel:

> MIGRATIONS: FAILED. The migration step did not confirm that every committed migration is in your live database (see the messages above), so the build stops here: the site would otherwise run without the tables it needs. Fix the error above, then Redeploy.

On your own computer:

> MIGRATIONS: FAILED. The migration step did not confirm that every committed migration is in your database. Read the error above, fix it, then run `npm run migrate` again.

**What it means:** a migration changes your database's tables to match the content model (the
collections in `src/collections`). The migration step must end with the line
`MIGRATIONS: verified committed migrations`. It did not, so the starter stops rather than run the site
without the tables it needs. Your live site keeps running the previous deployment.

**What to do:**

1. Scroll up in the log to the first error above this line. It says what went wrong.
2. A message about the connection (`timeout`, `ECONNREFUSED`, `password authentication failed`)?
   See [Could not reach your database](#could-not-reach).
3. A message about a migration file? The migration itself is broken. Run `npm run migrate` on your
   own computer, against your own database (see the [local set-up guide](local-setup.md)), and fix
   it there first.
4. Redeploy (on Vercel) or run `npm run migrate` again (on your own computer).

## MIGRATIONS: ran, but could not record which database is the live one

> MIGRATIONS: ran, but could not record which database is the live one: (the reason). Try Redeploy; if it happens again, check the database in Vercel Storage.

**What it means:** the migrations worked: your tables are fine. Then the build tried to note, in your
live database, that this database is the live one, and could not. That note is what later stops a
preview or your own computer from touching the live data, so the build stops here rather than go on
without it.

**What to do:**

1. Redeploy once (Deployments → **…** → **Redeploy**). A database that was waking up usually answers
   the second time.
2. It happens again? In Vercel, open **Storage** and check that your Neon database is still there and
   connected to **Production**. Read the reason in the message for more.

<a id="no-blob-store"></a>

## Images cannot be stored: this Vercel project has no Blob store connected.

> Images cannot be stored: this Vercel project has no Blob store connected. In Vercel: Storage → Create Storage → Blob (Public), connect it to Production only, with its read-write token (Settings → Environment Variables then lists BLOB_READ_WRITE_TOKEN), then Redeploy.

**What it means:** the first build adds the example content, which includes six photos. On Vercel,
photos must go to a Blob store, and your project has none yet (or its token setting is missing).
The line `SEED: FAILED.` follows. Your admin account was created before this step: it exists, and
you can log in to `/admin` once a build succeeds.

**What to do:** connect a Blob store as the
[first-hour guide](first-hour.md#part-c-connect-the-database-and-the-image-storage) shows. Two
settings matter, and Vercel may suggest otherwise for both:

- **Public**, not Private: the photos are shown on a public website.
- **Add a read-write token env var to this connection**: ticked, if the dialog has that box. Without
  it, the site has no `BLOB_READ_WRITE_TOKEN` and cannot store anything.

Then check **Settings** → **Environment Variables**: `BLOB_READ_WRITE_TOKEN` must be listed for
Production. Then redeploy.

<a id="seed-failed"></a>

## SEED: FAILED.

On Vercel:

> SEED: FAILED. The seed step did not confirm that it finished (see the messages above), so the build stops here. Your database tables are fine; only the example content (and, on a new site, the first editor account) may be missing. Check FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD in Vercel if the error above mentions them. Fix the error above, then Redeploy.

On your own computer:

> SEED: FAILED. The seed did not confirm that it finished. Read the error above, fix it, then run `npm run seed` again: it creates only what is still missing.

**What it means:** the seed adds your first admin account and the Campus Cycle example content. It
must end with the line `SEED: verified`. It did not.

**What to do:** read the message just above this line. The usual ones are
[Images cannot be stored](#no-blob-store)
and [No admin user exists](#no-admin-user).
Fix that, then redeploy (or run `npm run seed` again). It is safe to run again: it creates only what is
still missing.

## The seed did not finish within 110 seconds.

> The seed did not finish within 110 seconds. If your Neon database was asleep, try again; otherwise check the database address and the messages above. Run it again when it is fixed: it creates only what is missing.

**What it means:** the seed took almost two minutes and was stopped.

**What to do:** try again once (redeploy, or run `npm run seed` again). It creates only what is still
missing. If it happens again, read the messages above it, and check the database address as for
[Could not reach your database](#could-not-reach).

<a id="no-admin-user"></a>

## No admin user exists and FIRST_ADMIN_EMAIL / FIRST_ADMIN_PASSWORD are not set.

> No admin user exists and FIRST_ADMIN_EMAIL / FIRST_ADMIN_PASSWORD are not set. Add both - in your own .env.local for local work, or in Vercel (Settings → Environment Variables) before the first deploy - then try again.

**What it means:** your database has no admin account yet, and the two settings the starter makes it
from are missing. A new Payload site would otherwise let the first person who opens `/admin` create
the admin account, whoever that is. This starter refuses to leave that door open.

**What to do:**

- **On Vercel:** open **Settings** → **Environment Variables**. Add `FIRST_ADMIN_EMAIL` and
  `FIRST_ADMIN_PASSWORD` (choose **Production and Preview**). Then redeploy.
- **On your own computer:** fill in both lines in `.env.local`, then run `npm run seed` again (or
  restart `npm run dev`).

## Vercel offers "Promote to Production"

**What it means:** on a deployment's **…** menu, Vercel offers **Promote to Production**. Never use it
for this starter. Every change to your live site must go through a build whose log shows the line
`MIGRATIONS: verified committed migrations`: that line proves your live database has every
migration. Whether a promoted deployment runs that build again is not something these guides could
confirm, so do not rely on it.

**What to do:** use **Redeploy** on your production deployment instead (Deployments → **…** →
**Redeploy**). Then open the new deployment's build log and check that it shows
`MIGRATIONS: verified committed migrations`.

---

# While you use your live site

## This slot is full. Choose another time.

> This slot is full. Choose another time.

**What it means:** someone booked the last place of that time slot. Every slot has a number of places
(2 for the Saturday repair clinic), and a full slot cannot be booked. The form comes back with every
slot's places as they are now; the full one says **Full**.

**What to do:** as a user, choose another time. As the site's owner, if you need more places: in
`/admin`, open **Time Slots**, open the slot, and raise **Places**. Or add another time slot.

## Too many bookings from this device. Try again in an hour.

> Too many bookings from this device. Try again in an hour.

**What it means:** one device can make at most 5 bookings an hour. This stops a program from filling
every slot. You meet it when you test your own booking form many times in a row.

**What to do:** wait an hour, then try again. On your own computer you can also empty the
`throttle` table of your **own** database (never the live one): in Neon's **SQL Editor**, run
`delete from throttle;`. Its rows only hold hashed (unreadable) device addresses.

## The course check answers {"error": "unavailable"}

> {"error": "unavailable"}

**What it means:** the course check (`/api/course-check` on your live site) could not read your
database. This happens when Neon is waking up after a pause: the first request after a quiet while
can take a few seconds.

**What to do:** wait a few seconds and try again once. If it keeps answering this, open your live
site's home page. If that fails too, open your project's **Logs** in Vercel to see the error: the
details are only in those logs, never in the answer.

## The course check answers {"error": "rate_limited"}

> {"error": "rate_limited"}

**What it means:** more than 30 checks in one minute came from one address.

**What to do:** wait a minute, then try again.

## The course check answers {"error": "invalid_code"}

> {"error": "invalid_code"}

**What it means:** the code in the address is not in a form the check accepts. It accepts two forms,
in small or capital letters:

- a personal code like `BW-7F3K`: `BW-`, then 4 letters or digits;
- 4 to 8 letters or digits, with nothing else, like `K7Q2` (a form for team codes).

**What to do:** check the code in the address after `?code=`, letter by letter.

A last answer you might see: status 405, with no text. Only `GET` (what a browser does when you open
the address) and `HEAD` are answered; other kinds of request are refused.

The full agreement is in [the course-check contract](../COURSE-CHECK-CONTRACT.md).

---

# CI on GitHub

CI runs six checks (jobs) on every push to `main` and on every pull request. The
[first-hour guide](first-hour.md#what-ci-checks) lists what each one checks. To see why one failed:
click the red cross next to the commit, then **Details** next to the failed job, and read the log
from the first red line.

## The test job fails after you changed Hero.tsx

**What it means:** the `test` job runs lint, the type check and the tests. After an edit to
`src/components/site/Hero.tsx`, the usual cause is a quote mark: the tagline must stay between two
straight quote marks `'…'`, and a `'` inside it (as in a name like O'Brien) ends the text too early.

**What to do:** open `src/components/site/Hero.tsx` on GitHub and look at the line under
`// W4: put your own name in this tagline`. It must look like
`const TAGLINE = 'Bicycle workshops on campus · a site by Your Name'`. For a `'` in a name, type `\'`
(a backslash, then the quote mark): `O\'Brien`. Commit the fix to `main`.

## Generated files out of date

> Run npm run generate on your own computer, then commit src/payload-types.ts and src/app/(payload)/admin/importMap.js.

**What it means:** the `types-fresh` job failed. After a change to a collection, `npm run generate`
rewrites two generated files. Someone changed the model and did not run it.

**What to do:** on your own computer, run `npm run generate`. Commit the two changed files, then push.

## The site did not start

**What it means:** the `browser-checks` job builds your site and starts it, and the site did not
answer within 60 seconds. The site's own log follows the message in the job's log.

**What to do:** read the site's log in the job for the first error. Then run `npm run build` and
`npm start` on your own computer to see the same error there.

<a id="ai-note-missing"></a>

## AI note: missing.

> AI note: missing. Your pull request's description has no heading "## AI note: what I asked AI, and what I checked". (…)

**What it means:** the `ai-note` job looks for that heading in your pull request's description, and
it is not there. It only runs on pull requests.

**What to do:** on GitHub, open your pull request and edit its description (the **…** menu on the
description, then **Edit**). Add the heading exactly as written, and under it write what you asked an
AI tool and how you checked its answer. If you used no AI, write: No AI used. Save. CI runs again by
itself: you do not need a new commit.

## AI note: empty.

> AI note: empty. Under "## AI note: what I asked AI, and what I checked" in your pull request's description, write what you asked an AI tool and how you checked its answer. (…)

**What it means:** the heading is there, but nothing is under it except the template's hint.

**What to do:** the same as for [AI note: missing.](#ai-note-missing): write your note under the
heading, or "No AI used.", and save the description.

## A model change has no migration

> A model change has no migration: run npm run migrate:create -- <name> on your own computer and commit the new files.

**What it means:** the `migrations` job found a change to a collection that no migration covers. The
live site would break on its next deploy, because its tables would not match the model.

**What to do:** on your own computer, run `npm run migrate:create -- <name>` (for example
`npm run migrate:create -- what_to_bring`). Commit the new files in `src/migrations` (a `.ts` file, a
`.json` file and the changed `index.ts`), then push. The
[local set-up guide](local-setup.md#change-the-content-model) shows every step.

## The migration tool needs an answer

> The migration tool needs an answer (probably a rename). Create the migration on your own computer: npm run migrate:create -- <name>.

**What it means:** the migration tool wanted to ask whether a field was renamed or is new. CI cannot
answer questions.

**What to do:** run `npm run migrate:create -- <name>` on your own computer and answer the question
there. Commit the new files, then push.

## The migration check could not tell whether a migration is missing

> The migration check could not tell whether a migration is missing: the migration tool stopped without saying it had finished comparing (see its messages above). (…)

**What it means:** the check could not finish, so it fails to be safe.

**What to do:** run `npm run migrate:create -- <name>` on your own computer. If it creates files,
commit them and push. If it says nothing changed, run the checks again: on the failed run's page,
click **Re-run jobs**, then **Re-run all jobs**.

## Removals: not explained.

> Removals: not explained. These new migrations remove or rename something, and the data in it can be lost for good: (…)

**What it means:** a new migration in your pull request removes or renames a table, a column or a list
of choices, or changes what kind of value a column holds. That data is gone for good once it runs on
your live site.

**What to do:**

- **You meant it:** in your pull request's description, under the heading
  `## Why this removes or renames`, write what goes and why that is safe. Save the description; CI
  runs again by itself.
- **You did not mean it:** undo the change to the collection, delete the new migration files, and
  create the migration again with `npm run migrate:create -- <name>`.

---

# On your own computer

## REFUSED: no DATABASE_URL (or STORAGE_URL) is set

> REFUSED: no DATABASE_URL (or STORAGE_URL) is set, so there is no database for `npm run migrate` to work on. Put your own Neon database's connection string in .env.local — see docs/guides/local-setup.md.

(The message names the command you ran: `migrate`, `migrate:create` or `seed`.)

**What it means:** the command needs a database, and `.env.local` names none.

**What to do:** follow the [local set-up guide](local-setup.md#make-your-own-database): make a free
Neon database in your own Neon account, copy its address, and put it in `.env.local` on the line
`DATABASE_URL=`. Check that you removed the `#` at the start of that line.

<a id="refused-live-database"></a>

## REFUSED: This is the live database

> REFUSED: This is the live database (its database id is ep-…). Put your own Neon database in .env.local — see docs/guides/local-setup.md.

**What it means:** the address in your `.env.local` is your **live** site's database. The starter
recognises it and refuses: anything you tried out on your own computer would change your real site.

**What to do:** delete that address from `.env.local`. Make a free database of your own, in your own
Neon account, and use its address instead
([local set-up guide](local-setup.md#make-your-own-database)). Never copy the address Vercel added
for your live site.

## REFUSED: Conflicting DATABASE_URL and STORAGE_URL

> REFUSED: Conflicting DATABASE_URL and STORAGE_URL: they hold two different database addresses. In .env.local: delete one of the two lines (DATABASE_URL or STORAGE_URL) so only one database address is left, then try again.

**What it means:** your `.env.local` has a database address under two names, and they differ.

**What to do:** delete one of the two lines, as the message says, then run the command again.

The other messages you can meet on your own computer are listed above, with both their Vercel and
their own-computer versions:
[Could not reach your database](#could-not-reach),
[MIGRATIONS: FAILED](#migrations-failed),
[SEED: FAILED](#seed-failed) and
[No admin user exists](#no-admin-user).

---

# Previews (pull requests)

A preview is a copy of your site that Vercel builds for a branch or a pull request. Previews need a
database of their own: the [local set-up guide](local-setup.md#give-previews-their-own-database)
explains how to give them one.

<a id="preview-no-database"></a>

## NOT CONFIGURED YET: this preview has no database of its own.

> NOT CONFIGURED YET: this preview has no database of its own. Connecting Neon to Production only (the usual first deploy) does not cover previews - see docs/guides/local-setup.md for giving previews their own database, then redeploy this preview.

**What it means:** Vercel built a preview, and previews have no database yet. Your live site is not
affected.

**What to do:**

- **In your first hour,** this means you chose "Create a new branch" when you committed your change to
  `Hero.tsx`. Your live site does not have the change yet. On GitHub, open the pull request that
  commit started. Fill in its AI note (under `## AI note: what I asked AI, and what I checked`;
  "No AI used." is fine), then **Merge pull request**. The change then reaches `main`, and your live
  site is built again. You can ignore the failed preview.
- **Later, when you work with pull requests,** give previews their own database:
  [local set-up guide](local-setup.md#give-previews-their-own-database). Then redeploy the preview.

<a id="preview-not-migrated"></a>

## MIGRATIONS: not running on this preview (its database is not a copy of your live one yet …)

> MIGRATIONS: not running on this preview (its database is not a copy of your live one yet; this is normal before your first production deploy, see docs/guides/troubleshooting.md#preview-not-migrated).

**What it means:** this line is a warning, not an error: the preview still deploys. A preview only
changes the tables of a database that is a proven copy of your live one. Your preview database is
not, yet: it was made before your live site's first successful deploy, so it holds no tables and no
mark of your live database. Pages that need a new field then fail on the preview (see
[column "…" does not exist](#column-does-not-exist)).

**What to do:** make sure your live site has deployed successfully at least once. Then, in Neon, open
your `preview` branch and choose **Reset from parent** (in the branch's **⋮** menu): the branch
becomes a fresh copy of your live database. Then redeploy the preview.

## MIGRATIONS: not running on this preview (its database is not a Neon database …)

> MIGRATIONS: not running on this preview (its database is not a Neon database, so this starter cannot tell whether it is a safe copy; previews should use your Neon preview branch — see docs/guides/local-setup.md).

**What it means:** the preview's database address is not a Neon address, so the starter cannot check
whether it is a safe copy. It does not change its tables.

**What to do:** point your previews at your Neon `preview` branch, as the
[local set-up guide](local-setup.md#give-previews-their-own-database) shows. Then redeploy the
preview.

<a id="preview-migration-failed"></a>

## MIGRATIONS: FAILED ON THE PREVIEW DATABASE (build continues)

> MIGRATIONS: FAILED ON THE PREVIEW DATABASE (build continues). In Neon: Branches → preview → Reset from parent, then redeploy the preview. See docs/guides/troubleshooting.md#preview-migration-failed.

**What it means:** your pull request's migration did not work on the preview database. The preview
still deploys, so you can look at it, but pages that need the new tables may fail. This happens:

- after you created a migration again (for example after fixing your model);
- when another pull request changed the tables of the same preview database first.

**What to do:**

1. In Neon, open **Branches**, then your `preview` branch.
2. Choose **Reset from parent** (in the branch's **⋮** menu), and confirm if Neon asks. The branch
   becomes a fresh copy of your live database again.
3. In Vercel, redeploy the preview (Deployments → the preview → **…** → **Redeploy**).
4. Fails again? Then the migration itself is broken. Run `npm run migrate` on your own computer, read
   the error there, and fix it.

<a id="column-does-not-exist"></a>

## A page on a preview fails: column "…" does not exist

**What it means:** a page on a preview shows an error ("This page could not be shown" on a clinic
page), and the preview's logs in Vercel (the project's **Logs** tab; choose the preview's deployment)
show a database error such as `column "…" does not exist`. On the free Hobby plan these logs are kept
only for a short time, so look soon after the error. The page's code asks for a field that the preview
database does not have yet: the preview's migration did not run.

**What to do:** read the preview's build log for the `MIGRATIONS:` line, and follow its heading in
this guide:
[not running](#preview-not-migrated) or [FAILED ON THE PREVIEW DATABASE](#preview-migration-failed).

## Images do not upload on a preview

**What it means:** your Blob store (where images go) is connected to **Production** only, so your live
site's images stay safe from previews. A preview has nowhere to store an upload, so uploading an image
in a preview's `/admin` fails with an error message (its exact words can differ).

**What to do:** nothing is broken. Upload images on your own computer (they go to the project's
`media` folder) or, after you merged, on your live site.

<a id="preview-live-database"></a>

## STOPPED: this preview is connected to your LIVE database

> STOPPED: this preview is connected to your LIVE database, so anything done on the preview would change your real site. In Vercel: Settings → Environment Variables → make sure DATABASE_URL and DATABASE_URL_UNPOOLED (or STORAGE_URL and STORAGE_URL_UNPOOLED) for Preview are your preview branch's, not Production's (docs/guides/local-setup.md explains the preview branch), then redeploy.

**What it means:** the preview's database setting points at your **live** database. A preview is for
trying things out; on the live database, every booking or edit on the preview would change your real
site. So the build stops.

**What to do:**

1. In Vercel, open **Settings** → **Environment Variables**.
2. Find `DATABASE_URL` and `DATABASE_URL_UNPOOLED` (or `STORAGE_URL` and `STORAGE_URL_UNPOOLED`) for
   **Preview**.
3. Set them to your Neon `preview` branch's addresses, not your live (main) branch's
   ([local set-up guide](local-setup.md#give-previews-their-own-database)).
4. Redeploy the preview.
