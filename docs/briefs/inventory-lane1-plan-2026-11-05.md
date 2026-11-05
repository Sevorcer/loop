# Inventory Lane 1 (Foundation) — Implementation Plan

Status: **APPROVED by Collin 2026-11-05 (as written, with the vehicles amendment below).** Build sequence PR A–D. D2 stands: `catalog_price_tiers` is in Lane 1.

> **Amendment (Collin, 2026-11-05) — vehicles: NO backfill, NO seed vans.** M3 only adds the nullable FK columns (`crews.vehicle_id`, `vehicle_alerts.vehicle_id`); it creates **no** `vehicles` rows from `truck_name` / `vehicle_name`. No van list is coming — Collin adds the real vans himself on the Locations & vans screen. `jjj` and `Unmarked Van` alerts stay unlinked. M4 (drop the text fields) stays gated on the cutover being live-checked. This supersedes the backfill wording in §3 (M3) and decisions D4/D5; the seed script (§3) loads categories, catalog items, and the warehouse/quarantine locations only.
Date: 2026-11-05
Sources read: `field-service-inventory-design-2026-11-05.md`, `loop-inventory-design-review-2026-11-05.md`, `claude-brief-inventory-amendments-2026-11-05.md` (the Lane 1 approval brief calls it `loop-inventory-design-amendments-…`; the repo file is the `claude-brief-…` name), `claude-brief-inventory-lane1-approval-2026-11-05.md`. Where design and amendments disagree, amendments win.

## 0. What I verified first (live DB + repo, read-only)

| Fact | Finding |
|---|---|
| Latest applied migration | `20261122000000` (job_follow_ups). Lane 1 starts at `20261123000000`. |
| `inventory_items` table in prod | **Does not exist.** The `/inventory` stub reads a nonexistent table. Nothing to preserve or migrate. |
| `service_items` / #36 catalog | **Not built yet** (no table, no code). Lane 1's item master is what #36 will land on — see D2. |
| `crews` | 4 rows (Crew 1, 2, 3, Floater); `truck_name` is **empty on all four**. Backfill has nothing to carry; Collin supplies the real van list. |
| `vehicle_alerts` | 2 rows: `jjj` (test) and `Unmarked Van`. Neither maps to a real van. |
| `installed_systems` | Has `serial_numbers text[]`, `manufacturer`, `model_number`, warranty fields. Untouched in Lane 1; Lane 3 links it. |
| Stub footprint | `src/app/(shell)/inventory/{page,layout}.tsx`, `src/app/api/inventory/route.ts` (borrows `jobs` select), `src/repositories/inventory.ts`, `features/inventory/{state/InventoryProvider, screens/InventoryScreen, utils/mapInventoryItem(+test)}`. Only the layout/page/repository import the provider/mapper. |
| Sprint 18 types | `features/inventory/types/inventory.ts` + `utils/inventoryUtils.ts` (readiness vocabulary, `JobMaterialPlan`) are referenced by dispatch stubs. **Keep** for Lane 4; remove only the list stub path. |
| Verify-file location | The standard (`docs/migration-verification-standard.md`, `verify-migrations.sh` check 5) requires `supabase/verifications/<name>.verify.sql`. Recent migrations (incl. my `job_follow_ups`) put `.verify.sql` next to the migration in `supabase/migrations/`. Lane 1 follows the **standard** (see D6). |

## 1. Architecture decisions

1. **Ledger is the only way quantity changes.** `inventory_transactions` is append-only; `inventory_stock_levels` is a cache maintained by an `AFTER INSERT` trigger. Nobody (any role, including owner) has INSERT/UPDATE/DELETE on stock levels. Corrections, cancellations and returns are *opposite entries* referencing the original.
2. **One item master, two facets.** A single `catalog_items` table; `is_sellable` / `is_stockable` flags. Sell price and rate tiers live on the sellable facet; SKU/tracking/par live on the stockable facet; **cost lives in a separate table** (`catalog_item_costs`) so techs and portal can never read it — enforced by RLS, not UI. There is no `service_items` table, ever.
3. **Naming:** `catalog_*` = what exists/sells; `inventory_*` = where it is and how it moved. The stub's `inventory_items` name is retired (it would be a misnomer for sell-only labor/service items).
4. **Nothing hard-blocks in Lane 1.** On-hand may go negative; the UI shows a warning state instead of rejecting. (Staged enforcement per amendment 8.)
5. **Expand → contract for vehicles.** Prod migrations are applied *before* merge, so dropping `crews.truck_name` / `vehicle_alerts.vehicle_name` in the same migration would break the live app. Vehicle work is split: additive + backfill (M3), code cutover (PR), then drop the text fields (M4, applied only after the cutover deploys and is live-checked).
6. **Server-first.** Pages are tiny; screens are server components fetching via repositories/services; client islands only for dialogs/forms/filters. `InventoryProvider` (client, useEffect-fetch) is deleted.
7. **Costing policy deferred (Lane 5).** Lane 1 stores `unit_cost_cents` + preferred vendor text; it does not compute averages or valuations.
8. **No later-lane corners:** `tracking_mode` ('quantity'|'serialized') exists now; the ledger has nullable `job_id` now; Lane 3 adds `serial_unit_id` to the ledger and links `installed_systems` to `inventory_serial_units`; Lane 4 generates plan lines from `estimate_line_items`/`job_line_items` by adding a nullable `catalog_item_id` to those tables (likely landed by the #36 picker work first — coordinate, see D3).

## 2. Table definitions

All tables: `id uuid PK default gen_random_uuid()`, `org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`, `created_at/updated_at timestamptz` with `fn_set_updated_at()` trigger (ledger: `created_at` only). Money = `bigint` cents. Idempotent DDL (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`). `ENABLE` + `FORCE` RLS on every table; policies `TO authenticated`, named `"table: description"`, role checks via `current_app_role()` and `org_id = current_org_id()`; no `WITH CHECK (true)`.

### 2.1 `catalog_categories` (hierarchical)
`parent_id uuid NULL REFERENCES catalog_categories(id) ON DELETE RESTRICT`, `name text NOT NULL`, `sort_order int NOT NULL default 0`, `is_active boolean NOT NULL default true`. Unique `(org_id, parent_id, lower(name))` (COALESCE parent for root). Max depth enforced in app (3 levels). Index `(org_id, parent_id)`.

### 2.2 `catalog_items` — THE item master
| Column | Notes |
|---|---|
| `name text NOT NULL`, `description text` | |
| `category_id uuid NULL → catalog_categories` | |
| `is_sellable boolean NOT NULL default false`, `is_stockable boolean NOT NULL default false` | CHECK `is_sellable OR is_stockable` — items may be sell-only, stock-only, or both |
| `item_kind text NOT NULL` CHECK in (`'product'`,`'service'`,`'labor'`,`'equipment'`,`'refrigerant'`,`'consumable'`) | `service`/`labor` ⇒ not stockable (CHECK) |
| **Sellable facet:** `sell_price_cents bigint NULL`, `member_price_cents bigint NULL`, `is_taxable boolean NOT NULL default true` | CHECK: sellable ⇒ `sell_price_cents IS NOT NULL` (tier-priced services may carry the base tier price here) |
| **Stockable facet:** `sku text NULL`, `unit text NULL` (ea, ft, lb, box, roll…), `tracking_mode text NOT NULL default 'quantity'` CHECK in (`'quantity'`,`'serialized'`), `brand text`, `model text`, `mfr_part_number text`, `size_attrs jsonb NOT NULL default '{}'` (tonnage, diameter…) | CHECK: stockable ⇒ `unit IS NOT NULL`; serialized ⇒ stockable |
| `is_active boolean NOT NULL default true` | soft delete; hard delete owner-only and blocked by FK once any ledger row exists |
| `sf_id text NULL` | reserved for the Service Fusion crosswalk (#36); unused in Lane 1 |

Unique `(org_id, sku) WHERE sku IS NOT NULL`. Indexes: `(org_id, category_id)`, `(org_id, is_active)`, trigram/`lower(name)` for type-ahead (pg_trgm only if already enabled; otherwise `lower(name) text_pattern_ops`).

### 2.3 `catalog_price_tiers` (flat-rate tiers for services; pending D2)
`item_id → catalog_items ON DELETE CASCADE`, `label text NOT NULL` (e.g. "Standard", "After-hours"), `price_cents bigint NOT NULL`, `member_price_cents bigint NULL`, `sort_order int`. Unique `(item_id, lower(label))`. Sell prices only — same visibility as `catalog_items`.

### 2.4 `catalog_item_costs` (separate for cost secrecy)
`item_id uuid NOT NULL UNIQUE → catalog_items ON DELETE CASCADE` (1:1), `unit_cost_cents bigint NOT NULL CHECK (>= 0)`, `preferred_vendor text NULL`, `cost_updated_at timestamptz`, `cost_updated_by uuid`. Costing method is **not** decided here (Lane 5).

### 2.5 `vehicles`
`name text NOT NULL` ("Van 1"), `plate text NULL`, `vin text NULL`, `status text NOT NULL default 'active'` CHECK in (`'active'`,`'out_of_service'`,`'retired'`), `notes text`. There is **no** `crew_id` on `vehicles`: the crew↔van link is `crews.vehicle_id` only (one van per crew, unique). Unique `(org_id, lower(name))`. A user↔van link for the tech's *own van* view is Lane 2 (needs the roster model decision; `crews.members` is jsonb, not a FK).

### 2.6 `inventory_locations`
`type text NOT NULL` CHECK in (`'warehouse'`,`'van'`,`'job'`,`'quarantine'`), `name text NOT NULL`, `parent_location_id uuid NULL → inventory_locations` (van → warehouse), `vehicle_id uuid NULL → vehicles` (required when type='van', must be NULL otherwise — CHECK), `job_id uuid NULL → jobs` (required when type='job' — virtual buy-for-job), `address text NULL`, `is_active boolean default true`. Unique `(org_id, lower(name))`, unique `(vehicle_id) WHERE vehicle_id IS NOT NULL`, unique `(job_id) WHERE type='job'`. Seed: warehouse "Shop — 4403 Russell Rd, Mukilteo", one quarantine/RMA location. Van locations are created with their vehicle.

### 2.7 `inventory_stock_levels` (trigger-maintained cache)
`item_id`, `location_id`, `on_hand numeric(12,3) NOT NULL default 0` (numeric for ft/lb), `min_qty`/`max_qty numeric NULL` (par; **populated in Lane 2**, columns exist now to avoid a later rewrite). PK/unique `(item_id, location_id)`. Written only by the ledger trigger. Not constrained ≥ 0.

### 2.8 `inventory_transactions` (append-only ledger)
| Column | Notes |
|---|---|
| `txn_type text NOT NULL` | CHECK in (`'receive'`,`'transfer_out'`,`'transfer_in'`,`'issue_to_job'`,`'return_from_job'`,`'adjust'`,`'count'`,`'buy_for_job'`,`'reversal'`) |
| `item_id → catalog_items ON DELETE RESTRICT`, `location_id → inventory_locations ON DELETE RESTRICT` | one location per row |
| `qty_delta numeric(12,3) NOT NULL CHECK (qty_delta <> 0)` | signed; transfers are **two rows** sharing `transfer_group_id uuid` (−qty out, +qty in) |
| `job_id uuid NULL → jobs`, `reason text NULL`, `reverses_transaction_id uuid NULL UNIQUE → inventory_transactions` | a row can be reversed once; reason required for `adjust`/`reversal` (CHECK) |
| `unit_cost_cents bigint NULL` | snapshot at receive/buy; **not selectable by tech/portal** — but the ledger itself is office-only in Lane 1, so no split needed yet |
| `created_by uuid NOT NULL → user_profiles`, `created_at timestamptz NOT NULL default now()` | |

**Trigger spec**
- `trg_inventory_txn_apply` AFTER INSERT: `INSERT … ON CONFLICT (item_id, location_id) DO UPDATE SET on_hand = on_hand + NEW.qty_delta`. `SECURITY DEFINER`, `SET search_path = public`; org_id on the cache row copied from NEW.
- `trg_inventory_txn_immutable` BEFORE UPDATE OR DELETE (and a statement-level BEFORE TRUNCATE): `RAISE EXCEPTION` — append-only holds even for service_role/owner connections. REVOKE UPDATE, DELETE, TRUNCATE from `authenticated`/`anon`.
- Guards (`BEFORE INSERT`): item `is_stockable`; item/location/job same `org_id` as the row; `transfer_in/out` require `transfer_group_id`. **No on-hand ≥ 0 guard** (staged enforcement).
- Verify under FORCE RLS: the definer function must be able to write the cache table. If the migration owner lacks BYPASSRLS in prod, add an explicit trigger-only policy; the `.verify.sql` includes a transactional insert-and-rollback test of this.

## 3. Migration spec

Numbering: after `20261122000000`. Each has `supabase/verifications/<same>.verify.sql` (DO/ASSERT blocks per the standard), a `-- DOWN` section, a checksum entry (`scripts/update-migration-checksums.sh`).

| # | Version / name | Content |
|---|---|---|
| M1 | `20261123000000_catalog_item_master` | 2.1–2.4 + RLS + indexes + updated_at triggers |
| M2 | `20261123100000_inventory_locations_and_ledger` | 2.5 `vehicles`, 2.6, 2.7, 2.8 + trigger functions + RLS + REVOKEs |
| M3 | `20261123200000_vehicle_fk_expand` | **Expand.** Adds nullable `crews.vehicle_id` and `vehicle_alerts.vehicle_id` (same-org composite FKs → `vehicles`, `ON DELETE SET NULL (vehicle_id)`), a unique partial index on `crews.vehicle_id`, and an index on `vehicle_alerts.vehicle_id`. Creates and links nothing: no `vehicles` rows, no backfill from `truck_name` / `vehicle_name`. Idempotent. |
| M4 | `20261125000000_vehicle_text_retire` | **Contract.** Deletes the two junk alert rows (`jjj`, `Unmarked Van`; matched on legacy `vehicle_name`, same org, only rows still `vehicle_id IS NULL`), then makes `vehicle_alerts.vehicle_id NOT NULL` and drops `crews.truck_name` and `vehicle_alerts.vehicle_name`. Does not touch `vehicles`. **Applied only after the M3 cutover PR is deployed and live-checked, and after the PR D code merges first** so nothing live reads the dropped columns. Held as a separate PR so it cannot ride along early. |
| Seed | data, not DDL | Seed via an idempotent, org-scoped seed script (`scripts/sql/seed-inventory-lane1.sql`, run by Zoinks like other data loads), not a numbered migration — keeps org ids out of migrations. Warehouse/quarantine locations included. |

Same-commit doc/test updates (per repo standard): `docs/architecture/security/rls-role-matrix.md`, `docs/architecture/security/endpoint-authz-inventory.md`, `src/services/authorization.ts` (+ `authorization.test.ts`), `src/features/settings/utils/permissionsMatrix.ts` `TABLE_LABELS`, `scripts/migration-checksums.sha256`.

## 4. RLS / role matrix (CoreTable entries)

New `CoreTable` members: `catalog_categories`, `catalog_items`, `catalog_price_tiers`, `catalog_item_costs`, `vehicles`, `inventory_locations`, `inventory_stock_levels`, `inventory_transactions`.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `catalog_categories`, `catalog_items`, `catalog_price_tiers` | owner, manager, dispatch, tech, office, sales (**all internal roles view the catalog**, per #36) | owner, manager, office | owner, manager, office | owner |
| `catalog_item_costs` | owner, manager, office | owner, manager, office | owner, manager, office | owner |
| `vehicles` | owner, manager, dispatch, tech, office, sales (techs/sales file vehicle alerts and need the picker) | owner, manager, office | owner, manager, office | owner |
| `inventory_locations` | owner, manager, dispatch, office | owner, manager, office | owner, manager, office | owner |
| `inventory_stock_levels` | owner, manager, dispatch, office | **∅ (locked)** | **∅ (locked)** | **∅ (locked)** |
| `inventory_transactions` | owner, manager, dispatch, office | owner, manager, office (`created_by = auth.uid()`) | **∅** + `APPEND_ONLY_DENY` | **∅** + `APPEND_ONLY_DENY` |

Notes: `portal` denied everywhere. Tech has **no** stock/ledger/location access in Lane 1 — tech-visible own-van stock is Lane 2 (needs the user↔van link and own-van scoping). Empty sets are locked invariants in `authorization.ts` (`isEmptySetInvariant`), so stock quantities genuinely cannot be overridden via the permission-override UI; Lane 2 will add a min/max-only update path through a dedicated column-scoped route. Cost privacy = `catalog_item_costs` has no tech/dispatch/sales/portal policy. The `/api/inventory` route stops borrowing `jobs`.

## 5. Screens and code layout

Routes added to `src/lib/routes.ts` (`INVENTORY`, `INVENTORY_CATALOG`, `INVENTORY_LOCATIONS`, `INVENTORY_ACTIVITY`). Nav gate stays owner/manager/dispatch/office (`navPermissions.ts` unchanged except sub-routes).

1. **`/inventory` — Stock** (server): location switcher (warehouse / each van / quarantine), table of on-hand per item, negative-on-hand and zero-stock flags (info/warning tokens), search. Cost never shown here.
2. **`/inventory/catalog` — Catalog** (server + client filter island): category tree sidebar, facet filter (sellable / stockable / both / inactive), type-ahead search, table. Cost column rendered **server-side only when the role may read `catalog_item_costs`** (not CSS-hidden).
3. **Item sheet / `/inventory/catalog/[id]`**: edit item, sell facet, price tiers, stock facet, cost (cost block absent for roles without access), per-location on-hand.
4. **`/inventory/locations` — Locations & vans**: add/edit vehicles (creates its van location), warehouse/quarantine, crew assignment.
5. **`/inventory/activity` — Ledger**: append-only history, filter by item/location/job/type, reversal action (posts opposite entry with reason).
6. **Dialogs (client islands):** Receive, Adjust/Count, Transfer (paired entries), Reverse.
7. **Vehicle Alerts screen:** vehicle text input → vehicle picker (part of the M3 cutover). Dispatch/daily-plan crew cards read the truck name through `vehicles` (cutover list: `repositories/dispatch.ts`, `fieldRoster.ts`, `vehicleAlerts.ts` repo/service/route, `features/dispatch/types`, `features/daily-plans/{data/fieldCrews,types,utils,components}`, `features/vehicle-alerts/*` and their tests).

Layering: `src/features/inventory/{screens,components,hooks,utils,types}` (feature), `src/services/inventory*.ts` (business rules: reversal, paired transfer, same-org checks), `src/repositories/{catalog,inventoryLocations,inventoryLedger,vehicles}.ts`, ATLAS components reused (PageHeader, SectionCard, StatusBadge, EmptyState). Deleted: `InventoryProvider`, stub `InventoryScreen`, `repositories/inventory.ts`, `utils/mapInventoryItem(+test)`, old `/api/inventory`. Kept for Lane 4: Sprint 18 types/utilities.

PR plan (each ends with tsc + full suite run by Zoinks; my sandbox can't run them):
- **PR A:** M1 + M2 + authz/matrix/docs/tests + catalog/locations/ledger repos & services + APIs (no UI cutover yet).
- **PR B:** screens (Stock, Catalog, Item, Locations, Activity, dialogs) + stub removal + seed script.
- **PR C:** M3 + vehicle cutover (alerts, crews, dispatch, daily plans).
- **PR D:** M4 contract migration — merged only after C is live-verified.

## 6. Seed list (SMALL — proposed, installers/Collin to correct before load)

Not imported from Service Fusion's 416-item catalog. I have no real purchase history, so this is a **starting draft** drawn from the design's named items and the brands you install. Anything you never pull gets deleted from the list; anything missing gets added.

**Locations:** Shop warehouse (4403 Russell Rd, Mukilteo); Quarantine / RMA; one van per real van you give me (3 crews + Floater = up to 4 — I won't invent names or plates).

**Serialized equipment types** (`tracking_mode='serialized'`, brand/model captured per received unit in Lane 3; model-level SKUs created at first receipt): gas furnace; air handler; evaporator coil; AC condenser; heat pump condenser; ductless mini-split outdoor unit; mini-split indoor head; refrigerant cylinder R-454B; refrigerant cylinder R-410A. Brand list for filters/attrs: Coleman, Bosch, Trane, American Standard, Ameristar, Hisense, Mitsubishi.

**Consumables (~50, quantity-tracked):**
- *Line set & refrigerant side:* copper line set 1/4×3/8 (ft), 3/8×3/4 (ft), 3/8×5/8 (ft), 1/4×1/2 (ft); line set insulation (ft); brazing rod 15% (ea); filter drier; flare nuts; mini-split line-set kit; line-set cover/linehide (ft).
- *Condensate & drain:* PVC 3/4 pipe (ft), PVC 3/4 elbows, PVC 3/4 couplings, PVC primer, PVC cement, condensate pump, float/overflow switch, drain trap, vinyl tubing (ft).
- *Electrical:* disconnect box 60A non-fused, 30A whip/flex (ea), 6/3 wire (ft), 14/2 wire (ft), 18/5 thermostat wire (ft), wire nuts (box), 2-pole breaker 30A, 2-pole breaker 40A, 2-pole breaker 60A, surge protector, contactor 30A/2P, run capacitor (dual) 45/5, 35/5, 40/5.
- *Gas & venting:* gas flex connector 1/2 and 3/4, black pipe nipples/assorted, gas shutoff valve, pipe dope/tape, B-vent / flue pipe 4" (ft), flue 5" (ft), vent termination/cap, PVC vent 2" and 3" (ft), 2"/3" elbows.
- *Mounting & sealing:* condenser pad, line-set wall bracket, mini-split wall bracket, sheet-metal screws (box), foil tape (roll), mastic (tub), duct straps, spray foam, wall sleeves/seal.
- *Controls:* Honeywell VisionPro 8000 thermostat (ea), generic 24V thermostat, Honeywell zone panel, zone damper (round, assorted), return/supply grille assorted, 1" filter, 4" media filter.

(That's the working list — about 60 lines as drafted; I'll trim toward ~50 once you strike what you don't pull. Equipment types are catalog rows with `item_kind='equipment'`; consumables `item_kind='consumable'`; refrigerant cylinders `item_kind='refrigerant'` with unit `lb` for Lane 3's weight logging.)

Opening quantities are **not** seeded: first stock enters via real `receive`/`count` ledger entries after a physical count, so day-one numbers are real.

## 7. Open decisions for Collin / Zoinks

| # | Decision | My recommendation |
|---|---|---|
| D1 | Table naming: `catalog_*` + `inventory_*` (vs `inventory_items`) | `catalog_*` for the item master since it covers sell-only service/labor items too. |
| D2 | Create `catalog_price_tiers` in Lane 1, or leave to the #36 brief (which isn't settled: seed source, cost field, picker job types)? | Create it now so #36 lands on the one master rather than forking; it's a tiny table. If you'd rather hold it, I drop §2.3 and nothing else changes. |
| D3 | Who adds `catalog_item_id` to `estimate_line_items` / `job_line_items` (needed for the #36 picker and Lane 4 plan generation)? | The #36 picker work, on top of Lane 1. Lane 1 deliberately leaves line-item tables alone. |
| D4 | Test/legacy data: `jjj` and `Unmarked Van` alerts; empty crew truck names | Leave unlinked through M3; before M4, either you give me the real van names to relink or those two alert rows get a placeholder "Unassigned" vehicle. M4 can't run until this is settled. |
| D5 | Van list: how many vans, names, plates, which crew each rides with | Needed before the seed script runs. |
| D6 | Verify-file directory: standard says `supabase/verifications/`, recent migrations (incl. mine) used `supabase/migrations/` | Lane 1 uses `supabase/verifications/` per the written standard; Zoinks to say if `main`'s drift should be fixed separately. |
| D7 | Ledger `unit_cost_cents` snapshot — keep on the ledger (office-only in Lane 1) or defer until the tech-visible ledger exists in Lane 2? | Keep now; Lane 2 splits cost out of any tech-readable view. |
| D8 | Equipment seed granularity: type-level rows now, model-level SKUs at first receipt | Yes — avoids guessing model numbers. |

## 8. Risks

- **Trigger vs FORCE RLS** (definer write to the cache) — covered by an explicit verify test; fallback policy defined above.
- **M4 sequencing** — dropping text columns is the only destructive step; it is its own PR and gated on live-check of PR C.
- **Seed accuracy** — a wrong consumables list is worse than a short one; hence the draft + strike-through review before load.
- **Migration standard drift** on main (checksums, verify dir) — Lane 1 follows the standard; any pre-existing failures in `verify-migrations.sh` checks 5–7 will be flagged in the PR, not silently fixed.

## 9. Out of scope (confirmed)

Kits, material plans, readiness (Lane 4); par/restock/low-stock alerts, tech own-van view (Lane 2); serialized units, nameplate scan, RMA return flow, refrigerant lbs logging, `installed_systems` link (Lane 3); vendors/POs/receiving/costing method (Lane 5).
