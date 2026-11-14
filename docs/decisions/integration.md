# Decision: an integration

Whether the site connects to another service, and to which. Its reader comes later, with one
question: can I change this, and what happens if I do? Fill in every place marked TODO. The grey boxes
are guidance: the course's checks do not read them, and you may delete them when you are done.

## The question

<table width="100%"><tr></tr><tr><td>

**Guidance.** Write in one sentence what had to be decided. Add the need of your users behind it,
or the requirement it serves, and what forces a choice now.

**Example:** Do we show a map of the way to the library, and from which service? Users who reserve
a seat need to find the building (requirement R4).

</td></tr></table>

- **The question:** TODO: one sentence
- **The need or requirement behind it:** TODO:

## Options considered

<table width="100%"><tr></tr><tr><td>

**Guidance.** Write at least two options, one row each: what the option would give, and what it
would cost. No integration at all is an option too: it is the first row here. Choose your
integration from the course's suggested list (Integration Patterns: APIs and Webhooks, Your
integration project's candidates):
- a chat window (tawk.to);
- an e-mail service for confirmations (Resend);
- a booking calendar (Cal.com);
- a newsletter sign-up;
- a map (OpenStreetMap).

None of these has been tried with this starter, so check the one you choose yourself. The brief rules
out payments, so the list has no payment provider. Add a row for each further option.

**Example:** No integration: the address as text on the "Visit us" page. It costs nothing and sends
no data to anyone, but a user must look up the way in another app.

</td></tr></table>

| Option | What it would give | What it would cost |
| --- | --- | --- |
| No integration | TODO: | TODO: |
| TODO: | TODO: | TODO: |

## The decision

<table width="100%"><tr></tr><tr><td>

**Guidance.** Write the option you chose as one sentence. Once it is installed, add what you
installed, where its settings are, and how you checked that it does what you expected: the grading
list asks for it. Until then, write "Not installed yet" on those lines. In a team, name who took part
in the decision. Working alone, delete that line.

**Example:** We chose a map from OpenStreetMap on the "Visit us" page. Its code is in the page's
file, with the library's place in it. We opened the page on the live site, on a phone and on a
laptop: the map shows the marker on the library.

</td></tr></table>

- **We chose:** TODO:
- **What we installed, and where its settings are:** TODO:
- **How we checked that it does what we expected:** TODO:
- **Who took part in the decision:** TODO:

## Why

<table width="100%"><tr></tr><tr><td>

**Guidance.** Give each reason with its evidence: what you checked before you decided. Then say what
that evidence cannot tell you. Two or three reasons are enough.

**Example:** The map needs no account and no key: we read OpenStreetMap's page on embedding a map.
The events coordinator told us that people phone the library to ask the way. Her answer cannot tell
us how many users would look at a map.

</td></tr></table>

| Reason | Its evidence: what we checked |
| --- | --- |
| TODO: | TODO: |
| TODO: | TODO: |

- **What this evidence cannot tell us:** TODO:

## Consequences

<table width="100%"><tr></tr><tr><td>

**Guidance.** Write what you accepted with the choice, both the good and the bad. One line for each
point below is enough.

**Example:** OpenStreetMap receives each user's internet address when the map loads, and our
privacy page says so. When the service is down, the page still shows the address as text.

</td></tr></table>

- **The accounts it needs, and its cost in money and in time:** TODO:
- **Who maintains it:** TODO:
- **What we give up:** TODO:
- **How we could leave the service later:** TODO:
- **The personal data that leaves our site, and whether it needs a cookie banner:** TODO:
- **What happens to our site when the service is down:** TODO:

## Facts read on

<table width="100%"><tr></tr><tr><td>

**Guidance.** List each provider's page you read, with its link and the date you read it. Plans and
limits change, so the date tells the next reader how old the facts are. Add a row for each page.

**Example:** OpenStreetMap's page on embedding a map, with its link, read on 20 April 2026.

</td></tr></table>

| Page | Its link | Read on |
| --- | --- | --- |
| TODO: | TODO: | TODO: date |

## Review when

<table width="100%"><tr></tr><tr><td>

**Guidance.** Name the event that should make someone look at this decision again. One line is
enough.

**Example:** We review it when the library moves, or when the map stops loading on the live site.

</td></tr></table>

TODO: when to review it.
