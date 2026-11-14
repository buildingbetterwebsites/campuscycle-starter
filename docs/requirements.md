# Requirements

What the site must do, written so that someone else can check it. Each requirement expresses a need of
your users, and has a check that passes or fails on the live site. Fill in every place marked TODO, and
add a row per requirement. The grey box is guidance: the course's checks do not read it, and you may
delete it when you are done.

In a team, write under the title who wrote this document, by first name or GitHub username.

<table width="100%"><tr></tr><tr><td>

**Guidance.** Write one row per requirement. Cover both of your user tasks first, then accessibility,
privacy and speed. The five columns:
- **Id:** R1, R2 and so on. A number is never used again.
- **Requirement:** who can do what, under which condition. It names no product.
- **Serves:** the task or the need behind it, in the words of the user or the organisation, with
  the evidence it rests on, or how you will collect it.
- **Check:** the page, the action and the exact result on the live site, so that another person can
  run the check without asking you.
- **Result:** "passed" with the date you checked it on the live site, or "not yet" with what is
  missing, for example "not yet: not built".

A requirement says what the site must do. Ask of each line: can the same outcome be reached in a
different way? "A user can see which events are full" is a requirement, because a "Full" label and
"0 seats left" both reach it. "A red Full label on the button" is one way of building it.

**Example of one row:** R1. Requirement: a user can reserve one seat at an event that still has
seats, with a name and an e-mail address, and sees a confirmation that says the reservation is
saved. Serves: reserving a seat; the events coordinator needs to know before each event how many
people are coming. Check: on `/events`, open "Meet the author" and reserve a seat with made-up
details: the confirmation says the reservation is saved, and the reservation is listed in `/admin`.
Result: not yet: the reservation is listed in `/admin`, but the confirmation does not say that it
is saved.

</td></tr></table>

| Id | Requirement | Serves | Check | Result |
| --- | --- | --- | --- | --- |
| R1 | TODO: who can do what, under which condition | TODO: the task or the need behind it | TODO: on the live site, what someone does, and what they must see | TODO: "passed" with the date you checked, or "not yet" with what is missing |
| R2 | TODO: | TODO: | TODO: | TODO: |
