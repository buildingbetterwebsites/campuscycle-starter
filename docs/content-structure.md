For teams; a learner working alone can delete this file.

# Content and structure

What content your site holds and how it is organised. It is read by everyone who adds a page or a
field, so the site keeps one structure. Replace every TODO, and the hint after it, with your own text: a section that still holds a TODO counts as not filled in.

The grey boxes are guidance, and the course's checks do not read them. In the file's text, a box runs
from a line that starts with `<table` to the line `</td></tr></table>`: write your own text outside
it, and delete a box, a row or a line that you do not need.

Write under the title who wrote this document, by first name or GitHub username.

The collection your transactional task saves into is also named in `src/course-check.config.ts`,
with the text field that names a record: the course's checks read them there. Fill it in when your
own task replaces the booking example.

## Content inventory

<table width="100%"><tr></tr><tr><td>

**Guidance.** Write one row per piece of content the site needs, and add a row for each further
piece. Start with the content each user task needs. The columns:
- **Content:** the piece of content, with anything you do not know about it yet.
- **User question:** what the user needs to decide or do.
- **Source:** the evidence you can check the content against.
- **Kept up to date by:** the role you propose for it.
- **Pages:** the pages that show it.
- **Status:** to write, written or checked.

**Example:** Event dates, times and seats. User question: when is it, and is there room? Source: the
library's events calendar. Kept up to date by: the events coordinator, in `/admin`. Pages: the events
list and each event's page. Status: checked.

</td></tr></table>

| Content | User question | Source | Kept up to date by (a role) | Pages | Status |
| --- | --- | --- | --- | --- | --- |
| TODO: | TODO: | TODO: | TODO: | TODO: | TODO: to write, written or checked |
| TODO: | TODO: | TODO: | TODO: | TODO: | TODO: |

## Content model

<table width="100%"><tr></tr><tr><td>

**Guidance.** Draw the model before you build it. Then write here:
- each collection with its fields. Your model has at least four collections of your own topic;
  users, media and pages do not count;
- each relation between two collections: one-to-many or many-to-many;
- your one many-to-many relation, and the page that shows it from each side;
- a picture of your drawing. A photo of a paper drawing is fine.

Upload the picture to the `docs/` folder on GitHub (**Add file**, then **Upload files**), and show
it with a line such as `![Our content model](content-model.jpg)`. Give the file a name without
spaces, and write that name with the same capitals. Keep faces and names out of the photo.

**Example:** Events: title, date, start time, seats, age group. Speakers: name, short biography.
Rooms: name, floor. Reservations: name, e-mail address. Each event takes place in one room, and
each reservation is for one event (both one-to-many). Events and speakers are many-to-many: each
event's page lists its speakers, and each speaker's page lists their events.

</td></tr></table>

| Collection | Its fields |
| --- | --- |
| TODO: | TODO: |
| TODO: | TODO: |
| TODO: | TODO: |
| TODO: | TODO: |

| Relation between | One-to-many or many-to-many |
| --- | --- |
| TODO: two collections | TODO: |
| TODO: two collections | TODO: |

- **Our many-to-many:** TODO: the two collections, and the page that shows it from each side
- **Our drawing:** TODO: the line that shows the picture

## Sitemap

<table width="100%"><tr></tr><tr><td>

**Guidance.** List your 6 to 9 pages in the first table, one row each. A page counts when a user can
reach it from the home page through links. A page that shows one record, such as each event's own
page, counts once. The three pages in the second table do not count towards the 6 to 9: give their
addresses.

**Example:** Events (`/events`): the list of coming events, with its filters. It leads to each
event's page (`/events/<slug>`), which shows the seats left and the reservation form.

</td></tr></table>

| Page | Address | Its job | Leads to |
| --- | --- | --- | --- |
| TODO: | TODO: | TODO: | TODO: |
| TODO: | TODO: | TODO: | TODO: |

| Page that does not count | Address |
| --- | --- |
| The confirmation page | TODO: |
| The privacy page | TODO: |
| The not-found page | TODO: what a user sees at an address that does not exist |

## Navigation labels

<table width="100%"><tr></tr><tr><td>

**Guidance.** List the words in your main menu, in the order they appear. Choose the words your
users use, and give your reason where a choice was not obvious.

**Example:** "Home", "What's on", "Speakers", "Visit us", "About". We chose "What's on" over
"Events" because users ask the library's desk "what's on this week?".

</td></tr></table>

- **The words in our main menu:** TODO: in the order they appear
- **Why users will understand these words:** TODO:

## Each user task, step by step

<table width="100%"><tr></tr><tr><td>

**Guidance.** Write a numbered list per task, and add a line for each step. Each step names the
page, what the user does and what they see next. The last step is the outcome of the task. Use the
words your buttons and links show: someone who has never seen your site must be able to follow the
steps on the live site without asking you.

**Example:** Task 1: reserve a seat.
1. On the home page, the user chooses "What's on" in the menu.
2. The events list shows the coming events. The user opens "Meet the author".
3. The event's page shows "12 seats left" and the reservation form.
4. The user fills in a name and an e-mail address, and chooses **Reserve my seat**.
5. The confirmation says: "Your seat is reserved. This is a practice project: use made-up details."

</td></tr></table>

**Task 1:** TODO: the name of your primary task

1. TODO: the page, what the user does, and what they see next
2. TODO: the next step
3. TODO: the last step, which is the outcome of the task

**Task 2:** TODO: the name of your second task

1. TODO: the page, what the user does, and what they see next
2. TODO: the next step
3. TODO: the last step, which is the outcome of the task
