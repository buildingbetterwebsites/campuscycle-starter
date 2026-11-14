For teams; a learner working alone can delete this file.

# Design rationale

Why your site looks and behaves the way it does. It is read by whoever changes the design later, so
they know what each choice protects. Fill in every place marked TODO. The boxes marked Tip are
guidance: the course's checks do not read them, and you may delete them when you are done.

Write under the title who wrote this document, by first name or GitHub username.

## Sketches

> [!TIP]
> **Guidance.** Show your first sketches of the main pages, at phone width and at laptop width, and
> say in a few lines what you changed between them. Photos of paper sketches are fine.
>
> Upload each picture to the `docs/` folder on GitHub (**Add file**, then **Upload files**), and show
> it with a line such as `![Home page sketched at phone width](sketch-home-phone.jpg)`. Give the file
> a name without spaces, and write that name exactly, capitals too. Keep faces and names out of the
> photos, because your repository is public.
>
> **Example:** In the first sketch the reservation form was on a page of its own. In the second it is
> on the event's page, under the seats left, so that the user sees both at once.

TODO: your sketches (pictures in this folder, or links), and what you changed between them.

## Palette and type

> [!TIP]
> **Guidance.** Write three things.
> - Your colours and what each one is used for. Define each colour once, as a custom property (a CSS
>   variable) in `src/app/(site)/globals.css`.
> - For each pair of text colour and background colour: the contrast ratio you measured, and the tool
>   you used. Normal text needs at least 4.5:1, and large text at least 3:1.
> - Your fonts and sizes, and why these colours and fonts fit your users.
>
> **Example:** Text `#1d3557` on the page background `#f8f5ee`: 11.35:1, measured with WebAIM's
> Contrast Checker. We chose a warm background because the library's own posters use one.

TODO: your colours and fonts, where they are set (`src/app/(site)/globals.css`), and why you chose
them.

## Layout at phone and laptop width

> [!TIP]
> **Guidance.** Say for each main page how it is laid out on a phone and on a laptop, and what changes
> between the two. The starter's checks look at both widths: 390 px and 1100 px.
>
> **Example:** On a phone, the events are one column of cards and the filters open from a button. On a
> laptop, the cards are three in a row and the filters stay visible on the left.

TODO: how the main pages are laid out on a phone and on a laptop, and what changes between the two.

## The principles we applied

> [!TIP]
> **Guidance.** Name three to five design principles, each with the place on your site where it shows.
> Take them from what the course teaches about user experience, for example visual perception,
> affordances and signifiers, Fitts's Law, Nielsen's ten usability heuristics, or UX patterns and
> trade-offs.
>
> **Example:** Visibility of system status (Nielsen's first heuristic): each event says how many seats
> are left. It shows on the events list and on each event's page.

TODO: the design principles you applied, each with one place on the site where it shows.

## Forms and feedback

> [!TIP]
> **Guidance.** For each form, write what the user sees in each of these states. Where a state cannot
> happen on a form, say so.
> - **Empty:** what is required and what is optional.
> - **Pending:** the request is on its way.
> - **Invalid:** an answer is missing or wrong.
> - **Full:** a rule refused the request, for example because the last seat was taken.
> - **Failed:** the request did not get through, or no answer came back.
> - **Repeated:** the same request was sent twice.
> - **Saved:** the confirmation, which says honestly what happened.
>
> **Example:** Full: the last seat was taken while the user was typing. The message says that the
> event is full, the event now shows "Full", and the name and e-mail address stay in the form.

TODO: how your forms show what is required, what went wrong, and what was saved.

## What makes it our own

> [!TIP]
> **Guidance.** Say what differs from the starter beyond its colours: layout, fonts, images, words.
> For a choice you kept from the starter, say why it fits your users.
>
> **Example:** Every event card starts with its date in large type, because users look for a day
> first. We kept the starter's form layout, because most of our users reserve on a phone.

TODO: what you changed from the starter, so the site is clearly yours.
