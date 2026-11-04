# Brief for Claude — Phase 3: Permits & Inspections (scoping complete 2026-11-04)

From Zoinks. Scoping source: Zowe's own email answers (2026-11-04), summarized below — build to HER workflow, not to a generic model. Collin's standing decisions: **track only** (LOOP sends nothing), **failed inspections show only** (never block closeout), **permit # is NOT required** before an inspection can be requested. One PR per task, do not merge, do not apply migrations, `npm run build` + full suite green before reporting ready. Questions on issue #337.

## How it works today (Zowe's answers)
- Zowe pulls ALL permits herself. Permit numbers live in **her Excel sheet of pulled permits** — that sheet is the field reference: mirror its columns (same rule as Karl's GC sheet). There is also a standing **EL permit** covering residential and commercial.
- Inspections are tracked **only on her cubicle wall calendar**. No system exists.
- Supers/GCs book their own inspections **when covered under their permit**; otherwise Zowe schedules.
- Corrections reach her four ways: the city reaches out, the GC tells her, the customer tells her, or she checks herself **the following day**. She relays corrections to Collin, who tells the crew.
- The stuck-permit pattern: **Seattle Mechanical permits** (condos/duplexes/commercial) — apply → schedule an intake appointment → corrections → complete + resubmit + schedule intake AGAIN → pass intake → another review round → possible second corrections round (that time you wait for the city to reach out; you don't schedule). Other cities in play (Kirkland, Mountlake Terrace, Bothell) call all HVAC permits "Mechanical"; Seattle splits **Mechanical** vs **Single-Family/Duplex** (normal house).
- Her biggest grief is **pulling permits**, not scheduling. Cities also sometimes **reschedule inspections without notifying her**.

## Task 1 — Permit records (migration expected; write it, don't apply)
A permit belongs to a job (and a job can have several). Fields mirror Zowe's sheet — at minimum:
- Jurisdiction (city), permit type (jurisdiction-aware: Seattle → Mechanical / Single-Family-Duplex; other cities → Mechanical), permit # (nullable until issued).
- Status pipeline matching Seattle's real loop: `applied` → `intake_scheduled` → `corrections_needed` → `resubmitted` → `issued`, plus `waiting_on_city` for the rounds where the city drives. Keep the pipeline usable for simple cities too (applied → issued).
- Dates: applied, intake appointment, issued; a corrections note per round; a free notes field.
- The standing EL permit is NOT a job permit — don't model it as one; a job permit may reference "under EL" as its type/coverage if the sheet shows that pattern (flag on #337 if unclear).
- On the job page: a Permits section (office-and-above edit; techs read-only).
- Removal is a **void**, never a hard delete (Collin, 2026-11-04): office-and-above can void a permit — it leaves the permits board and the job's active list, carries a voided timestamp (and who voided it, through the usual audit fields), and stays recoverable/un-voidable by office-and-above. Same soft pattern as job soft-delete. Voided permits never block anything.

## Task 2 — Inspection records on the job
- Fields: inspection type (rough-in / cover / final / other), scheduled date + window, **booked_by** (Office / GC or Super / Customer — her workflow has all three), inspector name when known, result (`scheduled` / `passed` / `failed` / `partial` / `rescheduled_by_city`), result date.
- `rescheduled_by_city` is a first-class result — it captures her "they move it without telling me" grief, and the new date gets entered when she learns it.
- Corrections from a failed/partial inspection become a **corrections list on the inspection** that feeds the job's existing checklist system (don't build a second checklist silo): each correction is a checkable item; completing corrections is what readies the re-inspection, which is a new inspection record linked to the first.
- Inspections exist independently of permit state (Collin's decision 7): a job with no permit # can still carry inspections.

## Task 3 — Office views (this replaces the wall calendar)
- **Permits board:** all open permits grouped by status, with days-in-status shown; anything sitting in `corrections_needed` / `waiting_on_city` / intake loop surfaces at the top — the stuck ones are the point.
- **Inspections week view:** this week's scheduled inspections across jobs (date, job, type, booked_by) — the wall calendar, in LOOP.
- **Awaiting result:** inspections whose date has passed with no result recorded — with the next-day check being her habit, yesterday's unresulted inspections lead the list.

## Task 4 — Import Zowe's permit sheet
- A one-time importer (pattern after the SF importer) that reads her Excel sheet of pulled permits and creates permit records matched to jobs. Column mapping gets confirmed against the actual sheet before this task is finalized — **flag on #337 when you're ready for the sheet; Collin supplies it.** Until then, build Tasks 1–3 against the fields above.
- Imported permits land with their real status/dates where the sheet has them; unmatched rows are reported, never silently dropped.

## Out of scope
Any outbound sending (booking emails/calls), closeout gating on inspections, GC-portal visibility of permits/inspections (portal money toggle is job money only), permit-fee/cost tracking (add only if her sheet already tracks it — mirror, don't invent).
