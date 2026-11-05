# Bundle B — Claude (GC Portal v2 + core UI builds)

Source: Collin's live-review list, 2026-11-04 night.
Rules: verify every query against the LIVE schema before writing it (portal v1 shipped against an imagined schema — do not repeat that); job statuses are Title Case in production; `npx tsc --noEmit` + full suite + production build must pass before a PR is called ready; ONE push per branch (Vercel 100/day cap); PRs PREPPED ONLY — no merges without Collin's word. Collin reviews mocks first for big layout work (#11, #21).

## Lane 1 — Change orders (new entity; do first — portal and layout depend on it)
- **#5/#10** New `job_change_orders` table (migration + verify): id, org_id, job_id, title, description, amount_cents, status (proposed/approved/declined), created_by, approved_at, timestamps; RLS org isolation like other job tables; authorization matrix entry (office+ manage).
- Job Detail: manage change orders from the **Job Price area**: list + add/edit + status control. Approved COs roll into a "price + approved change orders" total displayed next to the job price.
- API routes with permission guards whose results are RETURNED (the #378 lesson).

## Lane 2 — GC Portal v2 (extends src/services/portalJobData.ts + /gc-portal/[token])
All new sections are PER-JOB TOGGLES set by office on the Job Detail GC Portal card, defaulting OFF except where noted; extend the portal settings pattern (portal_money_visible is the model). Sections:
- **#3 Photos** — serve the job's non-signature photos; toggle `portal_photos_visible`.
- **#6 Permits & inspections** — permit #/type/status + latest inspection (type, date, result, corrections count) from job_permits / job_inspections; PLUS a **digital copy**: permit records gain a document attachment (upload on JobPermitsCard / permits board; storage bucket + signed URL), downloadable from the portal when present.
- **#7 Progress timeline** — milestones from job_activity status entries (Scheduled → In Progress → Completed) with dates; read-only.
- **#4 Estimate** — the job's bid (amount + status) when the existing money toggle is ON.
- **#9 Billing snapshot** — invoiced / paid / balance from job_financials + invoices + payments when money toggle is ON. Reuse the #386 financial composition; the portal must NEVER see financials when the toggle is off (payload omits, not just hides).
- **#5 CO list** — change orders (title, amount, status) shown; amounts only when money toggle is ON, titles/status always (when CO section enabled).
- Keep the triage-queue submit form as-is.

## Lane 3 — Job Detail layout overhaul (#11)
- Collin: "in overview the boxes of things just RUNS down the right side — we really need to look at the entire layout." Mock first (he reviews before build): rebalance the overview into a real grid; right rail stops being a single-file column. Keep every existing card working (incl. the GC Portal + Financial Detail sections).

## Lane 4 — Dashboard + Command Center (#18/#20/#21/#22)
- Quick Actions move to the TOP, slim; replace the Total Properties / Active Jobs / New Customers stat tiles with them (Collin's suggestion). Coordinate with Zoinks' #19 finding before fully removing New Customers.
- "Needs attention" jobs become clickable links to the job.
- Command Center stat bar (Scheduled Today → Avg Completion): stop making every tile a generic link to Jobs; give each tile its own meaningful destination or make non-interactive.

## Lane 5 — Inspections add-from-tab (#31)
- From the Inspections tab: create an inspection — select the job, full scheduling (type, date/time, booked_by), assign techs, and it auto-fills onto the schedule/calendar (verify which tables the calendar/dispatch read before wiring).

## Lane 6 — Phase 2 permissions editor (#28)
- Collin, verbatim: "Settings i cant edit roles and permissions nor can i assign specific people perms." Build the designed Phase 2: DB-backed overrides layered over the code matrix in authorization.ts, editable grid in Settings → Roles, owner-only editing, owner row locked ON, empty-set invariants preserved (append-only tables stay denied to everyone). Per-user overrides (grant/deny above role) are in scope. Migration + verify + tests for the layering order.
