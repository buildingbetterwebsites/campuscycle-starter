# Hand-over

Everything the next owner of this site needs. Fill in every place marked TODO. The grey boxes are
guidance: the course's checks do not read them, and you may delete them when you are done. Never
write a password, a secret or a connection string in this file.

In a team, write under the title who wrote this document, by first name or GitHub username.

## Who owns what

<table width="100%"><tr></tr><tr><td>

**Guidance.** Start with where everything is. Then fill in the first table: for each service, the
name of the account that owns it. Secrets stay in Vercel's settings and in `.env.local` on your own
computer; this file says who holds them.

**Example:** GitHub: the account `millbrook-events`, which belongs to one team member. Gap: the
repository must be transferred to the library before that member leaves.

</td></tr></table>

- **Live site:** TODO: its address
- **Repository:** TODO: its address
- **Admin screen:** TODO: its address

| Service | What it holds | Owner (account name, not the password) |
| --- | --- | --- |
| GitHub | the code | TODO: |
| Vercel | the live site and its settings | TODO: |
| Neon | the database (connected through Vercel) | TODO: |
| Vercel Blob | the images | TODO: |

<table width="100%"><tr></tr><tr><td>

**Guidance.** The second table has one row for each of the six responsibilities. Keep the six names
in the first column as they are:
- **Content:** the pages and the records stay right.
- **Access:** someone decides who gets an account, and removes an account that is no longer needed.
- **Updates:** someone applies security fixes to the software the site is built from.
- **Monitoring:** someone notices when the site or a form stops working.
- **Backup and restore:** a copy of the database exists, and someone has tried to put it back.
- **Ownership:** the accounts that hold the code, the live site and the database belong to the
  organisation.

In each row, write the owner as a role, who can log in to do it, and the date it was last tested, or
"never". When nobody owns it yet, write "No role yet" and name the gap. "A copy of the database
exists" is done. "The copy was restored on test data on 3 May 2026" is tested.

**Example of the row Content:** owner: the events coordinator. Who can log in: the coordinator and
one librarian, as editors in `/admin`. Last tested: 12 May 2026, when the coordinator added an event
without help.

</td></tr></table>

| Responsibility | Owner (a role) | Who can log in | Last tested |
| --- | --- | --- | --- |
| Content | TODO: | TODO: | TODO: |
| Access | TODO: | TODO: | TODO: |
| Updates | TODO: | TODO: | TODO: |
| Monitoring | TODO: | TODO: | TODO: |
| Backup and restore | TODO: | TODO: | TODO: |
| Ownership | TODO: | TODO: | TODO: |

<table width="100%"><tr></tr><tr><td>

**Guidance.** One line for each of the three points below is enough.

**Example:** The events coordinator and one librarian add and change events and speakers in
`/admin`. The coordinator makes the account of a new editor. A new field or a new page needs a
developer.

</td></tr></table>

- **Who edits which content in `/admin`:** TODO:
- **How a new editor gets an account:** TODO:
- **What needs a developer:** TODO:

## Left out, and in which order

<table width="100%"><tr></tr><tr><td>

**Guidance.** Write a numbered list of everything that is not built: your ideas, the findings in
`docs/test-report.md` that are still open, and the requirements that still say "not yet" in
`docs/requirements.md`. Put first what users and the organisation lose most without, and add a line
for each item. Under the list, say what does not work yet, was never tested or could break, and what
to do about it.

**Example:** 1. A waiting list for full events: today a user who meets a full event cannot hear that
a seat came free. Not tested: nobody has tried the reservation form with a screen reader on a phone.
Test it before the library announces the site.

</td></tr></table>

1. TODO: the first thing to build next, and what users lose without it
2. TODO: the next one, and what users lose without it

- **What does not work yet, or could break:** TODO:
- **What to do about it:** TODO:

## How you will know it works

<table width="100%"><tr></tr><tr><td>

**Guidance.** Write two or three measures, one list item each. Each measure says what is counted,
where it is read, and the number that would make the owner act. Write that number in figures.

**Example:** Seats reserved per event, read in `/admin` every week. With 0 reservations 3 days
before an event, do the reservation task yourself on the live site.

</td></tr></table>

- TODO: what is counted, where it is read, and the number that makes the owner act
- TODO: a second measure, in the same way

How to run, change and deploy the site safely:

<table width="100%"><tr></tr><tr><td>

**Guidance.** The lines below hold the starter's own rules and the course's default steps. Keep them,
or change the last two to your own steps: who merges, the checks that must pass, and how you go back
to the version before. Vercel's **Instant Rollback** runs no build, so go back with **Revert**.

**Example of a step of your own:** A change to the reservation form is merged only after a second
member has tried it on the preview.

</td></tr></table>

- On your own computer: `docs/guides/local-setup.md`.
- TODO: anything your project does differently, or write "Nothing different".
- A change reaches the live site through `main`. Never use Vercel's "Promote to Production": use
  Redeploy, and check that the build log shows `MIGRATIONS: verified committed migrations`.
- A change to the code goes live through a branch and a pull request with its preview and its AI
  note. Its author waits for the starter's checks, reads what they say, and merges it into `main`.
- To go back to the version before, use **Revert** on the merged pull request on GitHub. It opens a
  new pull request that undoes the change: merge it like any other, so that its build runs. A revert
  leaves the database as it is: a migration that has already run stays.
- TODO: keep the last two lines or change them to your own steps, then delete this line.
