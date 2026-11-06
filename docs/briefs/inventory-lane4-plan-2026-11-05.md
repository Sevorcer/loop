# Inventory Lane 4 (Kits, Material Plans, Readiness, Closeout Reconciliation) — Implementation Plan

Status: **PROPOSED — awaiting Collin's approval and rulings on §9.** No code and no migration files exist for this lane; none will be written until the plan is approved.
Date: 2026-11-05
Sources read: `field-service-inventory-design-2026-11-05.md`, `loop-inventory-design-review-2026-11-05.md`, `claude-brief-inventory-amendments-2026-11-05.md` (the 13 amendments bind this lane; where design and amendments disagree, amendments win), `inventory-lane1-plan-2026-11-05.md` (format model), the Lane 4 plan brief from Zoinks, and the repo at main `23d0508` (Lane 1 merged).

Lane 4 is the install **kit / pallet flow** (amendment 10). It must not wait on Lane 2 (vans / par / restock) and does not touch Lane 2's scope. It does not build Lane 3 (serials) or Lane 5 (purchasing); §3.6 and §3.4 say exactly where each plugs in.

## 0. What I verified first (repo, read-only)

| Fact | Finding | Consequence |
|---|---|---|
| A per-job materials list **already exists** | `job_material_lines` (migration `20261121000000`, shipped in #23): name / qty / unit / `part_number`, state `needed → on_truck → used`, tech may update state + qty on assigned jobs (RLS + trigger), UI = `JobMaterialsPanel` on the job Overview tab. Its own header says an inventory lane would attach a catalog item and ledger movements to the **same** transitions. | Lane 4 **extends this table into the plan lines**. No second "plan lines" table, no parallel UI. Existing rows and the tech tap-flow keep working. |
| The dispatch board already shows a Materials chip | `applyPrepReadiness` / `materialReadinessFromSummary` derive it from `job_material_lines` counts; `isDispatchable` is only ever **displayed**, nothing gates on it. | The new readiness result feeds the same chip. Warn-only at launch costs nothing: readiness cannot block anything today. |
| Estimate / job line items have **no SKU and no in-app authoring** | `estimate_line_items` and `job_line_items` come from the Service Fusion import (`kind` service/product/other_charge, free-text `name`, `qty`, `cost_cents`). Nothing in the app writes them. `Job.estimateId` exists. `job_bids` is an amount + status only. | Amendment 3 (generate from line items, never retype) works for imported / estimate-linked jobs. **For a job created fresh in LOOP there are no line items to generate from**, so kits + manual adds are the primary source until #36 lands estimate authoring. This is D11. |
| No in-app "estimate approved" event | Estimate `status` is imported free text. | "Generate when the estimate is approved" has nothing to listen to today. The real trigger events are job scheduling and a manual button (D5). |
| Closeout is a server-checked step list | `getJobCompletionChecklist` → `canComplete`; `updateJobStatus` refuses completion with a joined blocker message; client mirrors it in `buildCloseoutSteps` (steps note / photo / qa / systems; `visit` mode keeps only the note step). | Reconciliation is a **new step** in this list, with an enforcement level the server reads (warn → soft → hard). `visit` jobs are exempt. |
| Job lifecycle hooks | `rescheduleJobByDayShift` (`services/dispatch.ts`), `updateJob` (schedule edits), `updateJobStatus` (Cancelled / On Hold / Completed), `softDeleteJob`. `job_activity.type` has a fixed TS union (`created, edited, scheduled, assigned, …`). | Release-and-recheck (amendment 7) hooks into those four functions. Plan history gets its **own** table; `job_activity` gets one summary row per plan change using the existing `edited` type (no new activity type). |
| Lane 1 ledger | `inventory_transactions` (append-only; types incl. `issue_to_job`, `return_from_job`, `buy_for_job`, `transfer_out/in`; sign CHECKs; nullable `job_id`), `inventory_locations` (types incl. virtual `job` location, unique per job), `inventory_stock_levels` (trigger cache, negative allowed). Sprint 18 types (`MaterialReadinessState`, `JobMaterialPlan`) exist and are unused. | Build on these. Sprint 18's three-state `MaterialReadinessState` is retired in favour of the four amendment-6 states (§3.3). |
| `vehicles` is empty, `crews.vehicle_id` is the only crew↔van link | Lane 1 live. | Lane 4 fulfils from the **shop**; van-stock lines are Lane 2 (D12). |

## 1. Architecture decisions

1. **Reservations are soft commitments, not ledger rows.** The ledger records physical truth only. A reservation says "this job has first claim on N of item X at the shop"; available = on-hand − active reservations. Release is a status change, never an opposite ledger entry (nothing physical moved). This is how reservations can expire without polluting the audit trail.
2. **Pulling is the physical move, and it is a ledger transfer.** Shop warehouse → the job's **virtual job location** (the pallet), as a paired `transfer_out`/`transfer_in`. The job location is the pallet: its balance at closeout must reach zero.
3. **Consumption and returns write ledger rows at reconciliation, not per tap.** The tech taps "used" during the job (UI state only, as today). Closeout records the real numbers, and only then are `issue_to_job` (used) and return transfers (returned) posted. A leftover difference is an explicit `adjust` with a reason (over-pull / shrink), never a silent write-off.
4. **The existing `needed → on_truck → used` transitions stay the single write point.** For lines linked to a catalog item they go through a service that also writes the ledger; for free-text / needs-SKU lines they remain a plain checklist with no stock effect.
5. **Readiness is a pure function.** `computeReadiness(lines, stock, reservations, arrivals, now)` has no I/O, lives in `features/inventory/utils`, and is unit-tested. A service runs it on events and caches the result on the plan; the dispatch board only reads the cache.
6. **On-order comes through an interface.** Readiness reads arrivals via an `OnOrderSource`. Lane 4's implementation is a small manual table (D1). Lane 5 swaps the source to PO lines without touching readiness.
7. **Nothing hard-blocks at launch (amendment 8).** Readiness is advisory forever in Lane 4. Reconciliation ships at stage `warn`; `soft` and `hard` are implemented but switched off, controlled by one owner-set setting.
8. **Quantity-level now, serial-ready later (amendment 2 / 11).** Equipment lines are ordinary quantity lines. Lane 3 attaches serials through a join table keyed on the plan line (§3.6); no plan-model rewrite.
9. **Server-first.** Pages stay tiny; screens are server components; client islands only for the kit editor, line editing, dialogs. No new client providers for data fetching.
10. **No cost exposure.** Plans, readiness and reconciliation work in quantities. `catalog_item_costs` is never joined; techs and dispatch see no money.
11. **Shared-file discipline.** Every touch of a shared file is listed in §7.3 so Zoinks can sequence it against Lane 2 / 3.

## 2. Table definitions

Conventions as Lane 1: `id uuid PK default gen_random_uuid()`, `org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`, `created_at` / `updated_at` with `fn_set_updated_at()` where mutable, `created_by` stamped from `auth.uid()` by trigger (never from the body), quantities `numeric(12,3)`, idempotent DDL, `ENABLE` + `FORCE` RLS, policies `TO authenticated` named `"table: description"` using `current_app_role()` and `org_id = current_org_id()`, no `WITH CHECK (true)`, every table has a `-- DOWN` section and a verify file.

### 2.1 `inventory_settings` (M1) — one row per org
`org_id uuid PK`, `readiness_lead_days int NOT NULL default 3 CHECK (0..30)`, `arrival_buffer_days int NOT NULL default 1 CHECK (0..14)`, `closeout_enforcement text NOT NULL default 'warn' CHECK in ('warn','soft','hard')`, `updated_by`, `updated_at`. Changes to `closeout_enforcement` are written to `job_activity`-style audit via a small trigger-stamped `enforcement_changed_at/by`. Row is created lazily by the service (`INSERT … ON CONFLICT DO NOTHING`), not seeded. Owner-only write.

### 2.2 `kit_templates` and `kit_template_lines` (M1)
`kit_templates`: `name text NOT NULL`, `description text`, `category text` (free label such as "Furnace swap", D10), `status text NOT NULL default 'active' CHECK in ('active','archived')`, `version int NOT NULL default 1`, `created_by`, `updated_by`. Unique `(org_id, lower(name))`.
`kit_template_lines`: `kit_id → kit_templates ON DELETE CASCADE`, `catalog_item_id → catalog_items ON DELETE RESTRICT NOT NULL` (kits are built from the catalog, never free text), `quantity numeric(12,3) NOT NULL CHECK (>0)`, `is_optional boolean default false`, `notes text`, `sort_order int`. Unique `(kit_id, catalog_item_id)`.
**Edit semantics (D9):** editing a kit bumps `kit_templates.version`. A kit attached to a job is **copied** (snapshot) onto that job's plan lines and stamped with `kit_id` + `kit_version`; later edits never change existing jobs. The job panel shows "Kit X v3 — template is now v4" with an explicit, per-job **Refresh from kit** that adds new lines and updates untouched ones but never overwrites a line someone adjusted. Archived kits cannot be attached to new jobs but remain on existing ones. Kit variants (tonnage, line-set length) are handled by separate kits in Lane 4; conditional rules / size selectors are deferred (not needed to prove the flow).

### 2.3 `job_material_plans` (M2) — header, one per job
`job_id → jobs ON DELETE CASCADE` UNIQUE, `status text NOT NULL default 'draft' CHECK in ('draft','confirmed')`, `generated_from text CHECK in ('estimate','kit','manual','mixed')`, `generated_at`, `confirmed_by`, `confirmed_at`, cached readiness: `readiness_state text CHECK in ('ok','arriving_in_time','short','at_risk')`, `readiness_reason text`, `readiness_checked_at timestamptz`, `needs_sku_count int NOT NULL default 0`. Draft plans are advisory (readiness runs, **no reservations**); confirming creates reservations (D5).

### 2.4 `job_kits` (M2)
`job_id`, `kit_id → kit_templates ON DELETE RESTRICT`, `kit_version int NOT NULL`, `multiplier numeric(6,2) NOT NULL default 1 CHECK (>0)` (e.g., two zones), `attached_by`, `attached_at`. Unique `(job_id, kit_id)`.

### 2.5 `job_material_lines` — extended (M2, additive columns only)
Existing columns and RLS stay. New nullable / defaulted columns:
| Column | Notes |
|---|---|
| `plan_id uuid NULL → job_material_plans` | NULL for legacy hand-typed lines; backfilled lazily when a plan is first created for the job (no data migration). |
| `catalog_item_id uuid NULL → catalog_items ON DELETE RESTRICT` | NULL = **needs SKU** (shown in the queue). Free-text `name` stays as the display / original text. |
| `source text NOT NULL default 'manual' CHECK in ('manual','estimate','kit','field')` | `field` = added by a tech during the job (unplanned use). |
| `job_line_item_id uuid NULL`, `estimate_line_item_id uuid NULL` | Exactly one when `source='estimate'`; **no FK to the import tables** (they are SF-import-owned and #36 may change them) — a soft reference validated by the service, org-checked by the same-company trigger pattern. |
| `kit_id uuid NULL`, `kit_version int NULL`, `kit_quantity numeric NULL` | Provenance of kit-sourced lines; `kit_quantity` keeps the kit's number when the estimate's wins (D7). |
| `is_optional boolean NOT NULL default false` | Optional lines are shown but excluded from readiness and reconciliation shortfalls. |
| `stage text NOT NULL default 'planned' CHECK in ('planned','reserved','pulled','reconciled')` | The amendment-3 lifecycle. Legacy `state` is kept in sync: `needed` = planned/reserved, `on_truck` = pulled, `used` = reconciled. |
| `readiness_state`, `readiness_reason`, `readiness_eta date` | Cached per-line result (same four states). |
| `fulfil_location_id uuid NULL → inventory_locations` | NULL = the default shop warehouse. Present so Lane 2 can later fulfil from a van without a schema change; Lane 4 UI offers shop only. |
| `used_qty`, `returned_qty`, `recovered_qty numeric(12,3) NULL`, `variance_reason text NULL` | Filled at reconciliation (M7). |
The existing tech trigger (`guard_tech_job_material_update`) keeps techs to `state` + `quantity`; M7 widens it to the reconciliation columns on assigned jobs and nothing else.

### 2.6 `job_material_line_events` (M2) — plan history (the audit trail)
Append-only, no UPDATE / DELETE (same trigger pattern as the ledger). `line_id`, `job_id`, `event_type text CHECK in ('created','qty_changed','item_changed','removed','sku_linked','kit_refreshed','reserved','released','pulled','used','returned','override')`, `from_qty`, `to_qty`, `reason text` (required for `qty_changed`, `item_changed`, `removed`), `actor_id` (trigger-stamped), `created_at`. Every plan change by anyone writes one row here **and** one summary `job_activity` row (type `edited`, title "Material plan adjusted") so the job timeline shows it.

### 2.7 `catalog_item_aliases` (M2) — matching memory
`catalog_item_id`, `alias text NOT NULL` (normalized lowercase, collapsed whitespace), `created_by`. Unique `(org_id, alias)`. Written when someone resolves a needs-SKU line: the free-text line-item name becomes an alias, so the next job with that wording matches itself (D13). Sell/stock facets of the item master are untouched.

### 2.8 `inventory_reservations` (M3)
`job_id`, `line_id → job_material_lines ON DELETE CASCADE`, `item_id → catalog_items`, `location_id → inventory_locations` (the shop), `qty numeric(12,3) NOT NULL CHECK (>0)`, `status text NOT NULL default 'active' CHECK in ('active','pulled','released','consumed')`, `released_reason text CHECK in ('rescheduled','cancelled','on_hold','unscheduled','removed','plan_changed','completed','manual')`, `reserved_at`, `released_at`, `reserved_by`. Index `(item_id, location_id) WHERE status='active'`.
**View `inventory_available`** (security_invoker): per `(item_id, location_id)`: `on_hand`, `reserved` = Σ active reservations **whose job is not Cancelled / Completed / soft-deleted**, `available = on_hand − reserved`. The join to `jobs` is the **safety net for amendment 7**: even if a release hook fails, a cancelled or completed job can no longer hold stock. Stock levels remain ledger-only; reservations never write them.
**Atomic allocation:** reserve / release-and-rereserve runs as one SQL function `reserve_job_materials(p_job_id)` (security invoker, takes a per-item advisory lock so two simultaneous plans cannot double-claim the last unit). Allocation is first-come by `reserved_at` (D8).

### 2.9 `inventory_expected_arrivals` (M4) — the Lane 4 on-order source (D1)
`item_id`, `location_id` (receiving warehouse), `qty numeric(12,3) NOT NULL CHECK (>0)`, `eta_date date NOT NULL`, `status text NOT NULL default 'expected' CHECK in ('expected','received','cancelled')`, `for_job_id uuid NULL → jobs` (special order / direct-ship claimed by one job), `supplier_note text`, `po_line_id uuid NULL` (**reserved for Lane 5**, no FK now), `receipt_transaction_id uuid NULL → inventory_transactions UNIQUE`, `created_by`, `updated_at`. Marking an arrival **received** posts a normal ledger `receive` and links it, so there is one source of truth for stock and the arrival row becomes history. No vendor, PO, price or invoice fields (amendment 5).

### 2.10 `job_readiness_snapshots` and `job_material_events` (M5) — metrics capture
- `job_readiness_snapshots` (append-only): `job_id`, `taken_at`, `trigger text CHECK in ('plan_confirmed','state_changed','dispatched')`, `scheduled_date`, `rollup_state`, `lines_total`, `lines_ok`, `lines_arriving`, `lines_short`, `lines_at_risk`, `lines_needs_sku`, `detail jsonb` (per-line state, no costs). "Kit completeness at dispatch" = the last snapshot before the job's first move to In Progress.
- `job_material_events` (append-only): `job_id`, `line_id NULL`, `item_id NULL`, `event_type text CHECK in ('missing_part','wrong_part','substitution','unplanned_use','supply_house_run','kit_feedback')`, `qty NULL`, `note text`, `created_by`, `created_at`. `kit_feedback` is the warehouse's "missing / unneeded" flag from the design; it feeds back into kit editing as a hint list.
Over-pull / return rate needs no table: it falls out of the M7 reconciliation columns.

### 2.11 Ledger link (M6) — one additive column
`inventory_transactions.material_line_id uuid NULL → job_material_lines ON DELETE SET NULL` lets every pull / use / return be attributed to a plan line. ALTER ADD COLUMN only; the append-only triggers are untouched. **This alters a Lane 1 table** (shared with Lane 3's future `serial_unit_id`; different column, but the `LedgerEntry` type and `ledgerRules.ts` are shared files — flagged in §7.3).

### 2.12 Closeout reconciliation (M7)
`job_material_reconciliations` (one per job): `job_id UNIQUE`, `status text CHECK in ('submitted','overridden')`, `enforcement_at_submit text`, `submitted_by`, `submitted_at`, `override_reason text`, `override_by`, `override_at`. The per-line numbers live on `job_material_lines` (§2.5) so the table stays small.
`refrigerant_log_entries` (append-only EPA log, amendment 12): `job_id`, `line_id NULL`, `item_id → catalog_items` (R-454B and R-410A stay separate SKUs, `item_kind='refrigerant'`), `kind text CHECK in ('charged','added','recovered')`, `lbs numeric(8,2) NOT NULL CHECK (>0)`, `installed_system_id uuid NULL`, `serial_unit_id uuid NULL` (**cylinder, Lane 3 — no FK yet**), `logged_by`, `logged_at`. Lbs *used* also flow through the line's `used_qty` into the ledger; *recovered* lbs go only to this log in Lane 4 (recovery cylinders are Lane 3 serial units).

## 3. How the flows work

### 3.1 Getting a plan (generation)
Triggers (D5): (a) **manual** "Generate plan" / "Add kit" on any job, always available; (b) **auto-draft** the first time an *Install*-type job becomes Scheduled with a start time. Auto-draft never reserves stock. Generation steps, all in `services/materialPlans.ts`:
1. **Estimate lines** (when `job_line_items` for the job, or the linked estimate's, exist): each `kind='product'` line is matched to a catalog item in this order — existing `catalog_item_id` if #36 has added one, exact `catalog_item_aliases` hit, exact normalized-name match on `catalog_items.name`/`sku`, then a **suggested** fuzzy match (never auto-linked). Matched → plan line (`source='estimate'`); `service` / `other_charge` / labor lines are skipped with a count shown ("4 non-material lines skipped"); anything unmatched → plan line with `catalog_item_id NULL` = **needs SKU**.
2. **Kit lines**: attached kits copy their lines × `multiplier` (`source='kit'`).
3. **Merge rule (D7):** same catalog item from both sources → one line; the **estimate quantity wins** (it is what was sold) and the kit quantity is kept in `kit_quantity` and shown as a note. The office adjusts if both are really needed.
4. The plan stays `draft` until the office **Confirms**, which resolves nothing automatically but creates reservations for the matched lines. A draft with needs-SKU lines can still be confirmed; those lines simply cannot reserve or pull.
**Needs-SKU queue:** cross-job list of unmatched lines with the suggested match, "Link to item" (writes the alias, sets `catalog_item_id`, re-runs readiness), "Create item" (opens the Lane 1 add-item dialog prefilled), and "Not stock" (labor / misc; clears the flag with a reason). Plans are never retyped; the only free typing is a *manual* line or a needs-SKU original text.
**Adjusting** (who, with audit): office roles may change qty, swap item, add or remove lines on any plan; assigned techs may only change `quantity` / `state` as today and add `field` lines. Every change needs a reason where §2.6 says so and writes a `job_material_line_events` row plus the `job_activity` summary. Removing a line that has an active reservation releases it in the same call.

### 3.2 Lifecycle: planned → reserved → pulled → reconciled
| Stage | Meaning | Written |
|---|---|---|
| planned | on the plan, no stock claimed | line only |
| reserved | `inventory_reservations` active for the line (may be partial; the shortfall remains planned and feeds readiness) | reservation rows |
| pulled | warehouse moved it to the job's pallet | ledger transfer pair `warehouse → job location`, `job_id` + `material_line_id` set; reservation → `pulled` |
| reconciled | closeout recorded used / returned and cleared the job location | ledger `issue_to_job`, return transfer, variance `adjust`; reservation → `consumed` |

**Release and re-check (amendment 7).** One service function, `releaseAndRecheck(jobId, reason)`, called from `rescheduleJobByDayShift`, `updateJob` (when the scheduled date changes), `updateJobStatus` (Cancelled, On Hold; resume re-reserves), `softDeleteJob`, and clearing the schedule. For a **date move** it releases and immediately re-reserves inside one database call, so the job keeps its stock unless someone else claimed it in between; if it cannot, readiness shows the new shortfall (D8: a moved job goes to the back of the queue). Completed jobs release at reconciliation. The `inventory_available` view's job-status join (§2.8) means a missed hook cannot cause an indefinite lock.
**Cancelled after pulling:** the pallet's stock is *stranded* in the job location. Cancel creates a "Return pallet to shop" task in the Pull queue (§6.3) and the job location with a non-zero balance appears in a "Stranded" list on the Activity screen. It is a prompt, not a block.

### 3.3 Readiness (amendment 6) — OK / short / arriving-in-time / at-risk
Computed per **non-optional** line, from the line's required qty R, its active reserved qty, the job date **Dj** (scheduled start date, company time zone), today, and arrivals.
1. shortfall S = R − reserved (pulled counts as satisfied). **S ≤ 0 → `ok`.**
2. Otherwise allocate expected arrivals for that item at the shop to shortfalls **in job-date order across all upcoming jobs** (special-order arrivals for a job go to that job first), so one pallet of arriving stock is never counted for two jobs. An arrival counts toward a job only if `eta_date ≤ Dj − arrival_buffer_days`.
3. Allocated arrivals ≥ S → **`arriving_in_time`**, ETA = the latest ETA used.
4. Still short after in-time arrivals:
   - arrivals exist but their ETA is after the job date → **`at_risk`** ("ETA Nov 14 is after the job date").
   - nothing on order and the job is within `readiness_lead_days` → **`at_risk`** ("Not ordered — job in 2 days").
   - nothing on order and the job is farther out than the lead window → **`short`** ("Short 2 — not yet ordered"; actionable but not urgent).
5. A needs-SKU line cannot be checked: it is reported as *unverified* (not a fifth state) and lifts the job rollup to at least "needs attention".
**Job rollup** = worst line (`at_risk` > `short` > `arriving_in_time` > `ok`), mapped onto the dispatch chip's existing `ReadinessState`: `ok` → satisfied, `arriving_in_time` / `short` / unverified → attention_needed, `at_risk` → not_satisfied. Jobs with **no plan** keep today's behaviour (the `job_material_lines` count-based chip), so nothing regresses.
**Advisory only:** the result never changes `dispatch_status`, never blocks scheduling, and `isDispatchable` stays display-only (amendment 8).
**Re-run triggers** (`recomputeReadiness`, scoped to the affected jobs / items, not a global batch): plan confirmed or edited, reservation change, any ledger movement of an item (a receive can fix many jobs), arrival created / changed / received, job reschedule / cancel / status change, kit refresh, settings change. Results are cached on the plan header + lines (§2.3, §2.5) with `readiness_checked_at`; there is no cron, and the board shows the check time with a **Re-check** action. A snapshot row is appended whenever the rollup state changes (§2.10).

### 3.4 On-order source and the Lane 5 hand-off
Lane 4 ships `inventory_expected_arrivals` with a small **Expected arrivals** screen (add / edit / cancel / "Mark received"). Marking received posts the normal ledger `receive` (so stock stays single-source) and fires the readiness re-run. When Lane 5 arrives, PO lines populate `po_line_id` on the same rows (or its own implementation of `OnOrderSource` replaces the table read); readiness code does not change.

### 3.5 Closeout reconciliation (amendment 8, staged)
A new closeout step **Materials** (`key: 'materials'`) appears for `full`-mode jobs that have a confirmed plan with at least one catalog-linked line; other jobs are exempt. Per line the screen shows planned / pulled and lets the assigned tech (or office) enter **used** and **returned**; anything left over must be given a reason (over-pull, damaged, left on site). Techs add unplanned parts as `field` lines (which also record a `unplanned_use` event). Refrigerant lines add **recovered** lbs and write `refrigerant_log_entries`. **Submit** posts, in one transaction: `issue_to_job` for used, a return transfer (job location → shop) for returned, an `adjust` with the reason for any residual, then zeroes the job location, marks reservations consumed, stage `reconciled`, and writes `job_material_reconciliations`.
Enforcement is `inventory_settings.closeout_enforcement`, read by the server checklist (`getJobCompletionChecklist` gains `materialsReconciled`, `materialsRequired`, `materialsEnforcement`):
| Stage | Behaviour |
|---|---|
| `warn` (launch) | Step shows incomplete with a warning; `canComplete` ignores it. |
| `soft` | Completion refused until reconciled **or** an office role (owner / manager / office) completes with a recorded override reason (`override_*`, plus a `job_activity` row). Techs cannot override. |
| `hard` | Refused for everyone; no override. |
Advancing a stage is an explicit owner action on the Rules screen (D4); the plan proposes the criteria to look at (reconciled installs, variance rate) but the decision is Collin's.

### 3.6 Serialized equipment before Lane 3
Equipment lines (`item_kind='equipment'`, usually `tracking_mode='serialized'`) behave exactly like other lines — reserve, pull, reconcile **by quantity at the item level** — because Lane 1's ledger has no serial column yet. They come from estimate matching or manual adds (kits are consumables / accessories by convention). Readiness warns when the line's item is a type-level seed row that has never been received. **Lane 3 plugs in** by adding `job_material_line_serials (line_id, serial_unit_id, assigned_at)` and a serial picker on the line, and by adding `serial_unit_id` to the ledger; the plan, reservation, readiness and reconciliation tables do not change. Lane 3 may then add a "serial required before Pulled" rule under the same staged-enforcement switch.

### 3.7 Refrigerant (amendment 12)
R-454B and R-410A are separate `refrigerant` SKUs with unit `lb`; a plan line's quantity is lbs. Reconciliation records lbs **used** (consumption ledger via `used_qty`) and **recovered** (EPA log only). Each charge / add / recovery is an append-only `refrigerant_log_entries` row tied to the job (and, optionally, the installed system). Cylinder identity is `serial_unit_id`, nullable until Lane 3.

### 3.8 Metrics hooks (capture now, report later)
| Metric | Captured by |
|---|---|
| Kit completeness at dispatch | `job_readiness_snapshots`, last row before the first transition to In Progress (`trigger='dispatched'` row written at that transition) |
| Missing-part events per install | `job_material_events` `missing_part` / `wrong_part` / `substitution` / `unplanned_use` |
| Supply-house runs on install day | `job_material_events` `supply_house_run`, optionally with a Lane 1 `buy_for_job` ledger entry (item + qty) from the "Bought on the way" dialog; cost capture is Lane 5 |
| Over-pull / return rate | derived from `pulled`, `used_qty`, `returned_qty`, `variance_reason` on reconciled lines |
No reporting screens in Lane 4.

## 4. Migration spec

Numbering is the pre-allocated range: **20261126000000 and up**. Each has `supabase/verifications/<same name>.verify.sql` (DO / ASSERT), a `-- DOWN` section, and a checksum line appended to `scripts/migration-checksums.sha256` (append only, never regenerate). Builders never apply; Zoinks applies before merge (expand-only, so safe ahead of the code).

| # | Version / name | Content | PR |
|---|---|---|---|
| M1 | `20261126000000_kit_templates_and_settings` | §2.1, §2.2 + RLS + indexes + triggers | A |
| M2 | `20261126100000_material_plans` | §2.3–2.7: plan header, `job_kits`, additive columns on `job_material_lines` (+ widened tech guard stays narrow), line events, aliases, RLS | B |
| M3 | `20261126200000_inventory_reservations` | §2.8 table, `inventory_available` view, `reserve_job_materials()` / release functions, RLS | C |
| M4 | `20261126300000_expected_arrivals` | §2.9 + RLS | C |
| M5 | `20261126400000_material_metrics` | §2.10 + RLS (append-only triggers) | C |
| M6 | `20261126500000_ledger_material_line_link` | §2.11 single nullable column + index | D |
| M7 | `20261126600000_closeout_reconciliation` | §2.12 + reconciliation columns' guard widening for assigned techs | E |

Same-commit doc / test updates per PR (as Lane 1): `docs/architecture/security/rls-role-matrix.md`, `endpoint-authz-inventory.md`, `src/services/authorization.ts` (+ `authorization.test.ts`), `permissionsMatrix.ts` `TABLE_LABELS`, the checksums file. Existing `job_material_lines` keeps its current authorization pattern (role sets in `job-materials/utils`); the new tables get `CoreTable` entries.

## 5. RLS / role matrix (new `CoreTable` entries)

`portal` and `anon` are denied everywhere. Tech access is scoped to assigned jobs via `private.caller_is_assigned_to_job(job_id)`, as `job_material_lines` already does.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `inventory_settings` | owner, manager, dispatch, office | owner | owner | ∅ |
| `kit_templates`, `kit_template_lines` | all internal roles (so crews can see what a kit contains) | owner, manager, office (D2) | owner, manager, office | owner (blocked by FK once used) |
| `job_material_plans`, `job_kits` | owner, manager, dispatch, office, sales; tech on assigned jobs | owner, manager, dispatch, office | owner, manager, dispatch, office (confirm: owner, manager, office) | owner |
| `job_material_lines` (existing + new columns) | unchanged | unchanged | unchanged; tech = `state`, `quantity`, and (M7) reconciliation columns on assigned jobs only | unchanged |
| `job_material_line_events` | same as plans | office roles + tech on assigned jobs (stamped `actor_id = auth.uid()`) | **∅** + `APPEND_ONLY_DENY` | **∅** + `APPEND_ONLY_DENY` |
| `catalog_item_aliases` | owner, manager, dispatch, office | owner, manager, office | owner, manager, office | owner |
| `inventory_reservations` | owner, manager, dispatch, office | **service functions only** (no direct INSERT grant; writes go through `reserve_job_materials()`) | same | same |
| `inventory_expected_arrivals` | owner, manager, dispatch, office | owner, manager, office | owner, manager, office | owner |
| `job_readiness_snapshots` | owner, manager, dispatch, office | service-written | **∅** | **∅** |
| `job_material_events` | owner, manager, dispatch, office; tech on assigned jobs | office roles + tech on assigned jobs | **∅** | **∅** |
| `job_material_reconciliations` | owner, manager, dispatch, office; tech on assigned jobs | assigned tech, owner, manager, office | owner, manager, office (override fields) | **∅** |
| `refrigerant_log_entries` | owner, manager, dispatch, office; tech on assigned jobs | assigned tech, owner, manager, office | **∅** | **∅** |

Notes: cost privacy is unchanged (nothing here joins `catalog_item_costs`). Reservation and readiness rows are written by definer-free **invoker** functions so RLS still applies. The empty UPDATE / DELETE sets are locked invariants in `authorization.ts`, same as the ledger.

## 6. Screens and code layout

New routes in `src/lib/routes.ts`: `INVENTORY_KITS`, `INVENTORY_KIT` builder, `INVENTORY_NEEDS_SKU`, `INVENTORY_ARRIVALS`, `INVENTORY_PULLS`, `INVENTORY_RULES`, `JOB_PULL_LIST` builder. Inventory tabs gain Kits / Needs SKU / Arrivals / Pulls (Lane 1 tabs file is shared with Lane 2 — §7.3). Pages stay one-liners rendering a feature screen; business rules in `src/services/{kitTemplates,materialPlans,inventoryReservations,readiness,closeoutReconciliation}.ts`; pure logic in `src/features/inventory/utils/` (`readiness.ts`, `planMerge.ts`, `reconciliation.ts`) with tests; repositories `kitTemplates`, `materialPlans`, `inventoryReservations`, `expectedArrivals`, `reconciliation`, `refrigerantLog`; feature code in `src/features/{inventory,job-materials}`.

1. **Kit templates** — `/inventory/kits` list (name, category, line count, "used on N upcoming jobs", archived toggle, duplicate) and `/inventory/kits/[id]` editor (server screen + client island: catalog item picker reusing the Lane 1 search, qty, optional, notes, reorder; version badge; hint panel from `kit_feedback` events). Includes **"Save this job's materials as a kit"** on a finished job (office), the practical way starter kits come to exist from real installs.
2. **Job material plan** — the existing `JobMaterialsPanel` on the job Overview tab evolves in place (same component and compact variant in prep panels): header with plan status, rollup readiness chip, **Generate**, **Add kit**, **Confirm plan**; line table (item, qty, source badge, stage, readiness + ETA, needs-SKU badge); row actions by role (adjust with reason, pull, mark used, report missing / wrong part); a History drawer from `job_material_line_events`. Techs see qty, stage and readiness, never cost.
3. **Readiness where dispatch looks (D3)** — (a) the **Materials chip on `DispatchBoardCard`** shows the rollup with a one-line reason ("Short 2 whips — ETA Fri"); (b) the job-page panel above; (c) a compact **"Next 3 days: N installs at risk"** line at the top of the dispatch board linking to the worst jobs. Reasoning: dispatch decides on the board and the day-before look is the entire value of the check, so the chip plus a forward-looking count beat a separate readiness page. Not on the calendar in Lane 4 (it adds noise to a schedule view).
4. **Needs-SKU queue** — `/inventory/needs-sku` (§3.1).
5. **Expected arrivals** — `/inventory/arrivals` (§3.4).
6. **Pull queue and pull list (pallet flow)** — `/inventory/pulls`: confirmed plans by scheduled date, per-job **Pull all** or per-line pull (writes the ledger transfer), the "Return pallet to shop" tasks from cancelled jobs, and a warehouse **missing / unneeded** flag per line (→ `kit_feedback`). `/jobs/[id]/pull-list` is a printable list for the person staging the pallet. No `pallets` table: the job's virtual location *is* the pallet (D12).
7. **Reconciliation step** — a Materials section on the job page, linked from the new closeout step (`JOB_CLOSEOUT_SECTION_IDS.materials`, `CloseoutSectionKey` extended); office override dialog for the soft stage.
8. **Rules** — `/inventory/rules`: lead days, arrival buffer, closeout enforcement stage (owner edits; manager reads).
All colors via semantic tokens: readiness states reuse the existing `StatusBadge` variants (ok → success, arriving → info, short → warning, at-risk → danger); **no new tokens expected**, and any that prove necessary go in `globals.css` in that build PR.

## 7. PR stack, sequencing, and shared files

### 7.1 Stack (each ends with Zoinks' tsc + full suite + build + merge simulation; I cannot run them here)
- **PR A — Kits:** M1; kit repos / service / routes; kit list + editor; settings row + Rules screen (read-only until PR E); authz + docs + tests.
- **PR B — Plans:** M2; plan generation (estimate matching, kit merge), needs-SKU queue, aliases, plan history, upgraded job panel, "save as kit". No reservations or stock effects yet.
- **PR C — Reservations, arrivals, readiness:** M3, M4, M5; `reserve_job_materials`, release hooks in the four job-lifecycle functions, readiness engine + cache, arrivals screen, board chip + next-3-days line, snapshots / events capture.
- **PR D — Pull flow:** M6; pull action (ledger transfer), pull queue, printable pull list, stranded-pallet list, "Bought on the way" / missing-part events.
- **PR E — Reconciliation:** M7; closeout step + server checklist field, reconciliation screen, refrigerant log, enforcement stages (ships at `warn`), override dialog.
Order is strict: A → B → C → D → E (B needs kits; C needs plans; D needs reservations; E needs pulls). Merge order, expand-then-code, follows the Lane 1 convention: Zoinks applies each migration before its PR merges (all additive).

### 7.2 Seed / no-seed statement
**Nothing is seeded.** No kit templates, no arrivals, no reservations, no settings rows beyond the lazily created defaults. There is no published install BOM, so starter kits are built **in-app by the office from the catalog**, with contents supplied by Collin and the crews outside the software work. Two aids ship so that is easy: Duplicate kit, and Save-job-as-kit from a real completed job. Lane 1's 70 seeded catalog items are what kits are built from.

### 7.3 Shared-file touches (so Zoinks can sequence against Lane 2 / 3)
| File | Touched by | Notes |
|---|---|---|
| `scripts/migration-checksums.sha256` | every PR | append only |
| `docs/architecture/security/rls-role-matrix.md`, `endpoint-authz-inventory.md` | every PR | additive sections |
| `src/services/authorization.ts` (+ test), `permissionsMatrix.ts` | A, B, C, D, E | new `CoreTable` entries; merge-conflict prone with Lane 2 |
| `src/lib/routes.ts` | A, C, D | additive |
| `src/features/inventory/utils/inventoryTabs.ts`, `InventoryTabs.tsx`, `src/features/inventory/index.ts` | A, C, D | **Lane 2 adds tabs too** |
| `src/features/inventory/types/ledger.ts`, `utils/ledgerRules.ts`, `repositories/inventoryLedger.ts`, `services/inventoryLedger.ts` | D | adds `materialLineId`; **Lane 3 adds `serialUnitId`** |
| `src/features/jobs/components/JobDetailScreen.tsx`, `utils/jobCloseout.ts`, `utils/jobCompletionChecklist.ts`, `services/jobs.ts` | B, C, E | job-lifecycle hooks, closeout step |
| `src/services/dispatch.ts`, `src/features/dispatch/components/DispatchBoardCard.tsx`, `DispatchJobBoard.tsx`, `utils/prepReadiness.ts`, `repositories/dispatch.ts` | C | board chip and next-3-days line |
| `src/features/job-materials/**` | B, C, D, E | the panel / provider / utils evolve in place |
| `src/features/inventory/utils/inventoryUtils.ts`, `types/inventory.ts` (Sprint 18) | C | retire the three-state readiness in favour of §3.3 |
| `globals.css` | only if a token proves necessary | none expected |

## 8. Risks

- **Allocation races** — two plans claiming the last unit. Mitigation: `reserve_job_materials()` with per-item advisory locks, plus a concurrent-reservation test in the scratch-Postgres gate.
- **Lifecycle hooks missed** — a code path that moves a job without calling `releaseAndRecheck`. Mitigation: the `inventory_available` job-status join (§2.8) makes the failure harmless to stock; a test enumerates the four entry points.
- **Estimate matching quality** — free-text SF names will mostly land in needs-SKU at first. Mitigation: alias learning (D13), suggestions never auto-link, and the queue is the intended workflow rather than an error state.
- **No line items for new jobs** (D11) — kits and manual adds carry the load until estimate authoring (#36) exists; the plan says so rather than promising otherwise.
- **Kit accuracy** — wrong starter kits cause wrong shortages. Mitigation: warn-only, `kit_feedback` hints, version-and-refresh, and no seed.
- **Adding a column to the Lane 1 ledger** (M6) — small, additive, but touches a shared, append-only table; Zoinks should verify the immutability triggers still pass in the M6 scratch run.
- **Reconciliation friction on the truck** — mitigated by `warn` at launch, a short tap-through UI, and exempting `visit` jobs and plans with no catalog-linked lines.
- **Migration standard drift** — as Lane 1: this lane follows the written standard (`supabase/verifications/`, DOWN sections, checksums) and flags any pre-existing script failures rather than fixing them silently.

## 9. Open decisions for Collin

| # | Decision | My recommendation |
|---|---|---|
| D1 | **On-order / ETA source** for readiness (Lane 5 purchasing doesn't exist) | A small manual **expected-arrivals** table (item, qty, ETA, optional for-job) with Mark received → real ledger receive; replaced or fed by PO lines in Lane 5. Alternatives rejected: per-line ETA fields only (can't share arrivals across jobs, so double-counts) and on-hand-only (forbidden by amendment 6). |
| D2 | **Who may create / edit kit templates** | Owner, manager, office edit; everyone internal reads (crews should see what's in a kit). Dispatch read-only. Say if you want dispatch or sales to edit. |
| D3 | **Readiness placement** | Dispatch-board Materials chip (with reason) + job-page panel + a "Next 3 days: N installs at risk" line on the board. Not on the calendar. |
| D4 | **Reconciliation starting stage and how it advances** | Start at **warn**. Advance to soft block (office override) only after you've seen real variance numbers; hard block later still. The stage is one owner-set setting; no code change to advance. |
| D5 | **What triggers plan generation** | Manual Generate / Add kit anywhere, plus an **auto-draft when an Install job is first scheduled**. Draft never reserves; the office **Confirms** to reserve. There is no in-app estimate-approved event today (estimates are SF imports) — revisit when #36 adds estimate authoring. Alternative: auto-confirm drafts (faster, but locks stock from unreviewed plans). |
| D6 | **Readiness definitions** — confirm "short" vs "at-risk", lead window, arrival buffer | `short` = shortfall with nothing on order and the job farther out than **3 days** (order it); `at-risk` = ETA after the job date, or not ordered and within 3 days; arrivals must land **1 day** before the job to count. Values live in the Rules screen. |
| D7 | **Estimate vs kit duplicate item** | Estimate quantity wins; kit quantity noted on the line; office adjusts. Summing would over-pull consumables that appear in both. |
| D8 | **Reservation priority** | First-come by reserve time; a moved job goes to the back of the queue. Simple and predictable; revisit if it bites. |
| D9 | **Kit edit semantics / versioning** | Snapshot into the plan on attach, version counter on the kit, explicit per-job Refresh that never overwrites adjusted lines. No per-version history table. |
| D10 | **Install-type taxonomy** | A free-text category label on the kit now; a real `install_types` table (with conditional rules and size selectors from the design) only if kits per type start to multiply. |
| D11 | **Plans for jobs created fresh in LOOP have no line items** (nothing authors them until #36) | Accept kits + manual adds as the primary path for new jobs, with estimate-generation working for imported / linked jobs. If you want estimate-driven plans for new work, estimate line authoring (#36) needs to move up — it is outside Lane 4. |
| D12 | **Where a pull goes and van-stock lines** | Pull to the job's virtual location (the pallet); Lane 4 fulfils from the shop only (`fulfil_location_id` column exists so Lane 2 can add van fulfilment). Alternative: pull straight to the assigned van now, which pulls Lane 2 scope into this lane. |
| D13 | **Alias learning** | Yes: resolving a needs-SKU line remembers the wording, so repeated estimate phrasing matches itself next time. |
| D14 | **Starter kit contents** | Not software work: you and the crews supply what goes in each kit. The office builds them in-app (or saves a real finished job as a kit). Tell me which install types come first and I will make the editor fit them. |

## 10. Out of scope (confirmed)

Van par levels, restock, low-stock alerts, tech own-van view (Lane 2); serial units, nameplate scan, RMA / quarantine return flow, cylinder tracking, `installed_systems` link (Lane 3); vendors, purchase orders, receiving, costing, auto-drafted POs (Lane 5, including any AP / invoicing / bid features, amendment 5); estimate authoring and the service-item picker (#36); conditional kit rules and size selectors; reporting screens for the metrics in §3.8; bulk seeding of the Service Fusion catalog (amendment 9).
