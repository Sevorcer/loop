# LOOP Inventory Design — Review & Recommended Path
Source: Field_service_inventory_design.md (uploaded 2026-11-05)
Audit basis in source doc: production repo HEAD bceacd9, code-only, no live DB queried.

## Verdict
Design is sound and buildable. Core bet is right: don't copy ServiceTitan's catalog screens — close the loop they leave open.

**The differentiator:** Pre-dispatch readiness check
Job's required materials (from kit template) vs. warehouse + assigned van stock, minus already-committed stock → dispatch sees "short: 2 whips, 1 condensate pump" the day before, not at 7am.

## What to keep as-is
1. **Ledger-first** — append-only `inventory_transactions`, stock levels are a trigger-maintained cache. Cancellations/returns = opposite entry, not edits. Fixes competitor count-drift at the root.
2. **Locations model** — warehouse, van, job (virtual buy-for-job), quarantine/RMA. Trucks are locations with parent warehouse.
3. **Costs in separate table** (`inventory_item_costs`) — techs/portal never read cost. Enforced in DB, not just UI.
4. **Serialized units table** — furnaces, heat pumps, coils, air handlers, mini-split heads, refrigerant cylinders (R-454B and R-410A as separate SKUs).
5. **Mandatory reconciliation at close** — "full" closeout blocked until every plan line is used / returned-to-van / returned-to-warehouse. This is the direct fix for consumption never being logged.
6. **Buy-for-job bypass** — supply-house buys land in a virtual job location, don't inflate van/warehouse counts, still track cost.
7. **Purchasing LAST (Lane 5)** — matches LOOP constitution: don't swallow purchasing/accounting early.

## Biggest risks (doc names these honestly)
1. **Kit/BOM content — #1 risk, not technical.** No published install BOM exists. Every kit is a proposal until validated against Collin's real jobs. Quality of readiness check = quality of first 2-3 templates.
   → Mitigation in doc is correct: start with 2 highest-volume install types, advisory mode only (warn, don't block), pallet "missing/unneeded" tags feed back into templates.
2. **Evidence for "nobody else does readiness" is thin** — inference from missing docs, Reddit/G2 unreachable. Treat as hypothesis to prove with Legacy One near-misses, not a pitch claim yet.
3. **Current state is a stub, not partial** — `/inventory` reads `inventory_items` table that exists in NO migration (repo swallows error, returns empty), InventoryProvider hard-codes empty plans, techs can't even open the screen, API borrows `jobs` permission. Rebuild replaces it (server-first, per AGENTS.md), don't patch it.
4. **Migration drift** — checksums stop ~20261114, recent migrations lack -- DOWN. Doc flags it; new work starts at 20261121000000 and must follow full standard (verify file, RLS FORCE, CoreTable entry, rls-role-matrix + authz inventory updated same commit).

## Recommended lane order (as proposed — agree)
1. **Foundation** — vehicles, locations, items, item_costs, stock_levels, transactions + trigger; catalog/stock screens; seed from real Legacy One catalog/brands
2. **Vans & reorder** — par (min/max) per location, low-stock alerts, two-step restock (warehouse sends → tech confirms receipt), tech-visible own-van view
3. **Serialized equipment** — receive-by-serial, assign to job, link to `installed_systems.serial_numbers`
4. **Kits, plans & readiness** — install_types, kit_templates + lines (required/conditional/optional, size variants), plan expansion at scheduling, pallet/pull list, readiness → dispatch (`awaiting_materials`), closeout reconciliation gate
5. **Purchasing** — vendors, POs, partial/substitution receiving with edit history, auto-drafted POs grouped by vendor

Metrics from Lane 4: kit completeness at dispatch, missing-part events per install, supply-house runs on install day, over-pull/return rate, parts-attributed callbacks.

## Open questions — Zoinks' proposed defaults (Collin to confirm/correct)
1. **Install types:** Start with 2 only — (a) furnace swap, (b) heat pump / AC changeout. Add mini-split, coil/air handler, water heater after. Install type lives on the JOB as new nullable `install_type_id` (jobs.type has no sub-type and shouldn't get one).
2. **First BOMs:** Seed from Service Fusion estimate/job line items (names + cost, no SKU) + 2-3 recent real installs Collin names. Collin owns final BOM sign-off; installer/estimator confirms conditional lines (attic vs crawl, reuse line set, etc.).
3. **Locations today:** 1 warehouse = shop, 4403 Russell Rd, Mukilteo. Vans assigned per crew (3 crews). Install vans carry consumable par only; job-specific materials via pallet, not van stock.
4. **Physical flow:** Pallet built day before, tap-to-confirm v1 (no barcode/QR dependency to ship), scanning added later.
5. **Readiness gate:** Warn-only at first, dispatch + office can override with reason logged. No hard block until templates prove accurate.
6. **Suppliers / POs:** Low-stock alerts only in Lanes 1-4, no auto-POs until Lane 5.
7. **Costs:** Techs never see cost (already in design). Costing method TBD at Lane 5.
8. **Warranty registration:** Serial → installed_systems link is in Lane 3; warranty registration itself stays per-system / office-marked (existing LOOP decision 2026-10-02), not a new inventory workflow.

## Zoinks critique — redundancies & improvements (added 2026-11-05, Collin asked)

### Redundant / collision risks — fix in the brief, not after building
1. **Service Item List (#36) vs Inventory Catalog — biggest collision.** Allison's 50-item seed + SF's 416-product / 60-service catalogs are a *sell-price* catalog. Inventory is a *stock* catalog (SKU, cost, on-hand). Half the items are the same physical thing (condensate pump, contactor, thermostat, cap). Two separate catalogs WILL drift. Fix: one item master, two facets — sellable (price, from #36) and stockable (SKU/cost/on-hand, from inventory), linked 1:1 where both apply. Build them as one catalog effort, not two.
2. **Serial units vs `installed_systems.serial_numbers text[]`** — two sources of truth for the same serial. Lane 3 must pick one: serial_units is the truth, installed_systems syncs/links to it. Don't run both independently.
3. **Material plan lines vs `estimate_line_items` / `job_line_items`** — if a job was sold from an estimate, the plan should *generate from* those lines (matched to SKUs), not be typed twice. Unmatched estimate lines = the flag to add a SKU.
4. **Vehicles table vs `crews.truck_name` + `vehicle_alerts.vehicle_name`** — that's already two free-text truck concepts; vehicles makes three unless the brief includes migrating both onto the FK and retiring the text fields.
5. **Kit templates vs job checklist templates (`job_tasks`)** — same templating pattern, different domain. Reuse the pattern/code shape, don't build a second unrelated template engine — but don't merge them either, checklists aren't materials.
6. **Purchasing (Lane 5) vs QuickBooks/Joist** — office already invoices in QB and bids in Joist. Lane 5 must stay at PO/receiving/stock level only, no AP/invoicing creep, or it duplicates QB for nothing.

### Could do better than the brief
1. **Readiness ignores on-order/ETA.** It only checks on-hand minus committed. A part arriving tomorrow ≠ a part never ordered. Add on-order qty + ETA date to the check: short / arriving-in-time / at-risk are three different dispatch signals.
2. **Reservations need an expiry/release rule.** Stock committed to a job that reschedules 3 weeks out shouldn't stay locked and starve other jobs. Re-run readiness (and release/re-reserve) automatically when a job's date moves.
3. **Don't hard-block closeout on day one — for reconciliation either.** Same lesson as readiness: counts will be wrong for the first month, a hard gate just teaches techs to pencil-whip it. Advisory → soft block (office override) → hard block, in stages.
4. **Split install vs service stock priorities.** Design treats all vans the same. Install crews = kit/pallet flow (that's the win). Service techs (Casey, Nate) = real truck-stock replenishment. Lane 2's van work matters mostly for service; don't let it slow Lane 4, which is where install value is.
5. **Start the catalog way smaller.** Don't seed 400+ SF items. Equipment (serialized) + top ~50 consumables Legacy One actually pulls. A small accurate catalog beats a big stale one — same lesson as the kits.
6. **Nameplate scan (already specced feature A) belongs in Lane 3.** Serial capture by photo beats techs typing serials wrong. The brief treats serial entry as manual — fold the scan spec in.
7. **Refrigerant should track weight, not just cylinders.** EPA logging is by lbs added/recovered per job. Cylinder-as-serial is good, add lbs-used on the job line while you're there — cheap now, painful retrofit.
8. **RMA/warranty returns deserve a lane-3 spot, not lane 5.** Quarantine location exists in the design, but the return-to-supplier flow (e.g. a warranty valve) is a weekly real event, not a purchasing edge case.

### Not redundant, worth saying out loud
Ledger, readiness, closeout reconciliation, buy-for-job, cost-table separation — no existing LOOP feature does any of these. Dispatch materials (#403) is display/technical data, not stock truth. This build doesn't duplicate it.

## Next step if blessed
Turn Lane 1 into a Claude brief in docs/briefs/ (migration 20261121000000 spec, tables, RLS matrix from doc p. Roles table, screens) — plan-first per AGENTS.md, no code until Collin approves Lane 1 plan.
