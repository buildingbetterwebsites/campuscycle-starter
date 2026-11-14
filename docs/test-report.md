# Test report

What you learned by watching people use your site. It is read by whoever decides whether the site can
go live, and later by whoever improves it.

**How to fill in this file**

- Write your own text in the lines and tables under each grey box.
- Replace every TODO, and the hint after it, with your own text. A section that still holds a TODO
  counts as not filled in.
- Delete a line or a table row that you do not use.
- The grey boxes are guidance. The course's checks do not read them, so you may keep them or delete
  them. In the editor, a box is every line from the one that starts with `<table` to the line
  `</td></tr></table>`: to delete a box, delete all of those lines.

In a team, write under the title who wrote this document, by first name or GitHub username.

The report grows in two rounds. In the first round, one person does your primary task, and you fix the
most important problem you saw. In the second round, a person does the same task again after your
change, and you write the release check.

## What was tested, and how

<table width="100%"><tr></tr><tr><td>

**Guidance.** One task and one person are enough for the first round. Read the task to the person
in the same words you write here. Name nobody: write "a fellow learner" or "a family member". With
nobody to ask, do the task yourself in a private window, and write that nobody else was watched. The
person uses made-up details. Write the date with its year, like 6 May 2026.

**Example:** Task: "Reserve one seat for the author talk on Thursday. Use made-up details." Who took
part: one fellow learner, who had never seen our site. Success: she reserves the seat without help.
Version of the site: the live site. Device and browser: her own phone and its browser. Place: the
library. Date of the test: 6 May 2026.

</td></tr></table>

- **Task:** TODO: the exact words you read to the person
- **Who took part:** TODO: no name; say what they had seen of the site before
- **Success:** TODO: what counts as success for the task
- **Version of the site:** TODO:
- **Device and browser:** TODO:
- **Place:** TODO:
- **Date of the test:** TODO: day, month and year

## What we saw

<table width="100%"><tr></tr><tr><td>

**Guidance.** Write one row per finding, with at least one row. Keep three things apart: what you
**saw** the person do (behaviour), what you **think** it means (interpretation), and what you are
**not sure** of (uncertainty).

**Example of one row:** Saw: she stopped at "3 places left" and asked whether a child needs a place
of its own. Think: "places" does not say that each person needs one. Not sure: whether other people
would ask; we watched one person.

</td></tr></table>

| # | Behaviour (what you saw) | Interpretation (what you think it means) | Uncertainty (what you are not sure of) |
| --- | --- | --- | --- |
| 1 | TODO: | TODO: | TODO: |

## What we changed, and the retest

<table width="100%"><tr></tr><tr><td>

**Guidance.** For each finding, say whether you fixed it, and why. For each fix, say what you
changed and name the pull request that made the change by its number, for example #21. That pull
request changes the site's code and is merged after the test. Copy the four lines below for each
further finding.

In the second round, add a line that starts with **Retest:** and gives the date, who tried the same
task again, and what happened.

**Example:** "Places" was unclear. Fixed in pull request #21: each event now says "3 seats left, one
per person". Retest on 13 May 2026 with a second fellow learner: he reserved two seats for himself
and a child without asking.

</td></tr></table>

- **Finding:** TODO: the number of the finding in the table above
- **Fixed or not fixed:** TODO: with the reason
- **What we changed:** TODO:
- **Pull request:** TODO: its number after a #

## The release check

<table width="100%"><tr></tr><tr><td>

**Guidance.** Write the release check before the site goes live. The three lines below are enough.
Do both of your user tasks on one device and browser, then with the keyboard only and at phone
width. The decision is one of three: release, release with a named follow-up, or hold. In the first
round, write "Not run yet" on each line.

**Example:** Device and browser: a laptop with Chrome and a phone with its own browser. Keyboard only
and phone width: both tasks completed; the focus ring on the "Reserve my seat" button was hard to
see, and we fixed it. Decision: release, with one follow-up: a test with a screen reader on a phone.

</td></tr></table>

- **Device and browser:** TODO:
- **What we found with the keyboard only, and at phone width:** TODO:
- **Our decision:** TODO: release, release with a named follow-up, or hold

## Not tested yet

<table width="100%"><tr></tr><tr><td>

**Guidance.** Say what remains untested, which conditions you did not test, and what could go wrong
because of it. One or two rows are enough.

**Example:** A screen reader on a phone: a user who relies on one may not hear that an event is full.

</td></tr></table>

| Not tested | What could go wrong because of it |
| --- | --- |
| TODO: | TODO: |
