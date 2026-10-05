# Working on your own computer, and previews with their own database

This guide comes after [your first hour](first-hour.md): your live site works, and CI is green. Now
you set up the starter on your own computer, so you can change the content model (the collections)
and try changes before they reach your live site. At the end, you give pull requests a preview with a
database of its own.

**Time:** two to three hours, the first time.

**The one rule of this guide:** on your own computer you always work with **your own** database, a
free one in your own Neon account. Never with your live site's database. The starter refuses the live
one (see [REFUSED: This is the live database](troubleshooting.md#refused-live-database)).

---

## What you need

- **Node 22 (the LTS this starter is tested on).** The file `.nvmrc` in the project says `22`.
- **Git**, and an editor such as VS Code (the course's chapter "Your tools: VS Code, Git and GitHub"
  sets them up).
- A **terminal**: VS Code's own (**Terminal** → **New Terminal**) is fine.

Check your Node version in the terminal:

```bash
node --version
```

**You should see:** `v22.` followed by more numbers.

**Something else?**

- An error such as "node is not recognised": Node is not installed. On nodejs.org, open the download
  page and choose **version 22**. The newest version is not the one this starter is tested on.
- Another version, such as `v20.` or `v24.`: install version 22 next to it. With nvm (a tool that
  switches Node versions), run `nvm install 22`, then `nvm use 22` in the project's folder.
- Your computer cannot install Node at all? Use a Codespace instead: see
  [No Node on your computer?](#no-node-on-your-computer-use-a-codespace).

## Get the code

In the terminal, in the folder where you keep your projects:

```bash
git clone https://github.com/<your GitHub name>/campuscycle-<your name>.git
cd campuscycle-<your name>
npm ci
```

`npm ci` installs exactly the package versions the starter was tested with (from `package-lock.json`).
It takes a few minutes the first time.

**You should see:** at the end, a line like `added … packages`. Warnings are fine; an error that ends
the command is not.

npm may also say that it found some vulnerabilities, and suggest `npm audit fix --force`. **Do not
run that command:** it changes the package versions this starter is tested with, and can break it.
The warnings are about packages the starter builds on (Next.js, Payload and their tools), not about
your own code.

## Make your own database

You need a database for your own computer. Make it in **your own** free Neon account. It is not the
database Vercel made for your live site, and it never holds real data.

1. Go to neon.com and sign up (free). Signing up with GitHub is fine.
2. Create a new project. Name it, for example, `campuscycle-local`.
3. **Region:** choose **AWS Europe Central 1 (Frankfurt)**.
4. Create the project.
5. On the project's dashboard, click **Connect**.
6. Copy the connection string. It looks like
   `postgresql://…` and contains `sslmode=require` near its end (sometimes followed by
   `&channel_binding=require`). Copy all of it.

Keep the connection string to yourself: it contains your database's password.

## Fill in .env.local

Your settings for your own computer go in a file called `.env.local`. It is never committed: the
project's `.gitignore` leaves it out.

1. Copy `.env.example` to `.env.local`. In the terminal:
   - on macOS or Linux: `cp .env.example .env.local`
   - on Windows (Command Prompt or PowerShell): `copy .env.example .env.local`
2. Open `.env.local` in your editor and fill in:
   - `PAYLOAD_SECRET=`: a random text of at least 32 characters (it may differ from your live
     site's);
   - `FIRST_ADMIN_EMAIL=` and `FIRST_ADMIN_PASSWORD=`: the admin account for your own computer's
     `/admin` (it may differ from your live site's);
   - `DATABASE_URL=`: first **remove the `#`** at the start of the line `# DATABASE_URL=`, then paste
     your connection string after the `=` sign.
3. Save the file.

The four lines then look like this (with your own values):

```bash
PAYLOAD_SECRET=a-long-random-text-of-at-least-32-characters
FIRST_ADMIN_EMAIL=you@example.com
FIRST_ADMIN_PASSWORD=a-password-you-use-nowhere-else
DATABASE_URL=postgresql://…?sslmode=require
```

## Build the tables, add the example, start the site

Run these three commands, one at a time:

```bash
npm run migrate
npm run seed
npm run dev
```

**`npm run migrate`** builds your database's tables. A first line that starts with `WARN` and says
"No email adapter provided" is fine: this site sends no e-mail. **You should see** at the end:

```text
MIGRATIONS: the database has all … committed migrations.
MIGRATIONS: verified committed migrations
```

**`npm run seed`** creates your local admin account (from `FIRST_ADMIN_EMAIL` and
`FIRST_ADMIN_PASSWORD`) and adds the Campus Cycle example content. **You should see** at the end:

```text
SEED: created …, kept 0
SEED: verified
```

**`npm run dev`** starts the site on your computer. Open <http://localhost:3000> for the site and
<http://localhost:3000/admin> for its editing screen. Log in with your local admin account. To stop
the site, press **Ctrl+C** in the terminal.

Images you upload on your own computer go to the project's `media` folder. Git leaves that folder out,
and your live site never sees it.

**Something else?** A message that starts with `REFUSED:`, `MIGRATIONS: FAILED` or `SEED: FAILED`:
look it up in [the troubleshooting guide](troubleshooting.md#on-your-own-computer).

Your local site starts without a repair clinic, like your live site did. Add one in your local
`/admin` the same way (first-hour guide, steps 14 and 15) when you need one.

## Change the content model

The content model is the collections in `src/collections`. Changing it takes five steps. The order
matters:

1. **Edit the collection.** For example, add a field to `src/collections/Clinics.ts`, at the place its
   comment shows.
2. **Create the migration:** `npm run migrate:create -- <name>`, with a short name for the change, for
   example `npm run migrate:create -- what_to_bring`. Three files change in `src/migrations`: a new
   `<date>_<time>_<name>.ts`, a `.json` file of the same name, and `index.ts`.
3. **Apply it to your own database:** `npm run migrate`.
4. **Regenerate the types:** `npm run generate`. It updates `src/payload-types.ts` and the admin's
   import map (`src/app/(payload)/admin/importMap.js`).
5. **Commit everything:** the collection, the three migration files and the two generated files.

CI checks steps 2 and 4 for you: the `migrations` job fails when a migration is missing, and the
`types-fresh` job when the generated files are out of date.

**Showing a new field on a page.** The clinic page (`src/app/(site)/clinics/[slug]/page.tsx`) has a
line that marks where a list of the clinic's own goes, right under the clinic's summary:

```tsx
{/* W5: show the clinic's "What to bring" list here, the same way this page shows its prices below. */}
```

Keep that line. Your list goes on the line after it. The **Prices** list further down the same file
shows how a list is made.

**Never change a migration that already ran on your live site.** Make a new one instead. If a
migration in your pull request is wrong, delete its files, fix the collection and create it again;
then reset your preview database ([Reset the preview database](#reset-the-preview-database)).

## Give previews their own database

Every pull request gets a **preview**: a copy of your site at its own address, built by Vercel. A
preview needs a database too. Not your live one: a preview is for trying things out. This section
gives previews a database of their own: a **branch** of your live Neon database, a copy that you can
throw away and make again.

**Do this only after your live site's first green deploy.** The preview branch must be a copy of a
live database that has its tables. A branch made earlier is empty, and previews will not change its
tables (see [MIGRATIONS: not running on this preview](troubleshooting.md#preview-not-migrated)).

### Create the preview branch

1. In Vercel, open your project's **Storage** tab, then your Neon database. Its page has a button
   that opens the database in Neon's own console; click it. (Its name can differ, for example
   **Open in Neon**.)
2. In Neon, open **Branches** and click **New branch**.
3. **Name:** `preview`. **Parent branch:** your main branch (the live database). If Neon asks which
   data to copy, keep the current data.
4. Click **Create new branch** (or **Create**).

### Connect it to Vercel's Preview environment

1. In Neon, click **Connect**, and choose the `preview` branch in the dialog.
2. Copy two connection strings: the **pooled** one (the one shown first, with **Connection pooling**
   on), and the one with **Connection pooling** switched off (the direct one).
3. In Vercel, open **Settings** → **Environment Variables**, and add two variables, both for
   **Preview** only:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the `preview` branch's **pooled** connection string |
   | `DATABASE_URL_UNPOOLED` | the `preview` branch's **direct** connection string |

   If the variables Neon added for Production are called `STORAGE_URL` and `STORAGE_URL_UNPOOLED`
   instead, use those two names here.

**You should see:** the next pull request's preview build log shows
`MIGRATIONS: running (a proven copy of production)`. The preview then has its own data: bookings and
edits on the preview never reach your live site.

**Images on previews:** your Blob store is connected to Production only, so previews cannot store
uploaded images ([Images do not upload on a preview](troubleshooting.md#images-do-not-upload-on-a-preview)).
Try image uploads on your own computer instead.

## Reset the preview database

A preview changes the tables of its database only when the database is a **proven copy** of your live
one. It never changes a database it cannot prove is a copy, and a preview whose settings point at your
live database stops with
[STOPPED](troubleshooting.md#preview-live-database).

Sometimes the preview branch gets out of step: after you created a migration again, or when another
pull request changed its tables first. The preview's build log then says
`MIGRATIONS: FAILED ON THE PREVIEW DATABASE (build continues)`. Reset the branch:

1. In Neon, open **Branches**, then `preview`.
2. Choose **Reset from parent** (in the branch's **⋮** menu, or its own button on the branch's
   page), and confirm if Neon asks. The branch becomes a fresh copy of your live database.
3. In Vercel, redeploy the preview.

## No Node on your computer? Use a Codespace

A Codespace is a computer in GitHub's cloud that you use in your browser. It is an alternative when
your laptop cannot install Node. GitHub gives a monthly free allowance; stop the Codespace when you
are done.

1. On GitHub, open your repository, click **Code**, open the **Codespaces** tab and create a Codespace
   on `main`.
2. In its terminal, run `node --version`. A Codespace often has a newer Node, such as `v24.`. Not
   `v22.`? Run `nvm install 22`: it switches the terminal to Node 22 (and installs it first if
   needed). Run `node --version` again to check. A new terminal starts with the newer Node again:
   run `nvm use 22` there too, or once `nvm alias default 22` to make 22 the default.
3. Follow this guide from [Get the code](#get-the-code), skipping `git clone` (the code is already
   there): `npm ci`, `.env.local`, `npm run migrate`, `npm run seed`, `npm run dev`.
4. When the site starts, the Codespace offers to open port 3000 in your browser. Accept.

## Checks you can run yourself

| Command | What it does |
| --- | --- |
| `npm run lint` | Looks for mistakes and unsafe patterns in the code |
| `npm run typecheck` | Checks the TypeScript types |
| `npm test` | Runs the tests. They start their own small database in memory, never yours |
| `npm run check` | The browser checks, against a site that is already running |

CI runs all of them for you on GitHub. `npm run check` needs more set-up:

- It does not read `.env.local`. Set `DATABASE_URL` (or `STORAGE_URL`), `PAYLOAD_SECRET`,
  `FIRST_ADMIN_EMAIL` and `FIRST_ADMIN_PASSWORD` in the terminal you run it from, with the same values
  the site runs with.
- It writes test records, so it only uses a database on your own computer. For a throwaway Neon
  database (never your live one), also set `E2E_ALLOW_REMOTE=1`.
- It expects the site on port 3100. With `npm run dev` (port 3000), set
  `PLAYWRIGHT_BASE_URL=http://localhost:3000`.

The browser checks book time slots on whatever site `PLAYWRIGHT_BASE_URL` points at, so never point
it at a deployed site: only at a site on your own computer. More in `playwright.config.ts`.

## Optional: the members' area

The starter has a members' area that is **off** until you switch it on. You never need it for the
course's steps; it is there if you want it.

**What it adds:** a **Log in** link in the menu (`/account/login`), and a **My bookings** page
(`/account`) where a member who is logged in sees their own bookings. There is no sign-up form:
editors create member accounts in `/admin` (under **Members**, which appears once the area is on).
Use test data only: made-up members and bookings.

**Switch it on, on your own computer:** in `.env.local`, remove the `#` in front of
`# MEMBERS_AREA=on`. Then stop `npm run dev` (**Ctrl+C**) and start it again.

**Switch it on, on Vercel:** open **Settings** → **Environment Variables**, add `MEMBERS_AREA` with
the value `on`, then redeploy.

`/admin` reads this setting when the site starts. So after switching it on or off, always restart
`npm run dev` (or redeploy) before you look in `/admin`.

## A database made with an earlier version of this starter

Did you seed a database with an earlier version of this starter? Then two things can be missing.

- **Site facts are empty** (the pricing rule, the place and the e-mail address are not shown). On your
  own computer, run `npm run seed -- --again` once: it fills in Site facts and adds back missing
  example records, and never overwrites one. On your live site, fill in **Site facts** in `/admin`.
- **The gear workshop still has "ends by 15:00" in its text.** See
  [Updating a site that already has the example content](../../src/tasks/find-workshop/README.md#updating-a-site-that-already-has-the-example-content).

A new copy of the starter has neither problem.
