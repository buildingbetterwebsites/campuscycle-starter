# Your first hour: your own copy of the starter website, live

At the end of this guide you have **your copy of the starter website**, live on the internet:

- your own repository on GitHub, made from the Campus Cycle starter;
- a live site at `https://campuscycle-<your name>.vercel.app`, with its editing screen at `/admin`;
- a Saturday repair clinic you added yourself, with two time slots;
- your own name on the home page, changed in GitHub's web editor;
- a green CI check on that change.

**Time:** under two hours. **Tools:** only a web browser. **Cost:** nothing: every account here is
free.

**Accounts:** you need a GitHub account and a Vercel account. If you have no Vercel account yet,
sign up at vercel.com with **Continue with GitHub** and choose the free **Hobby** plan. The database
(Neon) and the image storage (Blob) are created from inside Vercel in Part C; you do not sign up for
them separately. Both are available on the free Hobby plan.

**About the screens:** Vercel and GitHub change their screens now and then. If a button has a
slightly different name, look for the closest one. The Vercel steps were tried on a paid Vercel
account and checked against Vercel's documentation for the free Hobby plan. Where a screen may differ,
the step says so. The screenshots are not taken yet: until they are, you see a short description of
each one in their place.

**Before you start, choose `<your name>`:** your first name, or first name and last name, in small
letters, with hyphens instead of spaces. For example `mina` or `mina-peeters`. You use it twice:
for the repository and for the Vercel project, `campuscycle-<your name>`, for example
`campuscycle-mina`.

---

## Part A: your own repository on GitHub

### Step 1: open the starter

Open the starter's page on GitHub: <https://github.com/buildingbetterwebsites/campuscycle-starter>.
Click the green **Use this template** button, then **Create a new repository**.

![The starter's GitHub page, with the green "Use this template" button open and "Create a new repository" in its menu](img/first-hour-01.png)

**You should see:** a page titled "Create a new repository", with the starter named as its template.

**Something else?** No **Use this template** button? Check that you are logged in to GitHub. Do not
use **Fork**: your copy must be made from the template.

### Step 2: create your repository

1. **Owner:** your own GitHub account.
2. **Repository name:** `campuscycle-<your name>`, for example `campuscycle-mina`.
3. Choose **Public**.
4. Leave **Include all branches** off.
5. Click **Create repository** (on some screens **Create repository from template**).

![GitHub's "Create a new repository" form, filled in: the owner, the name campuscycle-mina, Public chosen](img/first-hour-02.png)

**You should see:** your new repository, with this starter's files and its README.

**Something else?** "Name already exists": you made one before. Use that one, or add a digit to the
name.

---

## Part B: put it on Vercel

### Step 3: import your repository

1. Go to vercel.com and log in.
2. Click **Add New…**, then **Project** (on some screens a **New Project** button).
3. Under **Import Git Repository**, find `campuscycle-<your name>` and click **Import**.

![Vercel's "Import Git Repository" list, with the repository campuscycle-mina and its Import button](img/first-hour-03.png)

**You should see:** a page to configure the new project (titled **New Project** or **Configure
Project**), with the project's name, its framework preset and its environment variables.

**Something else?** Your repository is not in the list? Click the link to adjust the GitHub
permissions (Vercel asks GitHub for access to your repositories), give Vercel access to this
repository, and come back.

### Step 4: name the project

1. **Project Name:** `campuscycle-<your name>`, exactly as your repository. The course's check reads
   this name.
2. **Framework Preset** (on some screens **Application Preset**): Vercel finds **Next.js** by
   itself. Leave it.
3. Leave the root directory and the build settings as they are.

![Vercel's "Configure Project" screen: the project name campuscycle-mina and the framework preset Next.js](img/first-hour-04.png)

### Step 5: add the three settings

Open **Environment Variables**. This starter needs three settings: `PAYLOAD_SECRET`,
`FIRST_ADMIN_EMAIL` and `FIRST_ADMIN_PASSWORD`. Vercel may already show a row for each of them, with
an empty value: it can read their names from the starter's `.env.example` file. Fill in each value:

| Name | What to type |
| --- | --- |
| `PAYLOAD_SECRET` | A random text of **at least 32 characters** that you make up, for example from a password manager's generator, or type a long random line of letters and digits, at least 32. It signs log-ins; nobody ever types it. |
| `FIRST_ADMIN_EMAIL` | The e-mail address you will log in to `/admin` with. The site sends no e-mail to it. |
| `FIRST_ADMIN_PASSWORD` | A new password that you use nowhere else. Write it down in your password manager. |

If Vercel lets you choose where a setting applies, choose **Production and Preview**.

![Vercel's "Environment Variables" section with the three rows PAYLOAD_SECRET, FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD filled in, and "Production and Preview" chosen](img/first-hour-05.png)

**Something else?**

- No rows? Type the name under **Key** and the value under **Value**. Click **Add More** (or
  **Add**) for the next row, and repeat for the other two.
- More rows than these three, with empty values: delete the empty extra rows.
- Never add a `DATABASE_URL` here yourself: connecting the database adds it for you (Part C).

These three are secret. They live only in Vercel (and later in your own `.env.local`), never in a
file you commit.

### Step 6: deploy, and expect it to stop

Click **Deploy**.

**This first build stops with an error. That is expected.** Your project has no database yet. The
build log ends with this message:

> NOT CONFIGURED YET: there is no database. In Vercel: Storage → connect Neon (Postgres) to this project, then Redeploy.

![Vercel's build log of the first deployment, failed, ending with "NOT CONFIGURED YET: there is no database."](img/first-hour-06.png)

Go to your project's page in Vercel: open your Vercel dashboard (click the Vercel logo at the top
left) and click your project's name. Some screens also offer a **Continue to Dashboard** button.

---

## Part C: connect the database and the image storage

Your site needs two things Vercel can make for you: a **Neon** database (Postgres) for the content and
the bookings, and a **Blob** store for the images. Both are free.

**Frankfurt, for both.** Your database will be in Frankfurt. The starter's `vercel.json` file already
asks Vercel to run your site's server code in Frankfurt too (`"regions": ["fra1"]`), so the two are
close together and pages load fast. You do not need to change anything for that. On the free Hobby
plan, a project's server code runs in one region (Washington, D.C., unless you choose another); this
file chooses Frankfurt. Also choose Frankfurt for the database: you cannot move it later.

### Step 7: create the Neon database

1. In your project, open the **Storage** tab.
2. Click **Create Storage**. (Older screens say **Create Database**.)
3. **Browse Storage** shows Neon and Blob. Choose **Neon**, then continue.
4. Accept the free plan. If Vercel asks to create a Neon account for you, accept: Vercel makes it,
   and you do not need to sign up at Neon yourself.
5. **Region:** choose **Frankfurt (eu-central-1)**. (Some screens say **AWS Europe Central 1
   (Frankfurt)**.)
6. Create the database.

![Vercel's Storage tab, "Browse Storage" with Neon and Blob, and Neon's form with the region Frankfurt (eu-central-1)](img/first-hour-07.png)

### Step 8: connect Neon to Production only

Vercel now asks how to connect the database to your project.

1. **Environments:** tick **Production** only. **Untick Preview and Development.** Your live site gets
   this database; previews get a database of their own later, in the
   [local set-up guide](local-setup.md#give-previews-their-own-database).
2. **Custom prefix:** leave it as it is. (Whether it says `DATABASE` or `STORAGE`: the starter
   accepts both.)
3. **Create database branch for deployment** (an option to give each deployment, for example each
   preview, a database branch of its own; on some screens it is under **Advanced Options**): leave
   it **off**.
4. Click **Connect**.

![The "Connect Project" dialog: only Production ticked, the prefix left as it is, "Create database branch for deployment" unticked](img/first-hour-08.png)

**You should see:** the Neon database listed in your project's **Storage** tab.

### Step 9: create the Blob store for images

1. In **Storage**, click **Create Storage** again, and choose **Blob**.
2. Give it a name, for example `campuscycle-images`.
3. **Choose Public.** If Vercel suggests **Private**, change it: your site shows these images to
   everyone, so they must be **Public**. You cannot change this after the store is made.
4. Create the store.

![Vercel's form for a new Blob store, with Public chosen instead of the suggested Private](img/first-hour-09.png)

### Step 10: connect Blob to Production, with its token

1. **Environments:** tick **Production** only. If **Preview** or **Development** is ticked, untick
   it: previews must not store images in your live site's store.
2. **Prefix:** leave it as it is.
3. **The token:** if the dialog has a box **"Add a read-write token env var to this connection"**,
   tick it. Without that setting (`BLOB_READ_WRITE_TOKEN`), your site cannot store images.
4. Click **Connect**.
5. Check: open **Settings** → **Environment Variables**. The list now has `BLOB_READ_WRITE_TOKEN`
   for Production. (You also see the database's settings there, such as `DATABASE_URL`. Never copy
   any of their values.)

![The Blob "Connect Project" dialog: Production ticked, the prefix left as it is, and "Add a read-write token env var to this connection" ticked](img/first-hour-10.png)

**Something else?** If you forget step 10.3, the next build stops with "Images cannot be stored". See
[the troubleshooting guide](troubleshooting.md#no-blob-store).

### Step 11: redeploy (never "Promote to Production")

1. Open the **Deployments** tab.
2. On your failed deployment, click the **…** menu, then **Redeploy**, and confirm with **Redeploy**.

**Never use "Promote to Production"** for this starter, now or later. Use **Redeploy**: it runs the
build whose log you check below.

![Vercel's Deployments tab: the failed deployment's "…" menu open, with "Redeploy" in it](img/first-hour-11.png)

Wait until the deployment says **Ready**. That takes a few minutes. Then open its build log (click the deployment, then **Build Logs**). It
shows
lines like these (some start with the time; the numbers and names differ):

```text
MIGRATIONS: running (the production database)
[15:04:05] INFO: Migrating: 20260928_082604_initial
[15:04:05] INFO: Migrated:  20260928_082604_initial (129ms)
…
MIGRATIONS: the database has all … committed migrations.
MIGRATIONS: verified committed migrations
[15:04:09] INFO: First admin created: you@example.com
SEED: created …, kept 0
SEED: verified
```

What they mean:

- **Migrations** build the database's tables. `MIGRATIONS: verified committed migrations` proves
  your live database has every one of them.
- **First admin created:** your admin account, from `FIRST_ADMIN_EMAIL` and `FIRST_ADMIN_PASSWORD`.
- **The seed** adds the Campus Cycle example content: the workshops, topics, prices, pages and photos.
  It adds them once. Later builds print `SEED: skipped (the example content was added before; your editors' changes are kept)`.

![Vercel's build log of the redeploy, with the lines "MIGRATIONS: verified committed migrations" and "SEED: verified"](img/first-hour-12.png)

**Something else?** The build stopped with a message in capitals (`NOT CONFIGURED YET`,
`DATABASE SET UP WRONG`, `MIGRATIONS: FAILED`, `SEED: FAILED`). Look it up in
[the troubleshooting guide](troubleshooting.md). A `NOT CONFIGURED YET` message about `PAYLOAD_SECRET`
means your secret is shorter than 32 characters: see
[its entry](troubleshooting.md#not-configured-yet-payload_secret-is-missing-or-shorter-than-32-characters).

### Step 12: open your live site

1. In your project, find its **Domains**: `campuscycle-<your name>.vercel.app`.
2. Open `https://campuscycle-<your name>.vercel.app`.

Always use this address. Vercel also shows longer addresses for each deployment (with a code and
your account's name in them); those may ask other people to log in to Vercel.

![The live site's home page: the Campus Cycle title, the two buttons "Find a workshop" and "Repair clinic", and the panel "The repair clinic opens soon"](img/first-hour-13.png)

**You should see:** the Campus Cycle home page, with workshops and a panel that says
**The repair clinic opens soon**.

**Something else?** Vercel gave your project a slightly different address (for example with extra
letters, because the name was taken)? Use the address Vercel shows under **Domains**. Your project's
name stays `campuscycle-<your name>`.

---

## Part D: add the repair clinic in /admin

### Step 13: log in to /admin

1. Open `https://campuscycle-<your name>.vercel.app/admin`.
2. Type your `FIRST_ADMIN_EMAIL` under **Email** and your `FIRST_ADMIN_PASSWORD` under **Password**.
3. Click **Login**.

![The /admin log-in form with the fields Email and Password and the Login button](img/first-hour-14.png)

**You should see:** the dashboard, with **Collections** (Users, Media, Pages, Topics, Workshops,
Clinics, Time Slots, Bookings, Repairs) and **Globals** (Site facts).

**Something else?**

- A form that asks you to create the first user: stop, and do not fill it in. Your build did not
  create your admin account. Read the build log of step 11 and look up its message in
  [the troubleshooting guide](troubleshooting.md#no-admin-user).
- The password is refused: check `FIRST_ADMIN_PASSWORD` in Vercel (Settings → Environment Variables).
  The account is made only once, on the first good build: changing the setting afterwards does not
  change the password.

**One source per fact.** Under **Globals**, **Site facts** holds the pricing rule, the place and the
e-mail address. You change each of them there, once, and the home page, the workshop pages, the
clinic page and the Contact page all show the new text. Leave them as they are for now.

### Step 14: add the clinic

1. Under **Collections**, click **Clinics**, then **Create New**.
2. Fill in:

   | Field | What to type |
   | --- | --- |
   | **Name** | `Saturday repair clinic` |
   | **Slug** | `saturday-repair-clinic` (the last part of the clinic's web address) |
   | **Day** | **Saturday** |
   | **Start Time** | `15:00` |
   | **End Time** | `17:00` |
   | **Summary** | One sentence about the clinic, with **your personal code** in it. For example: `Saturday repair clinic. Code BW-7F3K.` (but with your own code). |

3. Click **Save**.

If your course gave you a personal code, type it exactly as you got it: the course's check looks for
it in this summary. Learning on your own, without a code? Write the summary without one.

![The /admin form "Creating new Clinic", filled in: Saturday repair clinic, saturday-repair-clinic, Saturday, 15:00, 17:00, and a summary with a code](img/first-hour-15.png)

**You should see:** the clinic's name as the page's title. The clinic exists.

**Something else?** A red message under **Slug**: use only small letters, digits and hyphens.

### Step 15: add two time slots

1. Under **Collections**, click **Time Slots**, then **Create New**.
2. **Clinic:** choose **Saturday repair clinic**.
3. **Starts At:** open the date picker and choose the **next Saturday**, at **15:00**.
4. **Places:** leave **2**.
5. Click **Save**.
6. Make a second one the same way: the same Saturday, at **15:30**.

![The /admin form "Creating new Time Slot": the clinic Saturday repair clinic, a Saturday at 15:00, and 2 places](img/first-hour-16.png)

**Check the times.** Go back to the **Time Slots** list. Its column **When (Brussels time)** shows each
slot in Brussels time, the time your site shows. The date picker uses your own computer's time zone,
so if your computer is set to another time zone, the picker's time and the column's time differ.
Change **Starts At** until the column says 15:00 and 15:30.

![The /admin Time Slots list with the column "When (Brussels time)" showing the two slots at 15:00 and 15:30](img/first-hour-17.png)

Later, when you open a booking in `/admin`, its time slot list shows times only, not the clinic's name.
With one clinic, that is enough.

### Step 16: see your clinic on the live site

1. Open your live site's home page and reload it.
2. The clinic panel now shows **Saturday repair clinic** with your summary and a **Book a time slot**
   button. Click it.

![The live clinic page: "About the clinic" with the summary and the code, the Prices list, and "Book a time slot" with two times and "2 places left" each](img/first-hour-18.png)

**You should see:** the clinic's page at `/clinics/saturday-repair-clinic`: your summary (with your
code) under **About the clinic**, the **Prices**, and **Book a time slot** with your two times, each
with **2 places left**.

**Something else?** No times under **Book a time slot**, only "There are no upcoming time slots yet":
the site only offers times that have not started yet. Check the slots' dates in `/admin`.

You may try a booking. Use made-up details only: this is a practice project, and the site says so.

---

## Part E: change one component on GitHub

### Step 17: edit Hero.tsx in GitHub's web editor

1. On GitHub, open your repository, then the file `src/components/site/Hero.tsx`.
2. Click the pencil icon (**Edit this file**; on some screens **Edit file**).
3. Find these two lines:

   ```tsx
   // W4: put your own name in this tagline
   const TAGLINE = 'Bicycle workshops on campus · a site by the Campus Cycle team'
   ```

4. Change only the text between the two `'` marks, so it holds your own name. For example:

   ```tsx
   const TAGLINE = 'Bicycle workshops on campus · a site by Mina Peeters'
   ```

5. Keep the line above it, and keep both `'` marks. If your name has a `'` in it, type `\'` instead
   (a backslash, then the quote mark): `O\'Brien`.

![GitHub's web editor on src/components/site/Hero.tsx, with the TAGLINE line changed to a new name](img/first-hour-19.png)

### Step 18: commit directly to main

1. Click **Commit changes…**.
2. Write a short message, for example `Put my name in the tagline`.
3. Choose **Commit directly to the `main` branch**.
4. Click **Commit changes**.

![GitHub's "Commit changes" dialog, with "Commit directly to the main branch" chosen](img/first-hour-20.png)

**Something else?** You chose **Create a new branch for this commit and start a pull request** by
mistake? Then Vercel builds a preview, which stops with "NOT CONFIGURED YET: this preview has no
database of its own". That is expected. [The troubleshooting guide](troubleshooting.md#preview-no-database)
says how to finish.

### Step 19: wait for Vercel

Committing to `main` starts a new deployment of your live site. In Vercel, open **Deployments**: the
newest one is **Building**, then **Ready**, after a few minutes.

**You should see:** your live home page, reloaded, shows your name in the line above the title (in
capital letters: the site's style shows that line in capitals).

![The live home page with the tagline "BICYCLE WORKSHOPS ON CAMPUS · A SITE BY MINA PEETERS" above the title](img/first-hour-21.png)

### Step 20: wait for CI to turn green

CI ("continuous integration") checks every change automatically on GitHub.

1. On GitHub, open your repository's main page.
2. Next to your latest commit, you see a small sign: a yellow dot while CI runs, a green tick when
   every check passed, a red cross when one failed.
3. Click the sign to see each check. Or open the **Actions** tab, then the **CI** run of your commit.

![The commit on GitHub with its green tick, and the list of CI checks: test, types-fresh, migrations and browser-checks passed; ai-note and leftovers skipped](img/first-hour-22.png)

Wait until the tick is green. That takes several minutes: one check builds your whole site and tries
it in a browser.

**Something else?** A red cross: click it, then **Details** next to the failed check, and read its
log. Then look it up in [the troubleshooting guide](troubleshooting.md#ci-on-github).

### What CI checks

The CI workflow is called **CI** (the file `.github/workflows/ci.yml`). It has six jobs:

| Job | What it checks |
| --- | --- |
| `test` | lint, types and the tests |
| `types-fresh` | the generated files (`payload-types.ts`, the admin's import map) are up to date |
| `migrations` | the migrations apply, no migration is missing, removals are explained |
| `browser-checks` | the built site in a real browser at 390 and 1100 px wide, with an accessibility check |
| `ai-note` | the pull request's AI note is filled in (pull requests only) |
| `leftovers` | the Campus Cycle example is replaced (off until you switch it on) |

A pull request that changes only documents (files in `docs/`, or Markdown files) skips the
`browser-checks` job: those files cannot change the site.

On a push to `main`, as in step 18, `ai-note` and `leftovers` are skipped: GitHub shows them as
skipped, and the commit still gets its green tick.

The `ai-note` job reads the part of a pull request's description under this heading, from the
pull request template:

```markdown
## AI note: what I asked AI, and what I checked
```

Write there what you asked an AI tool and how you checked its answer, or "No AI used.".

**Why editing a description runs every check again:** CI also runs when you edit a pull request's
description or title. So a fixed AI note turns green without a new commit, and each commit always
keeps a full result for every check.

---

## Part F: what you have now

- **Your live site:** `https://campuscycle-<your name>.vercel.app`
- **Your repository:** `https://github.com/<your GitHub name>/campuscycle-<your name>`

If your course asks you to hand this in, these two addresses are what it needs. Learning on your own?
The course app's **Check my work** looks at your live site.

**Rules that keep your site safe** (they also hold for everything after this hour):

- Use test data only: made-up names and e-mail addresses, never real personal data.
- Never use Vercel's **Promote to Production**: use **Redeploy**.
- Your secrets (`PAYLOAD_SECRET`, the admin password, database addresses) live only in Vercel and, on
  your own computer, in `.env.local`. Never in a file you commit.
- Never copy your live database's address to your own computer. `npm run dev`, `npm run migrate` and
  `npm run seed` refuse it, but `npm run build` and `npm start` do not.

**Next:** working on your own computer, and giving previews their own database:
[the local set-up guide](local-setup.md).
