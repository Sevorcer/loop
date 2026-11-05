# Brief — Allison batch 1: four quick fixes (live-review #37, #38, #39, #41a)

Source: Allison Baker (service coordinator) email "Loop Service Items,"
2026-11-05. Collin directed fixes out ASAP. Each item below was verified
against production code on 2026-11-05 — build what's described, and if the
code contradicts a claim, say so on #337 instead of guessing.

## 1. Work summary is NOT required (#38)
`JobForm` renders "Work summary" with a RequiredStar + aria-required.
Make it optional: remove the star/aria-required, and remove/relax any submit
validation that blocks saving (or closeout) on an empty summary — check BOTH
the create (NewJobForm) and edit paths, and any server-side check. A job with
an empty summary must save cleanly. Keep the field itself.

## 2. Customer-page job create: preselect the main property (#37)
Creating a job from a customer page already carries the customer
(CustomerDetailScreen → JOB_NEW with customerId). What's missing: the
property doesn't preselect. When the job form initializes WITH a customerId,
preselect that customer's primary property (their first/main property —
match however the app already orders a customer's properties) and leave it
fully changeable. No behavior change when creating a job from anywhere else.

## 3. Start time explicit in the job detail header (#39)
The JobDetailScreen header meta row shows a schedule range when start/end
timestamps exist, but date-only jobs show just the date, and the start time
isn't glanceable. Make the header show the appointment start time explicitly
whenever one is set (e.g. "Thu, Nov 6 · 8:00 AM – 12:00 PM", or "Thu, Nov 6 ·
8:00 AM" when there's no end). Keep the date display as the fallback for
unscheduled jobs.

## 4. Completed jobs visibly change on the calendar (#41a)
On the month calendar, a completed job's card looks the same as a scheduled
one (the status-badge color change only exists in the day/list view; cards
are merely non-draggable when Completed). Give completed jobs a distinct
card treatment on the calendar — dimmed with a green/completed accent — so
"done" reads at a glance. If the dispatch board shares the card component,
apply it there too; if not, calendar only and note it.

## Rules
- Standard gates: `npx tsc --noEmit`, FULL Vitest suite, production build —
  all green before calling it ready. Tests for each behavior change.
- ONE PR for the batch, one push (deploy-cap discipline). Prep only —
  Collin merges. Report back on #337 with the PR number.
