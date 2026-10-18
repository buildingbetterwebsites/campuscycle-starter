# Integrations: preview databases, Vercel Web Analytics and a provider's script

Three things that connect your site to another service, each with a step that is easy to miss:

1. [Preview databases](#preview-databases): every pull request's preview gets a Neon branch of its
   own, and Neon's free plan has room for only a few. Set up the clean-up once.
2. [Vercel Web Analytics](#vercel-web-analytics): two switches, one in your code's settings and one
   in Vercel, and a check in your own browser.
3. [A provider's script](#a-providers-script), such as a chat window: the snippet a provider tells
   you to paste does not work in this starter as it is. Here is the way that does.

**Time:** about fifteen minutes for each part.

---

<a id="preview-databases"></a>

## Preview databases: clean up after each pull request

Every pull request gets a preview with a database of its own: Neon makes a branch of your live
database for it, named `preview/<your branch>`
([Give previews their own database](local-setup.md#give-previews-their-own-database)). Vercel deletes
that branch only when the preview's last deployment is deleted, which on the free Hobby plan is about
30 days later. Neon's free plan allows **10 branches** per project, your live database's own branch
included.

So after about nine pull requests there is no room left, and every new preview fails within a second
with **Branch limit reached** ([what you see](troubleshooting.md#branch-limit-reached)).

The starter has a clean-up for this: `.github/workflows/neon-preview-cleanup.yml`. When a pull
request is closed (merged or not), it deletes that pull request's `preview/…` branch in Neon. It
never deletes your main branch. It needs two settings from Neon, which you put in GitHub once. Until
they are there, it skips itself: no red cross.

### Set up the clean-up once

In a team, one person does this; it needs the rights to change the repository's settings.

1. **Open your database in Neon:** in Vercel, open **Storage**, then your Neon database, then
   **Open in Neon**.
2. **Create an API key:** in Neon, open your account settings, then **API keys**, and create a new
   key (name it, for example, `github-preview-cleanup`). Copy it straight away: Neon shows it only
   once. It is a secret: never put it in a file you commit.
3. **Copy the project ID:** in Neon, open your project's **Settings**. Copy the **Project ID**.
4. **Put both in GitHub:** in your repository on GitHub, open **Settings** → **Secrets and
   variables** → **Actions**.
   - On the **Secrets** tab, click **New repository secret**: name `NEON_API_KEY`, value your API key.
   - On the **Variables** tab, click **New repository variable**: name `NEON_PROJECT_ID`, value your
     project ID.

**You should see:** the next time you merge or close a pull request, GitHub's **Actions** tab shows a
run of **Neon preview clean-up** with a green tick. Its log says `Found preview/<your branch>` and
that it deleted it, and Neon's **Branches** page no longer lists that branch. A yellow warning in
the run means nothing was deleted; it says which setting to check. The clean-up acts only
on pull requests closed after you set it up: delete older preview branches by hand (below).

<a id="branch-limit-already-reached"></a>

### "Branch limit reached" already happened?

Then Neon has no room for a new preview's branch. Make room by hand:

1. In Neon, open **Branches**.
2. For each `preview/…` branch whose pull request is merged or closed: click the branch's **⋮** menu,
   then **Delete**. **Never delete your main branch:** that is your live database.
3. In Vercel, redeploy the preview that failed (Deployments → the preview → **…** → **Redeploy**), or
   push a new commit to its branch.

Then set up the clean-up (above), so it does not happen again.

---

<a id="vercel-web-analytics"></a>

## Vercel Web Analytics: two switches, then check

The starter adds Vercel Web Analytics only when you ask for it (`src/lib/analytics.ts`). You need
**both** steps; either one alone records nothing.

1. **Switch it on in the site:** give the production build the setting `NEXT_PUBLIC_ANALYTICS` with
   the value `vercel`. Either in Vercel (**Settings** → **Environment Variables**, for
   **Production**), or in a file `.env.production` that you commit, with the line
   `NEXT_PUBLIC_ANALYTICS=vercel` (it is not a secret). Then deploy again: a `NEXT_PUBLIC_` setting is
   copied into the site when it is built, and the site layout (`src/app/(site)/layout.tsx`) adds
   Vercel's `<Analytics />` only to a site built with it.
2. **Switch it on in Vercel:** in your Vercel project, open the **Analytics** tab, then **Enable**.

**Check it in your own browser:** open your live site, open the developer tools (F12), choose the
**Network** tab, and reload the page.

**You should see:**

- a request for `script.js` from your project's own analytics address, a path such as
  `/925dec3705f9bf8c/script.js` (on older projects `/_vercel/insights/script.js`);
- then a request named `view`: that is the page view being recorded.

No `script.js`? Then step 1 is missing, or the site was not built again after it. A `script.js` but
no `view`? Then check step 2. Vercel ignores automated browsers (a script or a test that drives a
browser), and an ad blocker can stop the requests too: check in your own browser, without one. On
the free Hobby plan only page views are recorded; the site's two events (`filter_used` and
`booking_saved`) need a paid plan.

---

<a id="a-providers-script"></a>

## A provider's script, such as a chat window

Many services, such as the chat window tawk.to, give you a snippet: `<script>…</script>`, to paste
"just before the closing body tag" of your pages. In this starter that does not work: the site's
layout is JSX, not HTML. The braces in the snippet break the JSX, and React does not run the text of
a script tag it renders.

Instead, run the snippet's code with Next.js's `Script` component, in the public pages' layout,
behind a setting that switches it on:

1. **The switch and the code,** in `src/lib/chat.ts`. Copy the code between `<script>` and
   `</script>` from the provider's dashboard, without those two tags:

   ```ts
   // The provider's code, as its dashboard gives it, without <script> and </script>.
   export const CHAT_LOADER = `var Tawk_API=Tawk_API||{}; …`

   // On only when NEXT_PUBLIC_CHAT says so. After changing it, build (or restart npm run dev) again.
   export function chatOn(): boolean {
     return process.env.NEXT_PUBLIC_CHAT === 'tawk'
   }
   ```

   (The code sits between backticks: if it holds a backtick or `${` itself, put a `\` in front of it.)

2. **A small component,** `src/components/site/SiteChat.tsx`. `lazyOnload` runs the code once the
   page has loaded and the browser is idle, so the chat never slows down your user tasks, and the page
   works the same when the provider does not answer:

   ```tsx
   import Script from 'next/script'
   import { CHAT_LOADER } from '@/lib/chat'

   export function SiteChat() {
     return (
       <Script id="site-chat" strategy="lazyOnload">
         {CHAT_LOADER}
       </Script>
     )
   }
   ```

3. **In the layout,** `src/app/(site)/layout.tsx`, after `<Footer />`:
   `{chatOn() && <SiteChat />}` (with the two imports at the top). This is the public pages' frame,
   so every public page gets the chat and `/admin` does not.
4. **Switch it on** for the production build: the setting `NEXT_PUBLIC_CHAT` with the value `tawk`,
   in Vercel or in `.env.production`, as for analytics above. Then deploy again. Without it (with
   `npm run dev`, in the tests) the page loads no script and sends nothing to the provider. CI's
   browser checks build the site too: with the setting in `.env.production`, their browser loads the
   provider's script as well. If they then fail on the provider's widget, set the switch in Vercel
   instead (CI does not read Vercel's settings).
5. **Say it on the privacy page:** in `/admin`, open **Pages**, then **Privacy**, and name the
   service, what reaches it (each user's internet address, browser and page, and every message they
   type) and the cookies it stores. Record the choice in `docs/decisions/integration.md`.

**You should see:** on your live site, the Network tab shows the provider's script loading (for
tawk.to, a request to `embed.tawk.to`), and the chat button appears in a corner of every public page.
`/admin` has no chat. Another provider's snippet works the same way: change the names, the setting's
value and the privacy text.
