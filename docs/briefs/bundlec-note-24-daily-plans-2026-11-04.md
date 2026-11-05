# #24 Daily Plans — brainstorm (roster, day shape, print, who edits)

| | |
|---|---|
| Audience | Collin (decision) |
| Repo / commit | `github.com/Sevorcer/loop` @ `955fa1a` |
| Live check | Supabase `sygdurkefkasgfefvfcs`, Wed Nov 4, 2026 PT — read-only |
| Scope | Design note only. No builds. |

## Plain-English summary

**Already decided:** the Daily Plans roster is **people who are on that day's jobs**, grouped under their crew when a crew record matches; everyone else is a floater. That matches the code in `buildDailyCrewRoster`.

**Go further:** treat Daily Plans as the **office morning handout + assignment desk** — one page that shows **every job for the day at once** (time, customer, techs), with a print view for the shop board / truck packets. Dispatch stays the working board for moves during the day. Command Center stays the "what's on fire" wall. Who edits: office + dispatch (+ manager/owner); techs read a future packet view only.

---

## 1. What the page does today (code)

Screen: `src/features/daily-plans/screens/DailyPlansScreen.tsx`.

1. **Morning Briefing** — counts for today: total, assigned, unassigned, at-risk, active crews.
2. **Needs Attention** — from today's jobs + unscheduled backlog.
3. **Crew Status** — roster built from `/api/field-roster` + today's `assignedTo` names (`CrewStatusPanel` + `buildDailyCrewRoster`).
4. **Schedule sections** — Today, Upcoming (by date), Unscheduled. Cards can reschedule and assign one technician name.

Supporting tables (live counts):

| Table | Rows | Role |
|---|---:|---|
| `crews` | 4 | Named crews with lead, members JSON, truck_name, availability |
| `crew_assignments` | 0 | Unused so far (dispatch-plan ↔ crew link) |
| `daily_plan_activations` | 2 | "Start the day" status |
| `daily_plan_notes` | 0 | Day notes (unused in practice) |
| `daily_plan_job_overrides` | 0 | Manual readiness overrides |
| `job_assignees` | 1,834 | Multi-tech assignment rows (8 distinct users) — **not what Daily Plans uses** |

Daily Plans assignment UI writes the single string `jobs.assigned_to`, not `job_assignees`. Dispatch has been moving toward multi-person assignment. That mismatch is the biggest product footgun on this page.

Live "today" snapshot (company date; box was evening of Nov 4 PT / DB `CURRENT_DATE` showed Nov 5 UTC jobs): **3** jobs Scheduled, **0** with `assigned_to` filled, **0** `job_assignees` on those rows. Crew Status correctly says "No one is assigned to jobs today."

---

## 2. Already decided (keep)

- Roster = people appearing on that day's jobs only (don't list the whole company).
- Group by crew when lead/members match a `crews` row; otherwise "Also working today" floaters.
- Do not invent truck / availability / departure for floaters.
- Crews are **ad-hoc labels** for grouping; real assignment is **individuals**, and a job can have **multiple techs**.

---

## 3. Day shape (proposed)

Think of three bands on one scrollable page (and the same three on print):

### A. Day header (office + dispatch)

- Date picker (today default).
- Weather line optional later — types already imagine it; live data doesn't need it for MVP.
- KPI strip (keep): jobs today · assigned · unassigned · in progress · on hold · people working.
- Primary actions: **Activate day** (already modeled), **Print handout**, **Mark packets sent**.

### B. All jobs for the day (office's #1 ask)

One dense table or timeline — **not** only card stacks — columns:

| Time | Job # | Customer / site | Type | Status | Techs | Truck / crew |

- Sort by `scheduled_start_at` (fallback appointment window, then job number).
- Show **every** tech from `job_assignees` (names), not only `assigned_to`.
- Click row → job. Inline: add/remove person, drag date only if role allows.
- Empty state when zero jobs: "Nothing on the calendar for this day — pull from Unscheduled or open Dispatch."

Cards can remain as a mobile layout; desktop should prefer the all-jobs table because office wants the whole day visible without scrolling past Upcoming/Unscheduled first.

### C. People / crew strip

Keep Crew Status, but drive job counts from multi-assignee data. Under each crew: list that crew's jobs for the day (time + customer) so a lead can see the run.

### D. Side rails (keep, lower)

- Needs Attention (permits, missing assign, at-risk).
- Unscheduled backlog (collapsed by default on the print view).
- Upcoming (next 2–3 days) — planning, not the morning handout.

---

## 4. Print / handout view

**Purpose.** Something the office can print at 6:30am for the wall and for each truck.

**One-pager contents.**

1. Title: "Daily Plan — {weekday, date}".
2. Full job table (time, customer, address, techs).
3. Crew blocks: lead + helpers, truck name, their job numbers in order.
4. Notes box from `daily_plan_notes` (office-entered).
5. Footer: "Packets sent: yes/no · Activated: timestamp".

**Out of scope for v1 print:** live status colors, map, materials checklist (link QR to job later).

**Implementation hint (when built):** CSS `@media print` on a `/daily-plans/print?date=` route; no new tables required beyond notes/activation already in schema.

---

## 5. Who edits what

| Action | Owner | Manager | Office | Dispatch | Tech | Sales |
|---|---|---|---|---|---|---|
| View Daily Plans | ✓ | ✓ | ✓ | ✓ | — (today) | — |
| Assign / unassign people | ✓ | ✓ | ✓ | ✓ | — | — |
| Reschedule date | ✓ | ✓ | ✓ | ✓ | — | — |
| Day notes / activate / packets | ✓ | ✓ | ✓ | ✓ | — | — |
| Read printed packet / own jobs | — | — | — | — | future read-only | — |

Nav today (`navPermissions`): Daily Plans → owner, manager, dispatch, office. That matches the edit set above. Techs should not edit the company day plan from this screen.

**Conflict rule with Dispatch:** same underlying jobs. Last write wins on assignees; Daily Plans should call the same assign API Dispatch uses (`job_assignees`), not a parallel `assigned_to`-only path.

---

## 6. Gaps vs the decided model (fix list for a later build)

1. Multi-tech: wire roster + Today table to `job_assignees`.
2. Time column: surface `scheduled_start_at` / window on the day list (cards currently omit time).
3. Print route + packets-sent workflow made visible.
4. Stop loading **all** workspace jobs client-side (TODO already in `DailyPlansScreen`); fetch today + small upcoming window.
5. Decide whether `crew_assignments` stays unused or becomes the link from a day's plan to Dispatch — recommendation: **leave unused**; derive crews from people on jobs + `crews` membership.

---

## 7. Decision ask for Collin

1. Confirm desktop **all-jobs table** (time / customer / techs) as the primary Today view.
2. Confirm print handout is worth a first build pass (yes/no).
3. Confirm Daily Plans assign must use the same multi-person assign as Dispatch.
