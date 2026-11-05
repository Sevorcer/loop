# Claude brief — live-fix round (2026-11-04)

From Zoinks, at Collin's direction ("All of them, let's have Claude do it").
Source: the post-merge live check + Zoinks' independent verification against the
production database (REST) and this repo. One PR per fix. Every PR: `npx tsc --noEmit`
clean + full Vitest suite green before it's called ready. Merges wait for Collin's
word. **Do not invent schema** — where a mapping below says "verify," check the live
OpenAPI schema / an actual REST select before writing the query. The recurring
failure mode in this codebase is code written against an imagined schema while the
tests mock the database; this round exists because of it.

## Fix 1 — portal data service queries the real schema (PRIORITY)

`src/services/portalJobData.ts` (`getPortalJobData`) selects fields that do not
exist. Verified live (each select below returns a Postgres error today):

- `jobs`: selects `scheduled_date, completed_date` — **neither exists**. Real date
  fields: `scheduled_for`, `scheduled_start_at`, `scheduled_end_at` (`scheduled_for`
  is what the rest of the app treats as the job date). There is **no** completed-date
  column on jobs; find how the app itself derives completion display (status +
  activity) and mirror that — do not add a column.
- `job_activity`: selects `activity_type` — real column is **`type`** (`description`
  and `title` also exist).
- `job_assignments`: **table does not exist**. Assignments live in **`job_assignees`**
  (`job_id`, `user_id`) — the same table `src/repositories/jobs.ts` reads; crew names
  come from `user_profiles.full_name`. (`jobs.assigned_user_id`/`assigned_to` also
  exist if a primary tech is wanted.)
- `property_photos`: selects `caption`; `property_documents`: selects `name`. Both
  tables exist but are **empty**, and job photos/documents actually live in the job
  files system the rest of the app uses (job photos table + job-files storage — find
  what the job page renders). Verify the real columns via OpenAPI; if the portal
  should show the job's real photos/docs, source them from there. If a section has no
  real source, render it empty honestly rather than querying a phantom field.

**Acceptance:** every select in the rewritten service must be one Zoinks can run
verbatim against production REST without an error (the five failing selects above
are the regression set). Add a test that pins the select strings to the real column
lists so this cannot silently regress behind mocks again.

## Fix 2 — builder roll-ups undercount (data linkage + SQL script)

GC Overview shows McBride as 3 properties / 1 open job; reality is ~49 sites and 7
open jobs. Cause (verified): 48 customers carry the McBride name, but most site
customers are **standalone records with `parent_customer_id` NULL** — the roll-up
only counts linked children. Same pattern exists for the other builders
("Better Builders", "Blue Sound Construction", "Jonathan David Building Company",
"Doran Construction", "Exalt Services"), in both long form ("<Builder> - <Site>")
and short form ("McBride - 2115", "Blue Sound - Branham").

Deliverable: an **idempotent SQL script** (Zoinks applies it via the SQL Editor —
you have no production write path) that sets `parent_customer_id` for site customers
matching a canonical parent by the naming patterns above, plus a **dry-run report**
query that lists every proposed link and every ambiguous case it refuses to guess
(name collisions, sites matching two parents). Do not relink customers that already
have a parent. After the links land, the existing roll-up code should be correct —
if it isn't, say so in the PR rather than patching the display.

## Fix 3 — permits board polish

`src/features/permits/screens/PermitsBoardScreen.tsx`:
- Age (`dis()`) currently counts days since `updated_at`/`created_at`. For permits
  it should age from **`applied_at`** when present (imported permits were applied
  months ago; row-creation date makes them all read 0d), falling back to created_at.
- Rows with blank `jurisdiction`/`permit_type` render as " — ". The 103 imported
  permits have both empty (Zowe's tracker doesn't carry them as fields). Fall back
  to a useful title (permit number, then the job's customer/property name) when both
  are blank.
- Follow-up data task (script, same delivery style as Fix 2): derive `permit_type`
  from the permit-number suffix where the imported number carries one —
  `-ME`, `-RF`, `-FR`. **Do not guess the expansion of the suffixes in code or data
  yet**; make the suffix→type map a single small config with the three suffixes
  stubbed, and flag it in the PR description for confirmation (Zowe/Collin confirm
  what FR/RF/ME stand for on Seattle/Kirkland permits before values are written).

## Fix 4 — remove the QA test account (SQL script)

A profile named **"QA Test Tech — DELETE ME"** (user_profiles id
`02ecdfe5-7541-482c-803a-bd770104de17`, created 2026-10-06) still appears in
dispatch/calendar people filters. Deliverable: SQL script for Zoinks to run that
removes the profile and any dangling references (check `job_assignees`, dispatch
rosters, crew assignments) and notes whether a matching `auth.users` row exists
(Zoinks deletes that in the dashboard if so). Also grep the repo for any seed/mock
that recreates it and remove that if present.

## Fix 5 — PR #369 unblock

`src/app/api/customers/[id]/gc-ledger/route.ts` line 50: TS2352 — the
`parent_customer_id` cast is unsafe. Convert through `unknown` first
(`as unknown as <type>`), or type the row properly. This is the only tsc error on
that branch; the suite is already green. After the fix, #369 is ready for Collin's
merge word.

## Fix 6 — investigate, fix only what's reproduced

The live check ran while production was still serving a half-merged build
(deployments errored until the manual bf702f2 deployment at 16:01 PST), so these
may already be gone. Reproduce each against current production code first; fix what
reproduces, and report plainly what doesn't — no speculative rewrites.

- Completed jobs showing $0 price while `job_financials.revenue_cents` holds real
  data (that table feeds the dashboard's $4.47M). Find where the job page / money
  screens read price from and why imported jobs read 0.
- Reports screen: revenue never finishes loading.
- Customer pages taking >10s; a blank "allowance" field on some customers.
- GC Overview hanging on "Loading builders…".
- Jobs page header counts reading 0; a jobs-feed server error seen from calendar.

## Housekeeping

- `npm run lint` baseline: **17 errors, 23 warnings**. Fix the 17 errors in a
  chore PR; warnings optional.
- GitHub Actions billing lock: known and standing — not yours to fix; the red
  required check is expected.
- Supabase advisor minor tightenings: list them in the PR description if you spot
  specifics; do not change security settings unilaterally.

## Explicitly NOT defects (do not "fix")

- Portal submission endpoint is public **by design** (Collin's ruling): the share
  token is the credential, resolved server-side, rate-limited 5/token/15min.
- Ready to Bill starting empty is by design; it fills as jobs complete going
  forward.
- Contractors list is empty because the `contractors` table has zero rows —
  no code change; noting it is enough.
