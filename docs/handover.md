# Hand-over

Everything the next owner of this site needs. Fill in every place marked TODO. Never write
a password, a secret or a connection string in this file.

## Who owns what

First the services the site runs on, and whose account each one is in.

| Service | What it holds | Owner (account name, not the password) |
| --- | --- | --- |
| GitHub | the code | TODO: |
| Vercel | the live site and its settings | TODO: |
| Neon | the database (connected through Vercel) | TODO: |
| Vercel Blob | the images | TODO: |

Then the six responsibilities, one row each. Keep the six names in the first column as they are. Name
the owner as a role ("the club's secretary"), not a person; say who can log in to do it; and write when
it was last tested, as a date, or "never".

| Responsibility | Owner (a role) | Who can log in | Last tested |
| --- | --- | --- | --- |
| Content | TODO: | TODO: | TODO: |
| Access | TODO: | TODO: | TODO: |
| Updates | TODO: | TODO: | TODO: |
| Monitoring | TODO: | TODO: | TODO: |
| Backup and restore | TODO: | TODO: | TODO: |
| Ownership | TODO: | TODO: | TODO: |

- TODO: who edits which content in `/admin`, how they get an account, and what needs a developer.

## Left out, and in which order

Every idea you did not build, ranked by what users and the organisation lose without it, so the next
owner knows what to build first. Include what does not work yet, or could break, and what to do about
it.

1. TODO: the first thing to build next, and what users lose without it.
2. TODO: the next one.

TODO: what does not work yet, or could break, and what to do about it.

## How you will know it works

Two or three measures, each with where it is read and the number that would make the owner act.

- TODO: each measure, where it is read, and the number that means "act".

How to run, change and deploy the site safely:

- On your own computer: `docs/guides/local-setup.md`.
- TODO: anything your project does differently, or write "Nothing different".
- A change reaches the live site through `main`. Never use Vercel's "Promote to Production": use
  Redeploy, and check that the build log shows `MIGRATIONS: verified committed migrations`.
- TODO: your own steps: pull requests, previews, who merges, and the checks that must pass.
