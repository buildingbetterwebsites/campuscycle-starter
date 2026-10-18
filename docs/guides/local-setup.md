# Working on your own computer, and previews with their own database

This guide comes after [your first hour](first-hour.md): your live site works, and CI is green. Now
you set up the starter on your own computer, so you can change the content model (the collections)
and try changes before they reach your live site. At the end, you see how each pull request's preview
gets a database of its own.

**Time:** two to three hours, the first time.

**The one rule of this guide:** on your own computer you always work with **your laptop's own**
database. Never with your live site's database. The starter refuses the
live one (see [REFUSED: This is the live database](troubleshooting.md#refused-live-database)).

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

## Your laptop's database

You need a database on your own computer. The starter brings one along: a real Postgres database
that runs inside Node (it is called PGlite). You need no account and nothing else to install, and you
do not start it yourself. It is not the database Vercel made for your live site, and it never holds
real data.

`npm run dev`, `npm run migrate`, `npm run migrate:create` and `npm run seed` start it when it is not
running yet, and stop it again when they stop. When one of them starts it, it says so:

```text
Started your laptop's database (data in .data/db); it stops when this command stops.
```

When `npm run dev` already runs in another terminal, the other commands use its database. That is
how you run `npm run migrate:create` and `npm run migrate` next to your running site. With two
terminals, start `npm run dev` first: the command that started the database also stops it.

Your data is kept in the folder `.data/db` in the project (Git leaves that folder out), so it is all
still there the next time. To start afresh with an empty database: stop `npm run dev`, delete the
folder `.data/db`, then run `npm run migrate` and `npm run seed` again.

Every copy of the starter on your computer (your own site, and later your team's project) uses the
same address for its database, so only one copy's database can run at a time. A command never uses
another copy's database: it stops with `NOT YOURS:` instead. Stop the other copy's `npm run dev` (or
`npm run db`) in its terminal with **Ctrl+C**, then run your command again.

**Optional: `npm run db`** starts the database on its own, in its own terminal, and keeps it running
until you press **Ctrl+C** there. You never need it; it can help when you stop and start
`npm run dev` often.

## Fill in .env.local

Your settings for your own computer go in a file called `.env.local`. It is never committed: the
project's `.gitignore` leaves it out.

1. Make the file: copy `.env.example` to `.env.local`. In VS Code's terminal (on Windows, macOS and
   Linux alike):

   ```bash
   cp .env.example .env.local
   ```

   (In the old Windows Command Prompt, type `copy` instead of `cp`.)

2. Make a secret: a random text of 64 letters and digits, for `PAYLOAD_SECRET`. Run:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   **You should see:** one line of 64 letters and digits. Select it and copy it. (Any random text of
   at least 32 characters works; it may differ from your live site's.)
3. Open `.env.local` in VS Code and fill in the four active lines, so that they look like this, with
   your secret and a password of your own:

   ```bash
   PAYLOAD_SECRET=paste-the-64-letters-and-digits-here
   FIRST_ADMIN_EMAIL=laptop-admin@example.com
   FIRST_ADMIN_PASSWORD=a-password-you-use-nowhere-else
   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/postgres
   ```

   - `PAYLOAD_SECRET=`: paste the line from step 2 right after the `=`, with no space.
   - `FIRST_ADMIN_EMAIL=` and `FIRST_ADMIN_PASSWORD=`: the admin account for `/admin` on your own
     computer. `laptop-admin@example.com` is fine: no e-mail is ever sent to it. Both may differ from
     your live site's.
   - `DATABASE_URL=`: only **remove the `#`** at the start of the line
     `# DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/postgres`. The address is already
     filled in: it is your laptop's database. Never paste your live site's database address here.
4. Save the file (**Ctrl+S**, on a Mac **Cmd+S**).

Leave every other line as it is: the lines that start with `#` are switched off, and that is what you
want for now.

## Build the tables, add the example, start the site

In the terminal, run these three commands, one at a time:

```bash
npm run migrate
npm run seed
npm run dev
```

**`npm run migrate`** builds your database's tables. It first starts your laptop's database (the
line `Started your laptop's database …`). A line that starts with `WARN` and says "No email adapter
provided" is fine: this site sends no e-mail. **You should see** at the end:

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

**Something else?** A message that starts with `NOT YOURS:`, `NOT RUNNING:`, `REFUSED:`,
`MIGRATIONS: FAILED` or `SEED: FAILED`: look it up in
[the troubleshooting guide](troubleshooting.md#on-your-own-computer).

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

Worked examples, to copy: [the recipes](recipes.md) (a new field, a new collection, a many-to-many,
and making a migration again when `main` moved first).

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
preview needs a database too. Not your live one: a preview is for trying things out.

**Neon makes it for you.** In your first hour you connected Neon to **Production** and **Preview**,
with **Create database branch for deployment: Preview** ticked
([Step 8](first-hour.md#step-8-connect-neon-to-production-and-preview)). So for every preview, Neon
makes a **branch** of your live database: a copy, named `preview/<your branch>` (after your Git
branch). Vercel gives that preview the branch's address as its own `DATABASE_URL`. You make no
branch and paste no address yourself.

**You should see:**

- In the preview's build log: `MIGRATIONS: running (a proven copy of production)`. Your pull
  request's migrations run on the copy, never on your live database.
- In Neon (Vercel: **Storage** → your Neon database → the button that opens it in Neon, for example
  **Open in Neon**), under **Branches**: a branch `preview/<your branch>` next to your main branch.

Bookings and edits on the preview stay in its branch: they never reach your live site. Later builds
of the same Git branch keep using the same Neon branch.

**Redeploy a preview:** push a new commit to its branch, or in Vercel open **Deployments**, find the
preview (its environment says **Preview**), click its **…** menu, then **Redeploy**.

**Images on previews:** your Blob store is connected to Production only, so previews show no images
and cannot store uploaded ones
([Images do not upload on a preview](troubleshooting.md#images-do-not-upload-on-a-preview)). That is
expected. Try image uploads on your own computer instead.

### Neon connected to Production only?

Then a preview has no database, and its build stops with
[NOT CONFIGURED YET: this preview has no database of its own](troubleshooting.md#preview-no-database).
Connect Neon to Preview too:

1. In Vercel, open **Storage**, then your Neon database, then its **Projects** tab.
2. On your project's row, click the **…** menu, then **Update Project Connection**.
3. Tick **Preview**, and under **Create database branch for deployment** tick **Preview**. Save.
4. Did you once make a `preview` branch in Neon by hand, and add `DATABASE_URL` and
   `DATABASE_URL_UNPOOLED` (or `STORAGE_URL` and `STORAGE_URL_UNPOOLED`) for **Preview** yourself? In
   **Settings** → **Environment Variables**, delete those two. In Neon you can delete that old
   `preview` branch too.
5. Redeploy the preview.

### Old preview branches

Neon's free plan allows only a limited number of branches. When a pull request is merged, its
`preview/…` branch is no longer needed: in Neon, open **Branches**, click the branch's **⋮** menu,
then **Delete**. Never delete your main branch: that is your live database. The starter can do this
for you each time a pull request is closed: set it up once with the
[integrations guide](integrations.md#preview-databases).

## Reset the preview database

A preview changes the tables of its database only when the database is a **proven copy** of your live
one. It never changes a database it cannot prove is a copy, and a preview whose settings point at your
live database stops with
[STOPPED](troubleshooting.md#preview-live-database).

Sometimes a preview's branch gets out of step: after you created a migration again, or after you
merged `main` into your branch. The preview's build log then says
`MIGRATIONS: FAILED ON THE PREVIEW DATABASE (build continues)`. Reset that preview's branch:

1. In Neon, open **Branches**, then `preview/<your branch>` (the branch with your pull request's
   Git branch in its name).
2. Choose **Reset from parent** (in the branch's **⋮** menu, or its own button on the branch's
   page), and confirm if Neon asks. The branch becomes a fresh copy of your live database.
3. In Vercel, redeploy the preview (Deployments → the preview → **…** → **Redeploy**).

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
- It writes test records, so it only uses a database on your own computer, such as your laptop's
  database. For a throwaway Neon database (never your live one), also set
  `E2E_ALLOW_REMOTE=1`.
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
