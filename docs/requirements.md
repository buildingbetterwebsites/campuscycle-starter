# Requirements

What the site must do, written so that someone else can check it. Each requirement expresses a need of
your users, and has a check that passes or fails on the live site. Fill in every place marked TODO, and
add a row per requirement. The boxes marked Tip are guidance: the course's checks do not read them,
and you may delete them when you are done.

In a team, write under the title who wrote this document, by first name or GitHub username.

> [!TIP]
> **Guidance.** Write one row per requirement, and add rows as you need them. Cover both of your user
> tasks first. Then look for the requirements a first list misses, such as accessibility, privacy and
> speed. The five columns:
> - **Id:** R1, R2 and so on. A number is never used again.
> - **Requirement:** who can do what, under which condition. It names no product.
> - **Serves:** the task or the need behind it. Write a need in the words of the user or the
>   organisation, with the evidence it rests on, or how you will collect that evidence.
> - **Check:** what someone does on the live site, and what they must see. Name the page, the action
>   and the exact result, so that another person can run the check without asking you.
> - **Result:** "passed" with the date you checked it on the live site, or "not yet" with what is
>   missing. Before you have checked it there, write "not yet: not built".
>
> One question tells a requirement from a way of building it: can the same outcome be reached in a
> different way? "A user can see which events are full" is a requirement, because a "Full" label and
> "0 seats left" both reach it. "A red Full label on the button" is one way of building it: write the
> requirement in the table.
>
> Which requirement matters most goes into the ranking of the two tasks in `docs/brief.md`. What you
> decided to leave out goes under "Not in this version" there.
>
> **Example of one row:** R1. Requirement: a user can reserve one seat at an event that
> still has seats, with a name and an e-mail address, and sees a confirmation that says the
> reservation is saved. Serves: reserving a seat; the events coordinator needs to know before each
> event how many people are coming. Check: on `/events`, open "Meet the author" and reserve a seat with
> made-up details: the confirmation says the reservation is saved, and the reservation is listed in
> `/admin`. Result: not yet: the reservation is saved, but the confirmation does not name the event.

| Id | Requirement | Serves | Check | Result |
| --- | --- | --- | --- | --- |
| R1 | TODO: who can do what, under which condition | TODO: the task or the need behind it | TODO: on the live site, what someone does, and what they must see | TODO: "passed" with the date you checked, or "not yet" with what is missing |
| R2 | TODO: | TODO: | TODO: | TODO: |
