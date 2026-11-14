# Decision: analytics

Whether the site measures how it is used, and with which tool. Its reader comes later, with one
question: can I change this, and what happens if I do? Fill in every place marked TODO. The boxes
marked Tip are guidance: the course's checks do not read them, and you may delete them when you are
done. The starter's analytics are off until `NEXT_PUBLIC_ANALYTICS` names a tool; see
`src/lib/analytics.ts`.

## The question

> [!TIP]
> **Guidance.** Write in one sentence what had to be decided. Add the need or the requirement behind
> it, and what you want the numbers to tell you.
>
> **Example:** Do we measure how the site is used, and with which tool? The library wants to know how
> many people who open an event's page go on to reserve a seat (requirement R1).

TODO: the question analytics should answer for your site.

## Options considered

> [!TIP]
> **Guidance.** Write at least two options, one line each: what the option would give, and what it
> would cost. One of them is the simplest thing, or doing nothing. For analytics the usual options
> are: no analytics; Vercel Web Analytics, which the starter can switch on; and Matomo, only if
> someone already hosts it for you.
>
> **Example:** No analytics: it costs nothing and collects nothing, but we cannot see whether anyone
> opens an event's page.

- TODO: option 1, its advantage and its drawback.
- TODO: option 2, its advantage and its drawback.

## The decision

> [!TIP]
> **Guidance.** Write the option you chose as one sentence. Once it is installed, add what you
> installed, where its settings are, and how you checked that it does what you expected: the grading
> list asks for it. In a team, name who took part in the decision.
>
> **Example:** We chose Vercel Web Analytics. It is switched on with `NEXT_PUBLIC_ANALYTICS=vercel` in
> Vercel's settings and with **Enable** on the project's Analytics tab. We opened the live site with
> the browser's Network tab open, and saw the request named `view` that records a page view.

TODO: the option you chose.

## Why

> [!TIP]
> **Guidance.** Give each reason with its evidence: what you checked before you decided. Then say what
> that evidence cannot tell you. Two or three reasons are enough.
>
> **Example:** It needs no second account, because the site already runs on Vercel. We read Vercel's
> pricing page: the free plan includes page views. That page cannot tell us whether page views alone
> will answer our question.

TODO: why you chose it.

## Consequences

> [!TIP]
> **Guidance.** Write what you accepted with the choice, both the good and the bad:
> - the cost, in money and in time;
> - who maintains it;
> - what you give up: what you cannot learn, and what the free plan leaves out;
> - how you could leave the tool later;
> - which data it collects about your users, and whether it needs a cookie banner.
>
> **Example:** On the free plan we see page views only, so we cannot count saved reservations. To
> leave the tool, we remove the setting and switch Analytics off in Vercel.

TODO: the consequences.

## Facts read on

> [!TIP]
> **Guidance.** List each provider's page you read, with its link and the date you read it. Plans and
> limits change, so the date tells the next reader how old the facts are.
>
> **Example:** Vercel's pricing page for Web Analytics, with its link, read on 3 November 2026.

TODO: each page you read, with its link and the date.

## Review when

> [!TIP]
> **Guidance.** Name the event that should make someone look at this decision again. One line is
> enough.
>
> **Example:** We review it when the library asks how many reservations come from each event's page,
> because the free plan cannot answer that.

TODO: when to review it.
