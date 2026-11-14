# Hand-over

Everything the next owner of this site needs. Fill in every place marked TODO. The boxes marked Tip
are guidance: the course's checks do not read them, and you may delete them when you are done. Never
write a password, a secret or a connection string in this file.

In a team, write under the title who wrote this document, by first name or GitHub username.

## Who owns what

> [!TIP]
> **Guidance.** Start with where everything is: the address of the live site, of the repository and of
> the admin screen. Then fill in the first table: for each service, the name of the account that owns
> it. Secrets stay in Vercel's settings and in `.env.local` on your own computer; this file says who
> holds them.
>
> **Example:** GitHub: the account `millbrook-events`, which belongs to one team member. Gap: the
> repository must be transferred to the library before that member leaves.

- TODO: the address of the live site, of the repository and of the admin screen.

| Service | What it holds | Owner (account name, not the password) |
| --- | --- | --- |
| GitHub | the code | TODO: |
| Vercel | the live site and its settings | TODO: |
| Neon | the database (connected through Vercel) | TODO: |
| Vercel Blob | the images | TODO: |

> [!TIP]
> **Guidance.** The second table has one row for each of the six responsibilities. Keep the six names
> in the first column as they are. In each row, write:
> - the owner as a role, for example "the library's events coordinator". When nobody owns it yet,
>   write "No role yet" and name the gap;
> - who can log in to do it;
> - when it was last tested, as a date, or "never".
>
> Keep what is done apart from what is tested. "A copy of the database exists" is done. "The copy was
> restored on test data on 3 May 2026" is tested.
>
> **Example of the row Content:** owner: the events coordinator. Who can log in: the coordinator and
> one librarian, as editors in `/admin`. Last tested: 12 May 2026, when the coordinator added an event
> without help.

| Responsibility | Owner (a role) | Who can log in | Last tested |
| --- | --- | --- | --- |
| Content | TODO: | TODO: | TODO: |
| Access | TODO: | TODO: | TODO: |
| Updates | TODO: | TODO: | TODO: |
| Monitoring | TODO: | TODO: | TODO: |
| Backup and restore | TODO: | TODO: | TODO: |
| Ownership | TODO: | TODO: | TODO: |

> [!TIP]
> **Guidance.** Say in two or three lines who edits which content in `/admin`, how a new editor gets
> an account, and which changes need a developer.
>
> **Example:** The events coordinator and one librarian add and change events and speakers in
> `/admin`. The coordinator makes the account of a new editor. A new field or a new page needs a
> developer.

- TODO: who edits which content in `/admin`, how they get an account, and what needs a developer.

## Left out, and in which order

> [!TIP]
> **Guidance.** Write a numbered list of everything that is not built: your ideas, the findings in
> `docs/test-report.md` that are still open, and the requirements that still say "not yet" in
> `docs/requirements.md`. Put first what users and the organisation lose most without, and give each
> item one line of reason. Under the list, say what does not work yet, was never tested or could
> break, and what to do about it.
>
> **Example:** 1. A waiting list for full events: today a user who meets a full event cannot hear that
> a seat came free. Not tested: nobody has tried the reservation form with a screen reader on a phone.
> Test it before the library announces the site.

1. TODO: the first thing to build next, and what users lose without it.
2. TODO: the next one.

TODO: what does not work yet, or could break, and what to do about it.

## How you will know it works

> [!TIP]
> **Guidance.** Write two or three measures, one list item each. Each measure says what is counted,
> where it is read, and the number that would make the owner act. Write that number in figures.
>
> **Example:** Seats reserved per event, read in `/admin` every week. With 0 reservations 3 days
> before an event, do the reservation task yourself on the live site.

- TODO: each measure, where it is read, and the number that means "act".

How to run, change and deploy the site safely:

> [!TIP]
> **Guidance.** The lines below already hold the starter's own rules: keep them. In the two marked
> places, add what your project does differently, and your own steps:
> - how a change to the code goes live: a branch, a pull request with its preview and its AI note,
>   the starter's checks, and who merges it into `main`;
> - how to go back to the version before: on GitHub, **Revert** on the merged pull request opens a new
>   pull request that undoes it. Merge that one like any other change, so that its build runs.
>   Vercel's **Instant Rollback** runs no build, so use **Revert**. A revert leaves the database as
>   it is: a migration that has already run stays.
>
> **Example:** The author of a pull request merges it when the starter's checks have finished and the
> preview shows the change. To go back, we use **Revert** on the merged pull request and merge the
> new pull request.

- On your own computer: `docs/guides/local-setup.md`.
- TODO: anything your project does differently, or write "Nothing different".
- A change reaches the live site through `main`. Never use Vercel's "Promote to Production": use
  Redeploy, and check that the build log shows `MIGRATIONS: verified committed migrations`.
- TODO: your own steps: pull requests, previews, who merges, the checks that must pass, and how you
  go back to the version before.
