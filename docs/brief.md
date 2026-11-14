# Project brief

The short description of your site: who it is for and what it does. Its reader has never seen your
site, so write what a stranger needs to understand it. Fill in every place marked TODO. Keep the brief
to one page; the details belong in `docs/requirements.md`.

The grey boxes are guidance, and the course's checks do not read them. In the file's text, a box runs
from a line that starts with `<table` to the line `</td></tr></table>`: write your own text outside
it, and delete a box, a row or a line that you do not need.

In a team, write under the title who wrote this document, by first name or GitHub username.

## What the site is for

<table width="100%"><tr></tr><tr><td>

**Guidance.** Write the promise the site makes as one sentence, in the form given below. The
sentence names no feature and no product. Then describe the organisation or topic the site is about.
Choose a real organisation only if it knows about the project and agrees.

**Example:** Millbrook Library's events help people in the city to reserve a seat at a free event,
so that the library knows before each event how many people are coming. Millbrook Library is a
made-up city library. It runs author talks, a reading group and story hours for children.

</td></tr></table>

- **The promise:** TODO: [Your service] helps [who] to [do what], so that [what the organisation gets].
- **Who runs it:** TODO:
- **What it offers:** TODO:
- **Real or made up:** TODO:

## Its users

<table width="100%"><tr></tr><tr><td>

**Guidance.** Write one row per kind of user. Two or three kinds are enough.

A team fills in the two other tables too: two comparable sites that serve similar users, and the
questions the team cannot answer yet. Working alone, you may delete those two tables.

**Example:** A parent looks for a story hour and reserves two seats, so that the family knows it has
a place. The events coordinator opens the reservations of an event, so that she knows how many chairs
to set out. Not known yet: how many people come without a reservation. We will ask the coordinator to
count them at two events.

</td></tr></table>

| Kind of user | What they come to do | What they have when it is done |
| --- | --- | --- |
| TODO: | TODO: | TODO: |
| TODO: | TODO: | TODO: |

| Comparable site (its address) | Date we looked | One thing we learned from it |
| --- | --- | --- |
| TODO: | TODO: | TODO: |
| TODO: | TODO: | TODO: |

| What we do not know yet | How and when we will find out |
| --- | --- |
| TODO: | TODO: |

## The two tasks, ranked

<table width="100%"><tr></tr><tr><td>

**Guidance.** Task 1 is the primary task: the task that must work before anything else. Write each
task as an action, with its type. The four types:
- **Informational:** the user finds and understands something.
- **Transactional:** the user sends something that the site saves, such as a reservation.
- **Application:** the user does ongoing work on information that changes.
- **Platform:** users create content and interact with each other.

Your two tasks have different types, and at least one is transactional. For each task, say what users
lose when it fails. Then say in two or three sentences why task 1 must work first.

**Example:** 1. Reserve a seat at an event (transactional). Outcome: the reservation is saved for an
event that still had a seat, and the user sees an honest confirmation. When it fails, the library
does not know how many people are coming. 2. Find the events of this month that suit you
(informational). Outcome: the user knows the date, the place and the age group of each event. When it
fails, a user can still ask at the library's desk. Reserving must work first, because nothing else
tells the library how many people are coming.

</td></tr></table>

1. **Task 1 (the primary task):** TODO: the task, as an action
   - **Type:** TODO: informational, transactional, application or platform
   - **Outcome:** TODO: what the user has when it is done
   - **When it fails:** TODO: what users lose
2. **Task 2:** TODO: the task, as an action
   - **Type:** TODO: informational, transactional, application or platform
   - **Outcome:** TODO: what the user has when it is done
   - **When it fails:** TODO: what users lose

**Why task 1 must work first:** TODO: two or three sentences

## Constraints

<table width="100%"><tr></tr><tr><td>

**Guidance.** A constraint must hold whatever is built. The first three lines below are the
project's own limits: keep them. In the last line, add what the organisation can and cannot do, in
people, time and budget. If you have nothing to add, write "None".

**Example:** Millbrook Library has one events coordinator and no budget for paid software this year.

</td></tr></table>

- Test data only: made-up names, e-mail addresses and bookings, never real personal data.
- No payments.
- Free plans only.
- TODO: add any other constraint your project has, or write "None".

## Not in this version

<table width="100%"><tr></tr><tr><td>

**Guidance.** List what you decided to leave out, so that nobody mistakes it for something
forgotten. Give each item its reason, and the condition under which you would look at it again. Two
or three rows are usual.

**Example:** No waiting list for full events: we found no need for one yet. We look at it again if
events are full more than a week before they take place.

</td></tr></table>

| Left out | Why | We look at it again when |
| --- | --- | --- |
| TODO: | TODO: | TODO: |
| TODO: | TODO: | TODO: |
