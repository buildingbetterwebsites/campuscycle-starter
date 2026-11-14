# Decision: analytics

Whether the site measures how it is used, and with which tool. Its reader comes later, with one
question: can I change this, and what happens if I do? Fill in every place marked TODO. The starter's
analytics are off until `NEXT_PUBLIC_ANALYTICS` names a tool; see `src/lib/analytics.ts`.

The grey boxes are guidance, and the course's checks do not read them. In the file's text, a box runs
from a line that starts with `<table` to the line `</td></tr></table>`: write your own text outside
it, and delete a box, a row or a line that you do not need.

## The question

<table width="100%"><tr></tr><tr><td>

**Guidance.** Write in one sentence what had to be decided. Add the need or the requirement behind
it, and what you want the numbers to tell you.

**Example:** Do we measure how the site is used, and with which tool? The library wants to know how
many people who open an event's page go on to reserve a seat (requirement R1).

</td></tr></table>

- **The question:** TODO: one sentence
- **The need or requirement behind it:** TODO:

## Options considered

<table width="100%"><tr></tr><tr><td>

**Guidance.** Write at least two options, one row each: what the option would give, and what it
would cost. One of them is the simplest thing, which is the first row here. The other usual options
for analytics are Vercel Web Analytics, which the starter can switch on, and Matomo, only if someone
already hosts it for you. Add a row for each further option.

**Example:** No analytics: it costs nothing and collects nothing, but we cannot see whether anyone
opens an event's page.

</td></tr></table>

| Option | What it would give | What it would cost |
| --- | --- | --- |
| No analytics | TODO: | TODO: |
| TODO: | TODO: | TODO: |

## The decision

<table width="100%"><tr></tr><tr><td>

**Guidance.** Write the option you chose as one sentence. Once it is installed, add what you
installed, where its settings are, and how you checked that it does what you expected: the grading
list asks for it. Until then, write "Not installed yet" on those lines. In a team, name who took part
in the decision. Working alone, delete that line.

**Example:** We chose Vercel Web Analytics. It is switched on with `NEXT_PUBLIC_ANALYTICS=vercel` in
Vercel's settings and with **Enable** on the project's Analytics tab. We opened the live site with
the browser's Network tab open, and saw the request named `view` that records a page view.

</td></tr></table>

- **We chose:** TODO:
- **What we installed, and where its settings are:** TODO:
- **How we checked that it does what we expected:** TODO:
- **Who took part in the decision:** TODO:

## Why

<table width="100%"><tr></tr><tr><td>

**Guidance.** Give each reason with its evidence: what you checked before you decided. Then say what
that evidence cannot tell you. Two or three reasons are enough.

**Example:** It needs no second account, because the site already runs on Vercel. We read Vercel's
pricing page: the free plan includes page views. That page cannot tell us whether page views alone
will answer our question.

</td></tr></table>

- **Why we chose it:** TODO: each reason with what you checked
- **What this evidence cannot tell us:** TODO:

## Consequences

<table width="100%"><tr></tr><tr><td>

**Guidance.** Write what you accepted with the choice, both the good and the bad. One line for each
point below is enough.

**Example:** On the free plan we see page views only, so we cannot count saved reservations. To
leave the tool, we remove the setting and switch Analytics off in Vercel.

</td></tr></table>

- **Its cost in money and in time:** TODO:
- **Who maintains it:** TODO:
- **What we give up:** TODO: what you cannot learn, and what the free plan leaves out
- **How we could leave the tool later:** TODO:
- **The data it collects about our users, and whether it needs a cookie banner:** TODO:

## Facts read on

<table width="100%"><tr></tr><tr><td>

**Guidance.** List each provider's page you read, with its link and the date you read it. Plans and
limits change, so the date tells the next reader how old the facts are. Add a row for each page.

**Example:** Vercel's pricing page for Web Analytics, with its link, read on 20 April 2026.

</td></tr></table>

| Page | Its link | Read on |
| --- | --- | --- |
| TODO: | TODO: | TODO: date |

## Review when

<table width="100%"><tr></tr><tr><td>

**Guidance.** Name the event that should make someone look at this decision again. One line is
enough.

**Example:** We review it when the library asks how many reservations come from each event's page,
because the free plan cannot answer that.

</td></tr></table>

TODO: when to review it.
