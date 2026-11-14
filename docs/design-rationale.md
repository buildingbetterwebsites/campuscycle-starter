For teams; a learner working alone can delete this file.

# Design rationale

Why your site looks and behaves the way it does. It is read by whoever changes the design later, so
they know what each choice protects.

**How to fill in this file**

- Write your own text in the lines and tables under each grey box.
- Replace every TODO, and the hint after it, with your own text. A section that still holds a TODO
  counts as not filled in.
- Delete a line or a table row that you do not use.
- The grey boxes are guidance. The course's checks do not read them, so you may keep them or delete
  them. In the editor, a box is every line from the one that starts with `<table` to the line
  `</td></tr></table>`: to delete a box, delete all of those lines.

Write under the title who wrote this document, by first name or GitHub username.

## Sketches

<table width="100%"><tr></tr><tr><td>

**Guidance.** Show your first sketches of the main pages, at phone width and at laptop width, and
say in a few lines what you changed between them. Photos of paper sketches are fine.

Upload each picture to the `docs/` folder on GitHub (**Add file**, then **Upload files**), and show
it with a line such as `![Home page sketched at phone width](sketch-home-phone.jpg)`. Give the file
a name without spaces, and write that name with the same capitals. Keep faces and names out of the
photos.

**Example:** In the first sketch the reservation form was on a page of its own. In the second it is
on the event's page, under the seats left, so that the user sees both at once.

</td></tr></table>

- **Our sketches:** TODO: the lines that show your pictures, or links to them
- **What we changed between them:** TODO:

## Palette and type

<table width="100%"><tr></tr><tr><td>

**Guidance.** Define each colour once, as a custom property (a CSS variable) in
`src/app/(site)/globals.css`, and write one row per colour. Then write one row per pair of text
colour and background colour, with the contrast ratio you measured. Normal text needs at least 4.5:1,
and large text at least 3:1. Add rows as you need them.

**Example:** Text `#1d3557` on the page background `#f8f5ee`: 11.35:1, measured with WebAIM's
Contrast Checker. We chose a warm background because the library's own posters use one.

</td></tr></table>

| Colour (its name and value) | What it is used for |
| --- | --- |
| TODO: | TODO: |
| TODO: | TODO: |

| Text colour | Background colour | Contrast ratio | Measured with |
| --- | --- | --- | --- |
| TODO: | TODO: | TODO: | TODO: |

- **Our fonts and sizes:** TODO:
- **Why these colours and fonts fit our users:** TODO:

## Layout at phone and laptop width

<table width="100%"><tr></tr><tr><td>

**Guidance.** Write one row per main page: how it is laid out at each width. The starter's checks
look at both widths.

**Example:** On a phone, the events are one column of cards and the filters open from a button. On a
laptop, the cards are three in a row and the filters stay visible on the left.

</td></tr></table>

| Page | On a phone (390 px wide) | On a laptop (1100 px wide) |
| --- | --- | --- |
| TODO: | TODO: | TODO: |
| TODO: | TODO: | TODO: |

## The principles we applied

<table width="100%"><tr></tr><tr><td>

**Guidance.** Name three to five design principles, each with the place on your site where it shows.
Four principles to start from:
- **Visibility of system status** (Nielsen's first heuristic): the site shows what is happening.
- **Error prevention** (also one of Nielsen's ten heuristics): the design stops the most common
  mistake before a user makes it.
- **Fitts's Law:** a large target close to the finger or the pointer is easy to hit.
- **Signifiers:** a button looks like a button, and colour is never the only signal.

The course's module on user experience teaches more: visual perception, the other heuristics of
Nielsen's ten, and UX patterns with their trade-offs.

**Example:** Visibility of system status: each event says how many seats are left. It shows on the
events list and on each event's page.

</td></tr></table>

| Principle | What we did | Where it shows on our site |
| --- | --- | --- |
| TODO: | TODO: | TODO: |
| TODO: | TODO: | TODO: |
| TODO: | TODO: | TODO: |

## Forms and feedback

<table width="100%"><tr></tr><tr><td>

**Guidance.** For each form, write what the user sees in each of the seven states. Where a state
cannot happen on a form, say so. Copy the two parts below for each further form. The states:
- **Empty:** what is required and what is optional.
- **Pending:** the request is on its way.
- **Invalid:** an answer is missing or wrong.
- **Full:** a rule refused the request, for example because the last seat was taken.
- **Failed:** the request did not get through, or no answer came back.
- **Repeated:** the same request was sent twice.
- **Saved:** the confirmation, which says honestly what happened.

**Example:** Full: the last seat was taken while the user was typing. The message says that the
event is full, the event now shows "Full", and the name and e-mail address stay in the form.

</td></tr></table>

**Form:** TODO: the name of the form, and the page it is on

| State | What the user sees |
| --- | --- |
| Empty | TODO: |
| Pending | TODO: |
| Invalid | TODO: |
| Full | TODO: |
| Failed | TODO: |
| Repeated | TODO: |
| Saved | TODO: |

## What makes it our own

<table width="100%"><tr></tr><tr><td>

**Guidance.** Say what differs from the starter beyond its colours: layout, fonts, images, words.
For a choice you kept from the starter, say why it fits your users.

**Example:** Every event card starts with its date in large type, because users look for a day
first. We kept the starter's form layout, because most of our users reserve on a phone.

</td></tr></table>

- **What differs from the starter:** TODO: layout, fonts, images, words
- **What we kept from the starter, and why it fits our users:** TODO:
