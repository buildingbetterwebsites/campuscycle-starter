For teams; a learner working alone can delete this file.

# Content and structure

What content your site holds and how it is organised. It is read by everyone who adds a page or a
field, so the site keeps one structure. Fill in every place marked TODO. The boxes marked Tip are
guidance: the course's checks do not read them, and you may delete them when you are done.

Write under the title who wrote this document, by first name or GitHub username.

The collection your transactional task saves into is also named in `src/course-check.config.ts`,
with the text field that names a record: the course's checks read them there. Fill it in when your
own task replaces the booking example.

## Content inventory

> [!TIP]
> **Guidance.** Write one item per piece of content the site needs. Start with the content each user
> task needs. For each item, give:
> - the user's question: what the user needs to decide or do;
> - the content that answers it, including anything you do not know yet;
> - the source: the evidence you can check the answer against;
> - the role you propose keeps it up to date;
> - the pages that show it;
> - its status: to write, written or checked.
>
> **Example:** Event dates, times and seats. User question: when is it, and is there room? Source: the
> library's events calendar. Proposed role: the events coordinator, who updates them in `/admin`.
> Pages: the events list and each event's page. Status: checked.

TODO: every kind of content the site shows, where it comes from, and who keeps it up to date.

## Content model

> [!TIP]
> **Guidance.** Draw the model before you build it. Then write here:
> - each collection with its fields. Your model has at least four collections of your own topic;
>   users, media and pages do not count;
> - each relation between two collections: one-to-many or many-to-many;
> - your one many-to-many relation, and the page that shows it from each side;
> - a picture of your drawing. A photo of a paper drawing is fine.
>
> Upload the picture to the `docs/` folder on GitHub (**Add file**, then **Upload files**), and show
> it with a line such as `![Our content model](content-model.jpg)`. Give the file a name without
> spaces, and write that name exactly, capitals too. Keep faces and names out of the photo, because
> your repository is public.
>
> **Example:** Events: title, date, start time, seats, summary. Speakers: name, short biography.
> Rooms: name, floor. Reservations: name, e-mail address; each reservation is for one event
> (one-to-many). Events and speakers are many-to-many: an event can have several speakers, and a
> speaker can speak at several events. Each event's page lists its speakers, and each speaker's page
> lists their events.

TODO: each collection with its fields, and how the collections link to each other.

## Sitemap

> [!TIP]
> **Guidance.** List your 6 to 9 pages. Give each page its address, the pages it leads to and one line
> on its job. A page counts when a user can reach it from the home page through links. A page that
> shows one record, such as each event's own page, counts once. The confirmation page, the privacy
> page and the not-found page do not count towards the 6 to 9: list them too.
>
> **Example:** Events (`/events`): the list of coming events, with its filters. It leads to each
> event's page (`/events/<slug>`), which shows the seats left and the reservation form.

TODO: every page, with its address, and which page leads to which.

## Navigation labels

> [!TIP]
> **Guidance.** List the words in your main menu, in the order they appear. Choose the words your
> users use, and give your reason where a choice was not obvious.
>
> **Example:** "Home", "What's on", "Speakers", "Visit us", "About". We chose "What's on" over
> "Events" because users ask the library's desk "what's on this week?".

TODO: the words in the main menu, and why users will understand them.

## Each user task, step by step

> [!TIP]
> **Guidance.** Write a numbered list per task. Each step names the page, what the user does and what
> they see next. The last step is the outcome of the task. Use the words your buttons and links show,
> so that someone who has never seen your site can follow the steps on the live site without asking
> you. The course's checks follow exactly these steps there.
>
> **Example:** Task 1: reserve a seat.
> 1. On the home page, the user chooses "What's on" in the menu.
> 2. The events list shows the coming events. The user opens "Meet the author".
> 3. The event's page shows "12 seats left" and the reservation form.
> 4. The user fills in a name and an e-mail address, and chooses **Reserve my seat**.
> 5. The confirmation says: "Your seat is reserved. This is a practice project: use made-up details."

TODO: for each of the two tasks, the pages a user goes through and what they do on each.
