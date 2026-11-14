# Test report

What you learned by watching people use your site. It is read by whoever decides whether the site can
go live, and later by whoever improves it. Fill in every place marked TODO. The boxes marked Tip are
guidance: the course's checks do not read them, and you may delete them when you are done.

In a team, write under the title who wrote this document, by first name or GitHub username.

The report grows in two rounds. In the first round, one person does your primary task, and you fix the
most important problem you saw. In the second round, a person does the same task again after your
change, and you write the release check.

## What was tested, and how

> [!TIP]
> **Guidance.** One task and one person are enough for the first round. Write:
> - the exact words of the task, as you read them to the person;
> - who took part, without a name ("a fellow learner", "a family member"), and what they had seen of
>   the site before. With nobody to ask, do the task yourself in a private window, and say that
>   nobody else was watched;
> - what counts as success for the task;
> - the conditions: the version of the site, the device, the browser and the place;
> - the date of the test, with its year, written like 6 May 2026.
>
> The person uses made-up details. Add the same facts for the retest when you have done it.
>
> **Example:** Task: "Reserve one seat for the author talk on Thursday. Use made-up details."
> Condition: the live site on 6 May 2026, on her own phone and its browser, in the library. One fellow
> learner took part, who had never seen our site. Success: she reserves the seat without help.

TODO: the task, how it was tested, and the date of the test.

## What we saw

> [!TIP]
> **Guidance.** Write one row per finding, with at least one row. Keep three things apart: what you
> **saw** the person do (behaviour), what you **think** it means (interpretation), and what you are
> **not sure** of (uncertainty).
>
> **Example of one row:** Saw: she stopped at "3 places left" and asked whether a child needs a place
> of its own. Think: "places" does not say that each person needs one. Not sure: whether other people
> would ask; we watched one person.

| # | Behaviour (what you saw) | Interpretation (what you think it means) | Uncertainty (what you are not sure of) |
| --- | --- | --- | --- |
| 1 | TODO: | TODO: | TODO: |

## What we changed, and the retest

> [!TIP]
> **Guidance.** For each finding, say whether you fixed it, and why. For each fix, say what you
> changed and name the pull request that made the change by its number, for example #21. That pull
> request changes the site's code and is merged after the test. In the second round, add the retest:
> what happened when a person tried the same task again, with its date.
>
> **Example:** "Places" was unclear. Fixed in pull request #21: each event now says "3 seats left, one
> per person". Retest on 13 May 2026 with a second fellow learner: he reserved two seats for himself
> and a child without asking.

TODO: each change: the finding it answers, the pull request that made it (for example #14), and the retest with its date and result.

## The release check

> [!TIP]
> **Guidance.** Write the release check before the site goes live. Three lines are enough:
> - the device and the browser on which you did both of your user tasks;
> - what you found when you did both tasks with the keyboard only, and at phone width;
> - your decision: release, release with a named follow-up, or hold.
>
> In the first round, write one line here, such as "Not run yet: the release check comes before the
> site goes live."
>
> **Example:** Device and browser: a laptop with Chrome and a phone with its own browser. Keyboard only
> and phone width: both tasks completed; the focus ring on the "Reserve my seat" button was hard to
> see, and we fixed it. Decision: release, with one follow-up: a test with a screen reader on a phone.

TODO: the three lines of the release check: the device and browser, what you found, and your decision.

## Not tested yet

> [!TIP]
> **Guidance.** Say what remains untested, which conditions you did not test, and what could go wrong
> because of it. One or two lines are enough.
>
> **Example:** A screen reader on a phone: a user who relies on one may not hear that an event is full.

TODO: what is not tested yet, and the risk it leaves.
