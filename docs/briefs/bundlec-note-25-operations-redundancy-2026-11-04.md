# #25 Operations tab redundancy — audit + keep / merge / cut

| | |
|---|---|
| Audience | Collin (decision) |
| Repo / commit | `github.com/Sevorcer/loop` @ `955fa1a` |
| Live check | Code paths on main + live row counts, Wed Nov 4, 2026 PT |
| Scope | Design / IA note only. No builds. |

## Plain-English summary

The sidebar **TODAY** group currently offers Command Center, Dispatch, Daily Plans, Calendar, **and** an **Operations** hub that mostly repeats links to those same places. **Live Operations is already parked** — the route redirects to Dispatch because it still runs on mock data. Recommendation: **cut the Operations hub from the nav** (or demote it), **keep Command Center + Daily Plans + Dispatch + Calendar** as the real trio, and **do not revive Live Operations** as a fourth app until it reads real jobs/crews. Fold any "live day" widgets into Dispatch or Command Center instead.

---

## 1. What each surface actually is (code)

| Surface | Route | Real data? | Job in one sentence |
|---|---|---|---|
| **Operations Home** | `/operations` | N/A (links only) | Launcher cards + `OperationsNavBar` pointing at Command / Daily Plans / Live Ops / Dispatch |
| **Command Center** | `/command-center` | Yes — `getCommandCenterSnapshot()` | Always-on manager wall: KPIs, today's jobs, in progress, on hold, inspections, callbacks, unassigned, late, crew load, problem jobs |
| **Daily Plans** | `/daily-plans` | Yes — jobs + field roster | Morning prep: briefing, needs attention, crew roster, today/upcoming/unscheduled assign & reschedule |
| **Dispatch** | `/dispatch` | Yes — dispatch plans + jobs | Working board: who is on each job, readiness chips, schedule placement, events |
| **Live Operations** | `/live-operations` | **No** — `getMockLiveOpsSnapshot()`; page **`redirect(ROUTES.DISPATCH)`** | Was meant to be mid-day live board; parked 2026-09-30; hidden from sidebar |
| **Calendar** | `/calendar` | Yes | Multi-day schedule / time-off / tasks |

Sidebar (`sidebarNav.ts` TODAY group): Dashboard, Command Center, Dispatch, Daily Plans, Calendar, Operations. Live Operations commented out.

Operations home copy still advertises four "phases" including Live Operations even though that URL bounces to Dispatch — a trust problem.

---

## 2. Overlap map (what duplicates what)

| Concern | Command Center | Daily Plans | Dispatch | Live Ops (parked) | Operations Home |
|---|---|---|---|---|---|
| Today's job list | Widget | Today section | Board cards | Mock | Link only |
| Unassigned / at-risk | Widgets | Needs Attention + KPIs | Queue metrics | Mock "Needs Attention" | — |
| Crew / people load | Crew workload widget | Crew Status roster | Person chips / crew day board | Mock ActiveCrewBoard | — |
| Assign people | No (read) | Yes (via `assigned_to`) | Yes (primary) | — | — |
| Mid-day exceptions | Problem / late / on hold | Partial | Events + board | Mock DecisionFeed | — |
| Activate morning | — | Activation model | — | Gated on activation | — |
| Orientation / IA | — | — | — | — | **Only unique job** |

**Unique value today**

- **Command Center:** read-only situational awareness across many risk buckets in one glance.
- **Daily Plans:** morning-shaped planning + roster + backlog sections + activation/notes schema.
- **Dispatch:** mutable board and readiness for putting work in motion.
- **Operations Home:** none beyond navigation. Calendar already covers multi-day.

**Dead / harmful**

- **Live Operations:** mock data, redirect, still linked from Operations Home and `OPERATIONS_NAV_ITEMS`.
- **Operations Home:** extra click to reach tools that already have sidebar entries.

---

## 3. Recommendations (keep / merge / cut)

| Item | Verdict | Reason |
|---|---|---|
| **Command Center** | **Keep** | Real live snapshot; different job (monitor) from Dispatch (act) and Daily Plans (prepare). |
| **Daily Plans** | **Keep** (reshape per #24) | Morning handout + all-jobs-for-day desk; office-facing. Don't merge into Dispatch or you lose the calm morning layout. |
| **Dispatch** | **Keep** | System of record for who/when during the day. |
| **Calendar** | **Keep** | Multi-day / time-off; not redundant with Daily Plans. |
| **Operations Home (`/operations`)** | **Cut from sidebar** (optional keep URL as redirect to Command Center or Daily Plans) | Pure launcher; duplicates TODAY links; teaches a fake "phase" story. |
| **OperationsNavBar on child pages** | **Cut** | Same redundancy; each page already has the shell sidebar. |
| **Live Operations** | **Cut / leave parked** | Do not un-hide until real data. Any useful widgets (active crews, exception feed) should be **merged into Dispatch same-day header or Command Center**, not a fourth app. |
| **"Morning Operations" naming** | **Rename back to Daily Plans** everywhere in Operations copy | Sidebar already says Daily Plans; Operations Home saying "Morning Operations" splits the brand. |

### Proposed TODAY sidebar (after cut)

1. Dashboard  
2. Command Center  
3. Daily Plans  
4. Dispatch  
5. Calendar  

(Order can follow role presets: dispatchers put Dispatch first; owners put Command Center first — already partially done.)

---

## 4. If Collin still wants one "Operations" word

Prefer a **single landing** that *is* Command Center (rename label to "Operations" only if needed), not a hub of hubs. Do not keep both "Operations" and "Command Center" as separate destinations.

---

## 5. Decision ask for Collin

1. OK to remove **Operations** from the sidebar and treat Command Center / Daily Plans / Dispatch as the three pillars?
2. Confirm Live Operations stays dead (redirect) until a real-data rewrite is scheduled.
3. Prefer Command Center title as-is, or rename it "Operations"?
