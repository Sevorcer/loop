# Brief for Claude — build batch, 2026-11-04

From Zoinks. All items below carry Collin's decisions (2026-11-04). **B8 (calendar/dispatch drag) is still the first lane** — its brief is unchanged (`claude-brief-calendar-drag-2026-11-03.md`). This batch follows it. One PR per task, do not merge, do not apply migrations. **Every PR must pass `npm run build` (or at minimum `npx tsc --noEmit`) plus the full suite before you report it ready** — the Phase 2 train shipped five build errors under a green suite; that gate is now standing.

Coordination: post questions/blockers on issue #337. Zoinks reviews (diff + suite + build) before anything goes to Collin.

## Task 1 — B10 tech side: tighten (Collin decision)
The office side of B10 stays as decided (office may reach dispatch-plan actions via the jobs.update-gated PATCH route). The TECH side tightens: a tech must not be able to move a dispatch plan to **completed** while the job's own completion gates are unmet. Where the plan-status write happens for tech role + target completed, check the job's completion checklist (same source the closeout gates use) and refuse with the unmet blockers named. Office and above are unaffected. Tests: tech blocked with blockers listed; tech allowed once gates pass; office unaffected.

## Task 2 — Soft-delete jobs UI (Collin decision: build now)
Behaviour was decided 2026-11-03: deletion is a **soft delete**. Build: a Delete action on the job (visible to owner/manager/office, following the same office-and-above delete pattern Collin set for customer contacts), setting `deleted_at`; soft-deleted jobs disappear from lists, board, calendar, and search; an owner can restore. Migration expected (deleted_at column + default-scope filtering) — write it, do NOT apply it; Zoinks applies and verifies. Tests: delete hides everywhere checked, restore brings it back, tech role cannot delete.

## Task 3 — Daily Plans roster simplification (Collin decision)
The crew panel currently merges three sources (crew records + every technician + any name assigned that day) and invents "On roster" entries with no truck/availability. Replace with: **the panel shows only people assigned to that day's jobs, grouped under their crew record** (lead/member match). People assigned today who belong to no crew record (e.g. the floater) appear in one plain "Also working today" group with NO invented truck, availability, or departure fields. Remove the rosterOnly merge path and its tests; write tests for: assigned-only inclusion, crew grouping, floater group, empty day = empty panel.

## Task 4 — P1 regression lock (from the Oct 1–2 feedback reports, verified by Zoinks)
The three P1s are already fixed in code; this task locks two of them down:
- Add a regression test: `updateJobStatus` with the SAME status (In Progress → In Progress) is a no-op that returns the job and still syncs the dispatch plan — it must never throw "Invalid transition."
- Check the feedback-screenshot upload path end to end in tests (bucket `feedback-screenshots`, org-scoped policies from #308): a test that the feedback route stores the screenshot reference without a storage error. If an equivalent test already exists, say so on #337 instead of duplicating.

## Task 5 — S4: job-files upload authorization
The files API route (`/api/jobs/[id]/files`) never loads the job, so a tech can upload to jobs they're not assigned to. Load the job; tech role must be assigned to it to upload (office and above unaffected). Tests: unassigned tech refused, assigned tech allowed, office allowed.

## Task 6 — Job-signatures DELETE org check (micro-PR, specced earlier)
Add the missing organization check to the job-signatures DELETE route so a signature can only be deleted within its own org. Test: cross-org delete refused.

## Task 7 — B7: callback scheduling fields
Callbacks are created with `scheduledStartAt` set but no `scheduledFor`, so they surface inconsistently. Align: when a callback gets a start time, `scheduledFor` is set from it (same day semantics as jobs). Test both fields land together.

## Task 8 — B12: importer closeout_mode
The SF importer never sets `closeout_mode`, leaving imported jobs on the default regardless of their shape. Set it on import using the same rule the app applies to new jobs. Importer test with a fixture job.

## Task 9 — "Completed today" tile link
The Dashboard tile count is date-correct (#321) but its link lands on the unfiltered jobs list. Make the link land on the jobs list filtered to today's completions (the same date rule the count uses, company timezone). Test the link target carries the filter.

## Task 10 — #325 re-cut: boundaries only
Re-cut PR #325 as loading/error boundaries ONLY. Do NOT restore any `<Link>` navigation — the hard-nav `<a href>` exits out of /jobs/[id] (#324/#326) stay exactly as they are; #325's tap-test failure was the Link restore. Suite + build green, and note in the PR body that no navigation elements changed.

## Task 11 — #291 tab badge + #289 nits (Collin decision: fix)
Resolve the tab-badge count discrepancy noted on PR #291 and the remaining nits from PR #289, per those PR threads. If a nit turns out to be intended behaviour, flag it on #337 rather than changing it silently.

## Task 12 — Security lows bundle (S6–S9)
One hardening PR: constant-time comparison for token compares; a rate limit on the token/portal routes; a size cap on CSV import; server-side MIME verification on uploads instead of trusting the client's file.type. Keep each change small and tested. Zod coverage expansion is explicitly OUT of this PR.

## Task 13 — AGENTS.md role-drift fix (docs only)
Correct the role-resolution bullet in AGENTS.md: role resolution is `user_profiles.app_role` FIRST, `app_metadata.app_role` as fallback; `raw_user_meta_data`/`user_metadata` is NEVER read. (Verified in `src/features/auth/utils/appRole.ts` + `src/lib/api-auth.ts`.)

## Order inside the batch
B8 first (separate brief). Then Tasks 1–3 (Collin's fresh decisions), then 4–9 in any order, 10–13 last. Flag anything that turns out bigger than it looks on #337 before expanding scope.
