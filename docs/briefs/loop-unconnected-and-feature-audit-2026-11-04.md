# LOOP — Unconnected Code Census + Feature Inventory + Audit Request

**Date:** 2026-11-04 · **Tree:** main @ 5141e5c (production) · **Requested by:** Collin
**Authors:** Part A + B by Zoinks. Part C is the ask for Claude: do your own dive and answer in this file's thread (issue #337) or a companion PR.

Why this exists: on 2026-11-04 Collin opened a job page and found no share-link button.
The `ShareLinkControls` component had been built (PR #363) but never mounted anywhere.
That raised the obvious question — how much else is built but not connected? This is
Zoinks' static answer, plus a full feature inventory, plus a request for Claude's
independent audit so the two lists can be reconciled.

---

## Part A — Zoinks: files not connected to the running app (92 of 773)

Method: import-graph reachability from every app entry point (all `src/app/**`
pages, layouts, and API routes, plus middleware/instrumentation) over the production
tree. A file is "not connected" if no chain of imports from any entry reaches it.

Caveats, in fairness:
- Script-only code counts as unconnected to the *app* (e.g. `lib/sf-import/*` and
  `lib/permit-import/parse.ts` are used by CLI import scripts, not the web app).
- Test-only code counts too (`testing/dbSeedFixtures.ts`, mock data used by tests).
- ramework-loaded files can false-positive: my first pass flagged `proxy.ts` and `lib/auth/routeccess.ts`; a hardened re-run (all app convention files + proxy as roots) cleared both — they are live, and the count dropped 94 → 92. isted here so laude/rok can check my correction.
- "Not connected" ≠ "broken" — but every file here is maintained, reviewed, and
  test-covered weight that no user ever touches.

### The portal trio — promised features with no UI path (fix first)
- `features/jobs/components/ShareLinkControls.tsx` — create/revoke GC share links
- `features/jobs/components/PortalMoneyToggle.tsx` — per-job portal money switch
- `features/jobs/components/PortalSubmissions.tsx` — office triage queue UI

### Full list, grouped

**admin (5)**
- features/admin/components/organizations/CreateOrganizationDialog.tsx
- features/admin/components/organizations/DeactivateOrganizationDialog.tsx
- features/admin/components/organizations/EditOrganizationDialog.tsx
- features/admin/components/organizations/OrganizationsClient.tsx
- features/admin/components/organizations/index.ts

**company-brain (2)** — both mock data
- features/company-brain/data/mockKnowledgeRelationships.ts
- features/company-brain/data/mockKnowledgeUsage.ts

**customers (2)**
- features/customers/data/mockCustomerDetails.ts
- features/customers/state/CustomersProvider.tsx

**daily-plans (12)**
- features/daily-plans/components/ActivationDialog.tsx
- features/daily-plans/components/ActiveOperationsBanner.tsx
- features/daily-plans/components/AlertsBanner.tsx
- features/daily-plans/components/CrewSection.tsx
- features/daily-plans/components/DayNavigator.tsx
- features/daily-plans/components/DayTimeline.tsx
- features/daily-plans/components/MorningOperationsHero.tsx
- features/daily-plans/components/OperationalReadiness.tsx
- features/daily-plans/components/PlanJobCard.tsx
- features/daily-plans/components/PlanningNotes.tsx
- features/daily-plans/components/ReadinessSummary.tsx
- features/daily-plans/data/mockMorningOperations.ts

**dashboard (1)**
- features/dashboard/MetricCard.tsx

**dispatch (7)** — 5 are mock data
- features/dispatch/components/CrewScheduleCard.tsx
- features/dispatch/data/mockCrewAssignments.ts
- features/dispatch/data/mockCrews.ts
- features/dispatch/data/mockDispatchEvents.ts
- features/dispatch/data/mockDispatchPlans.ts
- features/dispatch/data/mockScheduleBlocks.ts
- features/dispatch/state/DispatchProvider.tsx

**gc-portal (1)**
- features/gc-portal/index.ts (barrel only)

**installed-systems (1)**
- features/installed-systems/components/InstalledSystemDetailPageClient.tsx

**jobs (4)**
- features/jobs/components/PortalMoneyToggle.tsx
- features/jobs/components/PortalSubmissions.tsx
- features/jobs/components/ShareLinkControls.tsx
- features/jobs/data/mockJobActivity.ts

**lib (19)**
- lib/auth/unauthorized.ts
- lib/dbHealthCheck.ts
- lib/driftParser.ts
- lib/loop-api-client.ts
- lib/permit-import/parse.ts (script-used)
- lib/security/index.ts
- lib/sf-import/address.ts (script-used)
- lib/sf-import/constants.ts (script-used)
- lib/sf-import/dates.ts (script-used)
- lib/sf-import/index.ts (script-used)
- lib/sf-import/json.ts (script-used)
- lib/sf-import/linkCustomers.ts (script-used)
- lib/sf-import/money.ts (script-used)
- lib/sf-import/plan.ts (script-used)
- lib/sf-import/report.ts (script-used)
- lib/sf-import/schedule.ts (script-used)
- lib/sf-import/scope.ts (script-used)
- lib/sf-import/status.ts (script-used)
- lib/sf-import/techs.ts (script-used)

**live-operations (12)** — an entire screen tree; the routed Live Ops page does not use it
- features/live-operations/components/ActiveCrewBoard.tsx
- features/live-operations/components/DecisionFeed.tsx
- features/live-operations/components/LiveOpsHero.tsx
- features/live-operations/components/MilestoneProgress.tsx
- features/live-operations/components/NeedsAttention.tsx
- features/live-operations/components/OperationalHealth.tsx
- features/live-operations/components/OperationalTimeline.tsx
- features/live-operations/data/mockLiveOps.ts
- features/live-operations/index.ts
- features/live-operations/screens/LiveOperationsScreen.tsx
- features/live-operations/types/liveOps.ts
- features/live-operations/utils/liveOpsUtils.ts

**project-portal (15)** — the OLD portal feature's internals (legacy /portal/[projectId]
routes still exist; see Part B)
- features/project-portal/adapters/eventProjection.ts
- features/project-portal/adapters/fakeAdapters.ts
- features/project-portal/adapters/mockAdapters.ts
- features/project-portal/auth/portalAuth.ts
- features/project-portal/components/PortalNav.tsx
- features/project-portal/data/mockEvents.ts
- features/project-portal/data/mockPortalUsers.ts
- features/project-portal/data/mockProjects.ts
- features/project-portal/index.ts
- features/project-portal/runtime/checkpoints.ts
- features/project-portal/runtime/eventValidation.ts
- features/project-portal/runtime/idempotency.ts
- features/project-portal/runtime/projection.ts
- features/project-portal/runtime/replayHarness.ts
- features/project-portal/runtime/rollout.ts

**properties (1)**
- features/properties/screens/index.ts (barrel only)

**reporting (4)**
- features/reporting/components/HealthIndicatorCard.tsx
- features/reporting/components/KpiCard.tsx
- features/reporting/components/ScorecardSection.tsx
- features/reporting/utils/uiState.ts

**settings (1)** — notable: a full SettingsScreen that no route renders
- features/settings/SettingsScreen.tsx

**other (5)**
- components/atlas/DataTable.tsx
- config/nav.config.ts
- services/adminPolicy.ts
- services/supabaseContext.ts
- testing/dbSeedFixtures.ts

---

## Part B — Zoinks: feature inventory (what it does / why it exists / status)

| Feature | What it does | Purpose | Status |
|---|---|---|---|
| Jobs | Create/edit jobs, multi-tech assignment, multi-day scheduling, statuses, closeout modes (full/visit) with photo + note gates | The core unit of work everything else hangs off | Live |
| Job detail | Timeline, photos, notes, checklists, inspections card, bids panel, contacts | One place to run a job end to end | Live — minus portal controls (Part A) |
| Calendar | Month/week views, drag to reschedule (incl. multi-day) | See and move the schedule | Live (drag shipped in B8) |
| Dispatch | Board of crews/jobs by day, drag assignment | Daily crew planning | Live |
| Daily Plans | Day roster of assigned people grouped by crew, day plan view | Morning huddle sheet | Live (roster rule: only people on that day's jobs) |
| Customers | Parent/child hierarchy (builders → sites), contacts (office-gated delete) | Who we work for; builder roll-ups depend on this | Live |
| Properties | Site records tied to customers and jobs | Where the work happens | Live |
| Installed systems + warranty | Per-system records; office marks warranty registered | Track what's in the ground and its warranty state | Live |
| Checklists / QA | Per-job checklists; anyone can add, office+ removes | Field quality gates | Live |
| Photos / notes / timeline | Job media + activity log (incl. 1,207 SF-imported photos) | Proof of work, job history | Live |
| Roles & permissions | owner/manager/office/dispatch/tech/sales with server-side route guards; office has unrestricted shell access (Collin's ruling) | Right people see/do the right things | Live |
| Dashboard / Today | KPIs, today's jobs, recent jobs | Morning snapshot | Live |
| Command Center | Operational roll-up view | Owner-level situational awareness | Live |
| Production report + tech scorecards | Output and per-tech performance reporting | Manage crews with numbers | Live |
| GC Ledger | Per-builder ledger mirroring Karl's workbook columns + roll-ups | Track builder balances/work | Live |
| GC Overview | Builder list with real Sites / Jobs / Open counts (fixed in #379) | Pick a builder, see their footprint | Live |
| GC Portal (GC-facing) | Public page at /gc-portal/[token]: job status, timeline, photos; money only if the job's toggle is on; submit form (name+company required) | Let GCs self-serve job info and raise issues without logins | Live page; data fixed 2026-11-04 |
| GC Portal (office side) | Share-link create/revoke, money toggle, submissions triage queue (accept/dismiss) | Office controls what each GC sees | **NOT WIRED — components built, never mounted (Part A)** |
| Permits board | Permit list w/ status flow (applied → … → issued), void-not-delete, age from applied date | Replace Zowe's wall calendar + Excel (103 permits imported) | Live |
| Inspections | Week view, booked_by source, city-reschedule flag, corrections table; never blocks closeout | Track inspections + corrections | Live |
| Permit CSV importer | Script that parses Zowe's tracker format w/ dry-run | Bulk-load permit history | Script-only, works |
| Ready to Bill | Jobs that hit Completed, split Install/Service; office marks billed w/ QuickBooks invoice # | Bridge to QuickBooks (invoicing stays in QB by design) | Live; starts empty by design |
| Bids | Amount + status + optional Joist file per job | Keep bid history with the job (bidding stays in Joist) | Live |
| Copilot + Company Brain | In-app search/assistant grounded in company knowledge entries | Fast answers from company docs | Live v1 (grounding limited to stocked entries) |
| Inventory | Inventory module UI | Track stock | Live UI, empty data |
| Vehicle alerts | Fleet alert list | Vehicle issues visibility | MVP — mock data (known) |
| Feedback | In-app feedback reports w/ screenshots | Users report bugs in context | Live |
| Service Fusion importer | Imported SF history: jobs/customers/notes + photo loader | Migrate off Service Fusion without losing history | Done for photos/history; file export still in progress (paused) |
| Settings | App/org settings | Configuration | A SettingsScreen exists unconnected (Part A); routed settings work via other screens |
| Live Operations | Real-time ops board | Live day-of view | Screen tree unconnected; routed page uses other components |
| Admin / organizations | Org management dialogs | Multi-org admin | Unconnected |
| Old customer portal | /portal/[projectId] legacy portal | Pre-GC-portal customer view | Legacy — hardcoded demo user instead of real auth; deprecate-vs-auth decision is Collin's |
| Contractors | Contractor list | Subcontractor directory | Live page, zero rows (data state, not a bug) |

---

## Part C — For Claude: your dive

Collin wants both lists — Zoinks' above, and yours, independently built. Please:

1. **Your feature inventory.** Every feature you know LOOP has: what it does, its
   purpose, and its status — in your own words, from the builder's side. Flag any
   feature in Part B you think is wrong, missing, or mis-stated.
2. **econcile the 92.** or each cluster in art , give a verdict: **wire it**,
   **delete it**, or **park it** (with a one-line why). Call out any false positives
   in my method (script-used, test-only, framework-loaded) — I flagged the ones I
   know about; find the rest.
3. **The portal trio is the known user-facing gap.** Confirm the wiring plan
   (mount ShareLinkControls + PortalMoneyToggle + PortalSubmissions on the job
   detail screen, office-gated, with real link/submission state) and what it takes.
   If the components need API/state changes to mount honestly, say so — do NOT
   mount them against imagined endpoints; check the real routes first
   (`/api/jobs/[id]/share-link`, portal submissions routes) the way the portal
   data service should have been checked.
4. **What static analysis can't see.** Anything you built that is reachable in code
   but dead in practice — env-gated, flag-off, role-hidden from everyone, renders
   only mock data — list it here. (Known examples: vehicle alerts mock data, dev
   header bypass. Find the others.)
5. **Rules (unchanged):** verify against the real schema before writing queries;
   tsc + full suite green before calling a PR ready; ONE push per PR branch
   (deployment budget — see #337 standing rule); briefs live in docs/briefs/.

Deliver as a comment thread on #337 or a companion doc in docs/briefs/ — Collin
will reconcile the two lists before anything gets wired or deleted.
