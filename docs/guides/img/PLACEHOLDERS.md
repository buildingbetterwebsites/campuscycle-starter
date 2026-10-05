# Screenshots still to take

The first-hour guide shows a screenshot for each step. These are not taken yet: each one needs a
real run of the first-hour guide on a free Vercel Hobby account, a free GitHub account and the
published starter. Until then the guide shows the picture's description (its alt text) instead.

When you add one:

- save it in this folder under the name below, as a compressed PNG, about the size of a browser
  window, showing only what the step needs (crop away the rest);
- never show a real secret, password, connection string or token: blur or crop it out;
- remove its row from this list (`tests/unit/guides.test.ts` checks that every row is still
  missing).

| File | Step | What it shows |
| --- | --- | --- |
| `first-hour-01.png` | Step 1: open the starter | The starter's GitHub page, with the green "Use this template" button open and "Create a new repository" in its menu |
| `first-hour-02.png` | Step 2: create your repository | GitHub's "Create a new repository" form, filled in: the owner, the name campuscycle-mina, Public chosen |
| `first-hour-03.png` | Step 3: import your repository | Vercel's "Import Git Repository" list, with the repository campuscycle-mina and its Import button |
| `first-hour-04.png` | Step 4: name the project | Vercel's "Configure Project" screen: the project name campuscycle-mina and the framework preset Next.js |
| `first-hour-05.png` | Step 5: add the three settings | Vercel's "Environment Variables" section with the three rows PAYLOAD_SECRET, FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD filled in, and "Production and Preview" chosen |
| `first-hour-06.png` | Step 6: deploy, and expect it to stop | Vercel's build log of the first deployment, failed, ending with "NOT CONFIGURED YET: there is no database." |
| `first-hour-07.png` | Step 7: create the Neon database | Vercel's Storage tab, "Browse Storage" with Neon and Blob, and Neon's form with the region Frankfurt (eu-central-1) |
| `first-hour-08.png` | Step 8: connect Neon to Production only | The "Connect Project" dialog: only Production ticked, the prefix left as it is, "Create database branch for deployment" unticked |
| `first-hour-09.png` | Step 9: create the Blob store for images | Vercel's form for a new Blob store, with Public chosen instead of the suggested Private |
| `first-hour-10.png` | Step 10: connect Blob to Production, with its token | The Blob "Connect Project" dialog: Production ticked, the prefix left as it is, and "Add a read-write token env var to this connection" ticked |
| `first-hour-11.png` | Step 11: redeploy (never "Promote to Production") | Vercel's Deployments tab: the failed deployment's "…" menu open, with "Redeploy" in it |
| `first-hour-12.png` | Step 11: redeploy (never "Promote to Production") | Vercel's build log of the redeploy, with the lines "MIGRATIONS: verified committed migrations" and "SEED: verified" |
| `first-hour-13.png` | Step 12: open your live site | The live site's home page: the Campus Cycle title, the two buttons "Find a workshop" and "Repair clinic", and the panel "The repair clinic opens soon" |
| `first-hour-14.png` | Step 13: log in to /admin | The /admin log-in form with the fields Email and Password and the Login button |
| `first-hour-15.png` | Step 14: add the clinic | The /admin form "Creating new Clinic", filled in: Saturday repair clinic, saturday-repair-clinic, Saturday, 15:00, 17:00, and a summary with a code |
| `first-hour-16.png` | Step 15: add two time slots | The /admin form "Creating new Time Slot": the clinic Saturday repair clinic, a Saturday at 15:00, and 2 places |
| `first-hour-17.png` | Step 15: add two time slots | The /admin Time Slots list with the column "When (Brussels time)" showing the two slots at 15:00 and 15:30 |
| `first-hour-18.png` | Step 16: see your clinic on the live site | The live clinic page: "About the clinic" with the summary and the code, the Prices list, and "Book a time slot" with two times and "2 places left" each |
| `first-hour-19.png` | Step 17: edit Hero.tsx in GitHub's web editor | GitHub's web editor on src/components/site/Hero.tsx, with the TAGLINE line changed to a new name |
| `first-hour-20.png` | Step 18: commit directly to main | GitHub's "Commit changes" dialog, with "Commit directly to the main branch" chosen |
| `first-hour-21.png` | Step 19: wait for Vercel | The live home page with the tagline "BICYCLE WORKSHOPS ON CAMPUS · A SITE BY MINA PEETERS" above the title |
| `first-hour-22.png` | Step 20: wait for CI to turn green | The commit on GitHub with its green tick, and the list of CI checks: test, types-fresh, migrations and browser-checks passed; ai-note and leftovers skipped |
