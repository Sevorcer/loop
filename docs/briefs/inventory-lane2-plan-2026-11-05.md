# Inventory Lane 2 (Vans, Par Levels, Restock) — Plan

Status: **DRAFT for Collin.** This document is the plan only. No application code, no migration files, and no schema changes ship with it. Build starts after Collin rules on every D# in §11.

Date: 2026-11-06
Brief: Zoinks, 2026-11-05 (Inventory Lane 2 — vans, par levels, restock)
Fits under: `docs/briefs/inventory-lane1-plan-2026-11-05.md` (approved 2026-11-05, vehicles amendment: no backfill, no seed vans)

Collin: the decisions are in **§11**. Each one has a recommended default. The rest of the doc is the build that follows those defaults. If you change a default, the "If this ruling goes the other way" note under that decision says what changes.

---

## 1. Context

Lane 1 is live. The company has one item list, a shop warehouse, a quarantine location, and an append-only stock ledger. Vans are real records the owner adds by hand on **Locations & vans**. The vans table is empty on purpose until those vans are added. Nothing in this lane creates vans, items, or par numbers.

This lane is for the **service techs** (Casey, Nate) first. It keeps a service truck full: what should be on it, what is actually on it, and a pick list from the shop when it runs low. Install crews do not run on van pars. Their materials are kits, job plans, and readiness, which are **Lane 4** and out of scope here.

What "full" means in this lane:

- A person can open a van and see on-hand next to the target.
- The office sets the targets in the app. There is no bulk load of pars.
- A count (first count-in, and later recounts) is a ledger adjustment, not an edit of history.
- Below-par lines become a pick list from **Shop warehouse**. Pulling the parts writes transfer rows. There is no purchasing and no automatic purchase order (Lane 5).

Costs stay invisible to techs. That rule already lives on `catalog_item_costs` and on `inventory_transactions.unit_cost_cents`. This lane does not give techs a way to read either.

---

## 2. What is already true (verified in the repo)

| Fact | Where it lives |
|---|---|
| Latest inventory migration | `20261125000000_vehicle_text_retire`. Lane 2 versions start at `20261127000000`. `20261126xxxx` belongs to Lane 4. |
| Item master | `catalog_items` (+ categories, price tiers). Cost is `catalog_item_costs`, readable by owner, manager, office only. |
| Locations | `inventory_locations.type` is `warehouse`, `van`, `job`, or `quarantine`. A van location must have a `vehicle_id`, and that vehicle can have only one location (`inventory_locations_vehicle_uidx`). |
| Shop | Seeded location **Shop warehouse** (4403 Russell Rd, Mukilteo) and **Quarantine / RMA**. |
| On-hand | `inventory_stock_levels.on_hand`, written only by the ledger trigger. Negative on-hand is allowed. INSERT/UPDATE/DELETE are revoked from `authenticated`. |
| Par columns already exist | `min_qty` and `max_qty` on `inventory_stock_levels`, both nullable, `min_qty <= max_qty` when both are set. Lane 1 left them empty for this lane. Nothing in the app writes them today. |
| A stock row appears only after a ledger insert | `fn_inventory_txn_apply` upserts the cache. A par for an item that has never moved has nowhere to sit until this lane adds a controlled insert of an `on_hand = 0` row. |
| Ledger | `inventory_transactions` is append-only (`receive`, `transfer_out`, `transfer_in`, `issue_to_job`, `return_from_job`, `adjust`, `count`, `buy_for_job`, `reversal`). UPDATE/DELETE/TRUNCATE raise. A transfer is two rows that share `transfer_group_id`. Reversing one row of a group reverses the whole group (`getTransactionWithGroup`). |
| Count already works | A `count` command posts `qty_delta = counted − on hand`. A matching count posts nothing. Counted quantity cannot be negative. Office posts it from **Adjust / Count** on the Stock screen. |
| Van location is created with the van | `createVehicle` in `src/services/inventoryLocations.ts` calls `ensureVanLocation`. The location name follows the van. If there is exactly one active warehouse, it becomes `parent_location_id`. The unique index makes a second location for the same van impossible. |
| Crew link | `crews.vehicle_id` is the only crew↔van link. One van per crew. There is no `vehicles.crew_id`. |
| No person↔van link | `crews.members` is a jsonb list of names, not user ids. `crews.lead_installer` is text. A tech login cannot be matched to a van safely from that data. Lane 1 called this out and left it for Lane 2. |
| Who can see stock today | Owner, manager, dispatch, office. Tech is denied `/inventory` entirely (`shellAccess.ts`, `navPermissions.ts`) and has no SELECT on locations, stock, or the ledger. Tech can read the catalog (no cost) and can read `vehicles` (needed for vehicle alerts). |
| Stock screen "Low" badge | `buildStockRows` sets `belowMin` only when on-hand is **at or under** min **and** the row is not already zero or negative. Zero shows as **Out**, negative as **Negative**. The Min column renders; Max does not. |
| Permission lock | `inventory_stock_levels` insert/update/delete are empty sets in `authorization.ts`, so the override UI cannot grant them. This lane keeps that lock. Par writes do not become a stock-level update grant. |

---

## 3. Recommended shape

These follow §11's defaults. They are the plan to build after approval.

1. **Keep creating the stock location when the van is added.** Lane 2 does not add vans again and does not switch to "create the location the first time someone opens stock." Vans already added through Locations & vans already have a location. A repair action appears only when a van has no location (the existing `ensureVanLocation` path, which is safe to run twice).
2. **Par is per van**, stored in the existing `min_qty` / `max_qty` on that van's stock rows. No van-class table. A **Copy from another van** action copies numbers; it does not link the vans.
3. **Minimum** means "flag this when on-hand is under this number." **Maximum** means "when we restock, fill up to this." If maximum is blank, fill up to the minimum. On-hand equal to the minimum is not low.
4. **Office edits pars** (owner, manager, office). Techs see them and cannot change them. Dispatch can see them (dispatch already reads stock) and cannot edit them.
5. **Office posts the first count-in.** After that van has at least one `count` row, the tech can recount **their** van. A recount is a `count` entry (the ledger delta from today's on-hand to the number they typed). Techs do not get free-form `adjust`. Office keeps Adjust / Count on every location, as today.
6. **Restock is self-serve.** The pick list is computed, not stored. The person at the shelf (the tech, or someone in the office) confirms quantities and posts. Each line is one normal transfer pair (shop → van), using the transfer command that already exists. Stock moves at pull time. There is no approval queue and no second "I received it" step.
7. **Each restock line keeps its own `transfer_group_id`.** Reversing a transfer reverses that pair only. Sharing one group across a whole pick would undo every part on the list when someone reverses one line, because reversal already reverses the whole group.
8. **Low-stock signals stay off until the van has been counted once.** Setting pars on an uncounted van (everything at 0) must not light up the list. After the first count, a line is low when `min_qty` is set and `on_hand < min_qty`, including zero and negative.
9. **The phone knows the van through `vehicle_operators`**, a person↔van list the office maintains on Locations & vans. `crews.vehicle_id` stays the crew link and is not the login link.
10. **Techs never receive SELECT on `inventory_transactions`.** That table carries `unit_cost_cents`. Their recent activity comes from a function that omits cost. Their writes go through a function that only allows a count on their van, or a transfer from the shop warehouse onto their van, and it forces `unit_cost_cents` to null.
11. **Negative on-hand stays legal.** The pick list warns when the shop does not have enough, the same way Stock already warns, and still lets the pull post.
12. **Install vans are not a separate mode.** A van with no pars never appears on the restock list. Install vans stay that way until Lane 4. This lane does not design kits.

---

## 4. Schema

All new tables follow Lane 1: `id uuid` default `gen_random_uuid()`, `org_id uuid NOT NULL` referencing `organizations`, `created_at` / `updated_at` with `fn_set_updated_at()`, `ENABLE` and `FORCE` row level security, policies `TO authenticated`, names `"table: description"`, role checks with `current_app_role()` and `org_id = current_org_id()`. Idempotent DDL. No seed inserts. Money is not stored on any new table.

### 4.1 `vehicle_operators` (new)

The person who opens My van. One row per person per van. A van can have more than one person. A person has one home van.

| Column | Notes |
|---|---|
| `vehicle_id uuid NOT NULL` | Composite FK `(vehicle_id, org_id)` → `vehicles`, `ON DELETE CASCADE` |
| `user_id uuid NOT NULL` | FK → `user_profiles`, same org, checked in the trigger below |
| `is_home boolean NOT NULL DEFAULT true` | The phone opens this van first |

Constraints and indexes:

- `UNIQUE (org_id, vehicle_id, user_id)`
- Partial unique index `vehicle_operators_one_home_uidx` on `(org_id, user_id) WHERE is_home`
- Index `(org_id, user_id)` and `(vehicle_id)`

`BEFORE INSERT OR UPDATE` trigger `fn_vehicle_operator_guard`: the vehicle and the user profile share `NEW.org_id`. Raises otherwise.

This table does not replace `crews.vehicle_id`. Crew assignment on the van dialog stays as it is.

Helper, `SECURITY DEFINER`, `search_path = public`, execute revoked from `PUBLIC` / `anon` and granted to `authenticated`:

```sql
fn_inventory_visible_vehicle_ids() RETURNS SETOF uuid
-- vehicle_id from vehicle_operators
-- where user_id = auth.uid() and org_id = current_org_id()
```

The helper reads `vehicle_operators` as definer so location and stock policies can call it without recursing through that table's RLS.

### 4.2 Par writes on `inventory_stock_levels` (no new columns)

Columns stay `min_qty` and `max_qty`. On-hand stays trigger-owned.

`fn_inventory_set_par(p_location_id uuid, p_item_id uuid, p_min numeric, p_max numeric)`:

- `SECURITY DEFINER`, `search_path = public`.
- Caller is `owner`, `manager`, or `office` (D4). `auth.uid()` is required.
- Location and item belong to `current_org_id()`. Location type is `van` and the location is active. Item is stockable and active.
- `p_min` and `p_max` are null or `>= 0`, at most 3 decimal places, and `p_min <= p_max` when both are set. Both null clears the par and leaves the row in place.
- No row yet: `INSERT` with `on_hand = 0` and the par values. This is the only insert that is not the ledger trigger, and on-hand in that insert is always 0.
- Row exists: `UPDATE` `min_qty`, `max_qty`, `updated_at` only.

`GRANT EXECUTE` to `authenticated`. Revoke from `PUBLIC` and `anon`.

`authenticated` still has **no** INSERT/UPDATE/DELETE on `inventory_stock_levels`. The empty-set lock in `authorization.ts` stays. A permission override cannot turn on stock edits.

Guard trigger `fn_inventory_stock_levels_guard`, `BEFORE UPDATE`:

- `fn_inventory_txn_apply` sets `inventory.ledger_apply` with `SET LOCAL` before its upsert. The flag lasts for that transaction only.
- While the flag is on: copy `OLD.min_qty` and `OLD.max_qty` onto `NEW` so a ledger post cannot wipe a par. On-hand may change.
- While the flag is off: raise if `on_hand`, `item_id`, `location_id`, or `org_id` changed.

`CREATE OR REPLACE` on `fn_inventory_txn_apply` adds only that flag. The upsert math is unchanged (`on_hand = on_hand + delta`).

### 4.3 Tech read and tech write (no new ledger columns)

**Do not** add a tech SELECT policy on `inventory_transactions`. Cost lives on that row.

Add policies (exact names the verify file will assert):

| Policy | Table | Who | What they can see |
|---|---|---|---|
| `inventory_locations: read own van and shop for tech` | `inventory_locations` | `tech` | Active `van` locations whose `vehicle_id` is in `fn_inventory_visible_vehicle_ids()`, and active `warehouse` locations in the org. Not job, not quarantine, not someone else's van. |
| `inventory_stock_levels: read own van and shop for tech` | `inventory_stock_levels` | `tech` | Stock rows whose location is one of those. |

Existing ops policies stay. Sales and portal stay denied.

`fn_inventory_my_van_activity(p_limit int)` returns `id`, `txn_type`, `item_id`, `location_id`, `qty_delta`, `reason`, `created_at` for the caller's van locations, newest first, default limit 50, **no** `unit_cost_cents`, `job_id`, or `transfer_group_id`. Definer, granted to `authenticated`, role check inside: `tech` sees own vans; `owner` / `manager` / `dispatch` / `office` may pass a van they can already read. Portal and sales get nothing.

`fn_inventory_post_van_entries(p_entries jsonb)` is the only way a tech appends ledger rows. It is definer and bypasses the office-only INSERT policy, so the checks inside are the authority:

1. `current_app_role() = 'tech'` and `auth.uid()` is not null. Office keeps using `postLedgerCommand` and the existing INSERT policy. Office does not go through this function.
2. Every location and item is in `current_org_id()`.
3. A **count** entry: location is an active van in `fn_inventory_visible_vehicle_ids()`; that van already has at least one `count` row (the office count-in). `txn_type = 'count'`. `qty_delta` equals the counted quantity minus current on-hand. Counted quantity is `>= 0`. `unit_cost_cents` is null. No `job_id`. A zero delta is skipped, matching today's count command.
4. A **transfer** entry arrives as a pair: `transfer_out` on the shop warehouse (the van location's `parent_location_id` when that parent is an active warehouse, otherwise the single active warehouse) and `transfer_in` on the caller's van, same item, opposite quantities, its own new `transfer_group_id`, `unit_cost_cents` null, no `job_id`. The pair is rejected if the shop location cannot be resolved.
5. Anything else (`receive`, `adjust`, `issue_to_job`, `return_from_job`, `buy_for_job`, `reversal`, a transfer onto another van, a count on the warehouse) raises.
6. Inserts set `created_by = auth.uid()` so the row matches the office rule.

The existing immutability trigger still blocks update and delete of those rows.

### 4.4 No restock table on the recommended path

The pick list is computed at read time:

- Van has at least one `inventory_transactions` row with `txn_type = 'count'`.
- Item is an active stockable catalog row.
- `min_qty` is not null and `on_hand < min_qty` (missing stock row counts as 0, which matters only after a count exists for the van; pars inserted at 0 before the count-in do not show).
- Suggested quantity is `max_qty - on_hand` when `max_qty` is set, otherwise `min_qty - on_hand`, never below 0.
- Shop on-hand for that item is shown beside it. It does not cap the suggestion.

Posting writes one existing transfer pair per line the person left checked, with reason `Restock`. The ledger is the record of the pull.

### 4.5 If a ruling adds a table

Only if Collin overrules a default. Do not build these on the recommended path.

**D2, per class instead of per van.** Add `20261127400000_inventory_par_templates`:

- `inventory_par_templates (id, org_id, name)` unique on `(org_id, lower(name))`.
- `inventory_par_template_lines (template_id, item_id, min_qty, max_qty)` primary key `(template_id, item_id)`.
- `vehicles.par_template_id uuid NULL`, same-org FK, `ON DELETE SET NULL`.

Applying a template **copies** lines onto the van through `fn_inventory_set_par`. The van's `min_qty` / `max_qty` stay the live numbers. Editing the template later does not silently change a van. RLS: same read as catalog (internal roles), write owner/manager/office, delete owner. Still no cost columns.

**D6, office gate instead of self-serve.** Add `20261127300000_inventory_restock_lists`:

- `inventory_restock_lists`: `vehicle_id`, `location_id` (the van), `source_location_id` (the shop), `status` in `requested`, `approved`, `pulled`, `cancelled`, `created_by`, `decided_by`, `pulled_by`, timestamps.
- `inventory_restock_lines`: `list_id`, `item_id`, `on_hand_snapshot`, `min_qty`, `max_qty`, `suggested_qty`, `picked_qty`. Unique `(list_id, item_id)`. No cost.
- Stock does not move when the list is requested or approved. `pulled` posts the transfer pairs, then the list is frozen. Cancelling posts nothing.
- RLS: tech inserts and reads lists for own vans while `requested`; owner/manager/office read and update any; dispatch reads. Portal and sales denied. Techs do not get `fn_inventory_post_van_entries` transfer rights on this ruling; the office posts the pull through `postLedgerCommand`.

---

## 5. Role matrix entries

Add these blocks to `docs/architecture/security/rls-role-matrix.md` under Inventory Lane 1, and the matching `CoreTable` sets in `src/services/authorization.ts`. Portal stays denied on every row. Empty write sets on `inventory_stock_levels` stay empty (locked invariant). `inventory_transactions` update/delete stay in `APPEND_ONLY_DENY`.

### vehicle_operators

Who may open which van on the phone. Office assigns people. Techs see their own rows and cannot assign themselves.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓ | ✓ | ✓ | own rows | ✓ | — | — |
| INSERT | ✓ | ✓ | — | — | ✓ | — | — |
| UPDATE | ✓ | ✓ | — | — | ✓ | — | — |
| DELETE | ✓ | — | — | — | — | — | — |

### inventory_locations (change)

Tech gains SELECT for own van and the shop warehouse only. Other roles unchanged. Tech still cannot insert, update, or delete.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓ | ✓ | ✓ | own van + shop | ✓ | — | — |
| INSERT | ✓ | ✓ | — | — | ✓ | — | — |
| UPDATE | ✓ | ✓ | — | — | ✓ | — | — |
| DELETE | ✓ | — | — | — | — | — | — |

### inventory_stock_levels (change)

Tech gains SELECT for the same locations. Writes stay locked for every role, including owner. Par changes go through `fn_inventory_set_par`, which is not an UPDATE grant.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓ | ✓ | ✓ | own van + shop | ✓ | — | — |
| INSERT | — | — | — | — | — | — | — |
| UPDATE | — | — | — | — | — | — | — |
| DELETE | — | — | — | — | — | — | — |

### inventory_transactions (unchanged grants)

Tech does **not** gain SELECT or INSERT. Cost stays on the row. Tech appends only through `fn_inventory_post_van_entries` (§4.3). The matrix stays:

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓ | ✓ | ✓ | — | ✓ | — | — |
| INSERT | ✓ | ✓ | — | — | ✓ | — | — |
| UPDATE | — | — | — | — | — | — | — |
| DELETE | — | — | — | — | — | — | — |

### catalog_item_costs (unchanged)

No tech, dispatch, sales, or portal policy. Van screens and the pick list never query this table. The tech post function refuses a non-null `unit_cost_cents`.

### Conditional tables

If D2 adds templates, or D6 adds restock lists, those tables get a matrix block in the same schema PR, using the grants in §4.5. They are not in the matrix until that ruling says to build them.

`TABLE_LABELS` in `src/features/settings/utils/permissionsMatrix.ts` gains `vehicle_operators: "Van assignments"`.

---

## 6. Migration list

Numbers are `20261127000000` and up. Each migration has a `-- DOWN` comment (required by `scripts/verify-migrations.sh` check 7) and a paired file at `supabase/verifications/<same name>.verify.sql`. Verify files are read-only `DO $$ BEGIN ASSERT …; END; $$;` blocks, per `docs/migration-verification-standard.md`.

Checksums: in the schema PR, append two lines per migration to `scripts/migration-checksums.sha256`. `sha256sum` format, two spaces, paths relative to the repo root:

```
<sha256 of the migration>  supabase/migrations/20261127000000_inventory_vehicle_operators.sql
<sha256 of the verify file>  supabase/verifications/20261127000000_inventory_vehicle_operators.verify.sql
```

Do not hand-write the hashes. Do not run `scripts/update-migration-checksums.sh` as-is to produce them: that script rewrites the manifest from `supabase/migrations/*.sql` only and would drop the `supabase/verifications/…` lines already in the file. Append the new lines; leave existing lines untouched. This plan PR adds no checksum lines, because it adds no SQL files.

No migration inserts vans, items, pars, counts, or operators.

### M1 — `20261127000000_inventory_vehicle_operators`

Creates §4.1 (table, FKs, indexes, guard, `fn_inventory_visible_vehicle_ids`, RLS, grants).

`-- DOWN`: drop the policy names, the trigger, the function, then the table.

Verify file `supabase/verifications/20261127000000_inventory_vehicle_operators.verify.sql` asserts:

- Table `vehicle_operators` exists; RLS is enabled and forced.
- Columns `vehicle_id`, `user_id`, `is_home` (boolean, not null), `org_id`.
- Indexes `vehicle_operators_one_home_uidx` and the `(org_id, user_id)` index exist by name.
- Policies by exact name: `"vehicle_operators: read for ops and self"`, `"vehicle_operators: insert for office+"`, `"vehicle_operators: update for office+"`, `"vehicle_operators: delete for owner"`.
- Function `fn_inventory_visible_vehicle_ids` exists, and `authenticated` does not have INSERT/UPDATE/DELETE on `inventory_stock_levels` (unchanged).

### M2 — `20261127100000_inventory_par_guard`

Creates §4.2 (`fn_inventory_set_par`, the stock-level guard trigger, the `CREATE OR REPLACE` of `fn_inventory_txn_apply` that sets `inventory.ledger_apply`). No new table. No column change. Grants execute on the par function. Does not grant table update.

`-- DOWN`: drop the guard trigger and `fn_inventory_set_par`; restore the previous `fn_inventory_txn_apply` body (the Lane 1 upsert with no flag). Pars already stored in `min_qty` / `max_qty` are left in place.

Verify file `supabase/verifications/20261127100000_inventory_par_guard.verify.sql` asserts:

- Functions `fn_inventory_set_par` and `fn_inventory_stock_levels_guard` exist.
- Trigger `trg_inventory_stock_levels_guard` exists on `inventory_stock_levels`.
- `min_qty` and `max_qty` are still nullable numerics.
- `authenticated` still lacks INSERT, UPDATE, DELETE, TRUNCATE on `inventory_stock_levels`.
- Execute on `fn_inventory_set_par` is granted to `authenticated` and not to `anon`.

### M3 — `20261127200000_inventory_tech_van_access`

Creates §4.3 (two tech SELECT policies, `fn_inventory_my_van_activity`, `fn_inventory_post_van_entries`). Does not add a tech policy on `inventory_transactions`.

`-- DOWN`: drop the two policies and both functions.

Verify file `supabase/verifications/20261127200000_inventory_tech_van_access.verify.sql` asserts:

- Policies `"inventory_locations: read own van and shop for tech"` and `"inventory_stock_levels: read own van and shop for tech"` exist.
- No policy on `inventory_transactions` grants `tech` (assert the policy set is still `"inventory_transactions: read for ops"` and `"inventory_transactions: insert for office+"`).
- Both functions exist; execute granted to `authenticated` only.
- `catalog_item_costs` policies are unchanged (still no tech SELECT).

### M4 — not on the recommended path

`20261127300000_inventory_restock_lists` exists only if D6 is an office gate (§4.5). `20261127400000_inventory_par_templates` exists only if D2 is per class (§4.5). Each would get the same verify-file and checksum treatment. If both defaults stand, those numbers stay unused.

---

## 7. PR stack (after Collin says build)

Four small PRs, in order. Schema first so screens compile against a real contract. Zoinks applies migrations; the builder does not. Each PR is independently reviewable. None of them includes kits, serials, or purchasing.

### PR A — Schema

M1, M2, M3 (and M4 only if a ruling requires it), their verify files, the checksum lines, the role-matrix doc, `authorization.ts` plus its test, and `TABLE_LABELS`. No UI.

### PR B — Office screens

Van stock, par editor, and the needs-restock list (read-only signals). Pars save through `/api/inventory/pars`, which calls `fn_inventory_set_par`. Copy-from-another-van lives here. Locations & vans gains the person assignment (D7) on the existing van dialog.

### PR C — Count and restock flows

Office count-in sheet (loops the existing `count` command). Office restock post (loops the existing `transfer` command, reason `Restock`). Low-stock list becomes actionable. Still no tech nav.

### PR D — Tech phone

My van: on-hand vs par, recount, and the self-serve pick list. This PR is the one that opens a route to techs. It lands last so nav and route-access merges stay in one place.

### Shared files Zoinks needs for merge order

These files are outside the inventory feature, or they are live Lane 1 files other lanes may touch.

| File | PR | Why it has to change |
|---|---|---|
| `src/services/authorization.ts` | A | New `vehicle_operators` CoreTable. Tech SELECT on locations and stock. Stock write sets stay empty. |
| `src/services/__tests__/authorization.test.ts` | A | Matrix coverage for the new grants and the still-locked stock writes. |
| `src/features/settings/utils/permissionsMatrix.ts` | A | `TABLE_LABELS` entry. |
| `docs/architecture/security/rls-role-matrix.md` | A | §5 blocks. |
| `docs/architecture/security/endpoint-authz-inventory.md` | B, C, D | New routes as they appear: `inventory/pars`, `inventory/vans/[vehicleId]/count`, `inventory/restock`, `inventory/my-van/count`, `inventory/my-van/restock`. |
| `scripts/migration-checksums.sha256` | A | Append-only lines from §6. Lane 4 will append `20261126xxxx` lines; keep both ends of the file stable. |
| `src/lib/routes.ts` | B, D | `INVENTORY_VAN`, `INVENTORY_VAN_PARS`, `INVENTORY_RESTOCK` in B. `INVENTORY_MY_VAN` in D. |
| `src/features/inventory/utils/inventoryTabs.ts` and `components/InventoryTabs.tsx` | B | Office tabs: Stock, Catalog, Locations & vans, Needs restock, Activity. My van does not use these tabs. |
| `src/features/inventory/utils/stockView.ts` and `screens/StockScreen.tsx` | B | Align the office Stock "Low" badge with D3 (`on_hand < min`, and zero/negative still show as low when a min is set). This changes a live screen. |
| `src/features/inventory/components/VehicleDialog.tsx`, `screens/LocationsScreen.tsx`, `app/api/inventory/vehicles/[id]/route.ts` | B | Assign `vehicle_operators` on the van that already exists. |
| `src/components/layout/Header.tsx` | B, D | Titles for the new routes. |
| `src/features/auth/utils/navPermissions.ts` | D | `INVENTORY_MY_VAN` allowed for `tech` only. `/inventory` stays owner/manager/dispatch/office. |
| `src/lib/auth/shellAccess.ts` | D | Tech is denied the `/inventory` prefix today, which would also block `/inventory/my-van`. Add an allow exception for that one path before the prefix check. Do not remove the `/inventory` deny. |
| `src/components/layout/sidebarNav.ts` | D | A **My van** item in the FIELD group. Tech preset order puts it next to Jobs. |
| `src/components/layout/__tests__/sidebarNav.test.ts`, `src/features/auth/__tests__/permissions.test.ts`, shell-access tests | D | The new item and the exception. |

Inventory-only files (new screens, `parRules.ts`, client islands) are not shared. Lane 4 should not need them.

`src/app/(shell)/inventory/page.tsx` and the other Lane 1 pages stay thin wrappers. New pages follow that pattern: import a screen, nothing else.

---

## 8. Screen specs

Same feature folder as Lane 1 (`src/features/inventory/`): screens are server components, writes are client islands (the Adjust / Count and Transfer dialog pattern), data through services and repositories. Pages under `src/app/(shell)/inventory/` stay tiny.

Visual language matches Lane 1: `PageHeader`, `SectionCard`, `StatusBadge`, `EmptyState`, `InventoryTable` for office, `fieldClass` / `tableHeadClass` / `tableCellClass`. Tokens only (`text-primary`, `text-muted`, `bg-surface-elevated`, `border-default`, `status-info`, StatusBadge `warning` and `danger`). No hardcoded status colors. Tap targets stay at least the tab height already used (`min-h-11`). Buttons show a pending state so a second tap does not post twice.

Office can keep the table (it already scrolls sideways). The tech screen does not use that table: `InventoryTable` forces a 32rem minimum width, which is wrong on a phone in the field. My van is a single column of cards.

Badges:

- **Below par** — `warning`, when a min is set and on-hand is under it.
- **Negative** — `danger`, in addition to Below par when on-hand is negative.
- On-hand equal to min, or no min set — no badge.

The badge lives on the van screen and on Needs restock. It is not a global sidebar counter (that would query stock on every page).

### 8.1 Van stock (office)

Route: `/inventory/vans/[vehicleId]`. Linked from Locations & vans (the van's name) and from the Stock location switcher when the selected location is a van.

Header: van name, plate, crew name (from `crews.vehicle_id`), status. If the van has no location, the only action is **Create stock location**, which calls the existing ensure path. The form to add a van is not shown again.

Body, one row per active stockable item (same rule as Stock: a zero is visible, not missing):

- Item name, SKU, unit.
- On hand, large enough to read.
- Par (the minimum) and fill-to (the maximum), or an em dash when unset.
- The badges above.

Search by name, SKU, brand, matching Stock. A filter chip **Below par** once the van has been counted. Before the first count, a calm banner: "This van has not been counted in yet. Set pars if you want, then count what is actually on the truck. Restock alerts stay off until that count is posted."

Actions for people who can post the ledger: **Count in** (links to the count sheet), **Edit pars**.

### 8.2 Par editor (office)

Route: `/inventory/vans/[vehicleId]/pars`. Owner, manager, office. Anyone else gets the existing access-denied state.

A list of active stockable items. Two numeric inputs per row, Minimum and Fill to. Blank means "not tracked on this van." Save sends only dirty rows to `fn_inventory_set_par`. Copy from another van asks for the source van, then fills the inputs; it does not save until the person saves. Nothing is seeded.

Validation copy, in plain language: "Fill to can't be less than the minimum." "Use a number, or leave it blank."

Techs do not get this route. They see the numbers on My van.

### 8.3 Needs restock (office)

Route: `/inventory/restock`. A list, not a purchasing screen.

Groups by van. Each line: item, on hand, minimum, suggested pull, shop on hand. Vans with no count-in are absent, with a one-line note of how many vans are waiting on a first count. Vans with no pars are absent. Shop quantity under the suggestion shows the same negative warning Stock already uses, and does not block the pull.

Primary action on a van group: **Pull** (PR C). Until PR C, the list is read-only and says the pull is not posted yet — PR B can ship the list without the button if that split is cleaner. The button posts one transfer per checked line.

There is no vendor, no PO, no "order this" action.

### 8.4 My van (tech, mobile first)

Route: `/inventory/my-van`. This is the only inventory URL a tech can open.

- No assignment: empty state, "You're not assigned to a van yet. The office assigns you on Locations & vans." No link into the office screens.
- One home van: open it. More than one assignment: a single picker, home van first.
- Retired van: say so, and hide count and restock.

The screen is three stacked sections, one column, thumb reach at the bottom:

1. **On the truck.** Cards. Item name. On-hand as the dominant number (`text-2xl` or the metric style, token `text-primary`). Under it, "Par 4" in `text-muted`. Below-par badge on the card. Search at the top. No cost, no SKU required on the card (SKU can sit in muted text if it exists).
2. **Restock.** The same pick-list math for this van only, plus shop on-hand. Stepper or numeric input for the pull quantity, defaulted to the suggestion. **I pulled these** posts through `fn_inventory_post_van_entries`. Hidden until the van has been counted (D8) and until at least one par is set.
3. **Recount.** One quantity per card, **Save count**. Hidden until the office count-in exists (D5). Saving posts `count` rows for lines that changed.

Recent activity is a short list under the cards (the cost-free function): "Counted", "Restock from shop", with the quantity and the time. No dollars.

Office opening My van is unnecessary; they use §8.1. The route is tech-only in nav. A direct visit by office can redirect to the van stock screen for their... office has no operator row, so the page shows the empty state with a link to Inventory. That is acceptable.

### 8.5 What does not change

Catalog, item sheet, activity ledger, receive, adjust, transfer, and reverse stay as Lane 1 built them. Stock's location switcher still includes vans; the van name links to §8.1 for the par and count tools. Quarantine and job locations are not par locations.

---

## 9. Flows

### 9.1 Van locations

The owner adds a van on **Locations & vans** (name, plate, optional crew). That screen already exists. `createVehicle` writes the `vehicles` row and `ensureVanLocation` writes the `type = 'van'` location, linked by `vehicle_id`, parented to Shop warehouse when it is the only warehouse. Lane 2 reads that pair. It does not ask anyone to recreate the van.

Crew assignment stays `crews.vehicle_id`, edited on the same dialog as today.

Person assignment (D7) is a second control on that dialog: which logins open this van on the phone, and which of those is the home van. Saving it writes `vehicle_operators` only.

If a van is listed and the stock-location cell is "—" (the location insert failed, or the van was inserted outside this UI), **Create stock location** runs `ensureVanLocation` once. The unique index prevents a duplicate.

Retiring a van deactivates its location, as Lane 1 already does. Pars and history stay. The van drops off the restock list because the location is inactive.

### 9.2 Par levels

Office opens the par editor for one van and types a minimum and, when they want a fuller reload, a fill-to. Example: capacitors, minimum 2, fill to 4. The van shows Below par at 0 or 1, and a restock suggests 4 minus whatever is on the truck.

A second service van does not inherit those numbers. **Copy from another van** is there for the morning both trucks should start alike; after that, each van is edited on its own. Casey and Nate can carry different quantities.

Install vans are left blank. Blank means "not part of restock."

Techs see "Par 2" on the card. They cannot open the editor.

### 9.3 Truck stock counts

First count-in is an office action, on the van, with the tech. The count sheet lists stockable items (pars first, then the rest). The person types what is physically there, including zeros they care about. Each changed line posts one `count` row: delta is counted quantity minus current on-hand (0 if the item has never moved). A line left blank is skipped. A line typed equal to on-hand posts nothing. The reason defaults to `Initial count-in`.

That first `count` row is what turns low-stock signals on for the van (D8).

Later recounts: the tech opens Recount on My van and types what is there now. Same `count` type. Reason defaults to `Recount`. They cannot post a plus/minus adjustment and cannot count the shop or the other van. Office can still use Adjust / Count on any location, including a correction with a reason, which remains an `adjust` row.

Nobody edits or deletes the old count. A wrong count is fixed by another count, or by an office reversal (opposite entry).

### 9.4 Restock

After the count-in, any line under its minimum is on the pick list.

Source is Shop warehouse: the van location's parent when that parent is an active warehouse, otherwise the single active warehouse. If that cannot be resolved, the screen says to set the shop as the van's parent and does not post.

The list shows suggested quantity (fill-to minus on-hand, or minimum minus on-hand). The person can lower a quantity or uncheck a line. Shop on-hand sits next to it so they don't walk the shelf for a part the shop doesn't have. If they pull more than the shop shows, the warning from Lane 1 appears and the transfer still posts. On-hand at the shop may go negative. That is existing design, not a new rule.

**I pulled these** (tech) or **Pull** (office) writes, per checked line, `transfer_out` on the shop and `transfer_in` on the van, reason `Restock`. Two rows, one `transfer_group_id` for that line. The cache trigger updates both on-hand numbers. The line leaves the list when the van is no longer under minimum.

There is no requested → approved → pulled status on the recommended path. The pull is the record.

A mistake on one part is reversed like any other transfer: one opposite pair, from the Activity screen, office only. The other lines of that restock stay.

### 9.5 Low-stock signals

In the app only. No email, no text, no purchase order, no draft order.

A line counts as low when all of these are true:

- The van location and the vehicle are active.
- The van has at least one `count` transaction.
- The item is active and stockable.
- `min_qty` is not null and `on_hand < min_qty`.

Office and dispatch see them on **Needs restock** and as badges on van stock. The tech sees them on My van. Sales and portal see nothing.

Warehouse minimums are not a Lane 2 screen. The columns exist on every location, and the par function rejects non-van locations so this lane cannot quietly become shop reorder. Shop reorder is Lane 5.

### 9.6 Screens

§8 is the screen contract. Flow through them:

1. Office adds the van (already possible) and assigns Casey or Nate.
2. Office sets pars, then posts the count-in. Alerts stay dark until step 2's count.
3. Office or the tech works Needs restock / My van → Restock and posts the pull.
4. The tech recounts when the truck drifts. The next pick list follows the new on-hand.

---

## 10. Build notes that are not decisions

- Pure helpers for "below par" and "suggested quantity" live in `src/features/inventory/utils/parRules.ts`, with unit tests. Screens and the post path both use them so the badge and the pick list cannot disagree.
- Server components fetch. Client islands are the par inputs, the count sheet, and the pick-list steppers.
- New API routes use `requirePermission` for office par writes (`vehicle_operators` or a dedicated check that the role is owner/manager/office before `fn_inventory_set_par`). Tech count and tech restock routes do **not** call `requirePermission(..., "inventory_transactions", "insert")`, because techs must not gain that grant. They check the tech role, then call `fn_inventory_post_van_entries`, which checks again.
- `endpoint-authz-inventory.md` is updated in the PR that adds each route.
- Feature tests cover the par math, the tech function's rejected shapes (adjust, other van, non-null cost), and the shell exception that `/inventory` stays denied while `/inventory/my-van` is allowed.

---

## 11. Open decisions for Collin

Ruling column is yours. The build uses the recommendation until you change it.

| # | Decision | Recommendation | If you rule the other way | Ruling |
|---|---|---|---|---|
| D1 | When does a van's stock location get created? | Keep today's behavior: the location is created when the van is added on Locations & vans. Do not re-add vans. | Lazy-on-first-use would stop `createVehicle` from calling `ensureVanLocation` and would create the location on the first count or par save. Vans already added would get a location from the repair action, not from being entered again. | |
| D2 | Are par levels per van, or one list shared by a van class? | Per van, in the existing min/max columns. Copy-from-another-van is a button, not a class. | Per class adds migration `20261127400000` (§4.5). The van's own numbers are still what the screen reads, copied from the class when you apply it. | |
| D3 | What do the minimum and the fill-to number mean? | Minimum flags the van when on-hand is **under** it. Fill-to is what a restock aims for. Blank fill-to means fill up to the minimum. Sitting exactly on the minimum is not low. | One number only: hide fill-to, and always suggest `minimum − on hand`. The `max_qty` column stays unused. | |
| D4 | Who can edit par levels? | Owner, manager, and office. Techs can see pars and cannot change them. Dispatch can see them and cannot edit them. | If techs should edit their own van, `fn_inventory_set_par` gains a tech branch limited to `fn_inventory_visible_vehicle_ids()`. | |
| D5 | Who counts the truck? | Office posts the first count-in. After that, the tech can recount their own van. Techs post counts, not free-form plus/minus adjustments. Office can always recount or adjust any location. | Tech-owned from day one: drop the "a count row must already exist" check so the tech's first save is the count-in. Office-only: do not build Recount on My van, and do not allow `count` inside the tech function. | |
| D6 | Does a restock need an office approval, or can the tech pull from the list? | Self-serve. The person at the shelf posts the transfer when they pull the parts. No approval queue and no second "I received it" tap. | Office gate adds `20261127300000` restock lists (§4.5). The tech can request; stock moves only when office marks it pulled. A two-step "shop sent it / tech confirmed" is the same extra status, with an in-between state where the parts have left the shelf and are not on the van yet. | |
| D7 | How does the phone know which van is Casey's or Nate's? | Office assigns the person on Locations & vans (`vehicle_operators`). Do not match names on the crew. The crew↔van link stays `crews.vehicle_id` and is not the login. | Matching `crews.members` text to a user's name is unsafe (names are not logins). A single `lead_user_id` on the crew covers one person and still misses a second tech on that van. | |
| D8 | When do low-stock signals turn on? | After that van's first count-in. Setting pars on an uncounted van does not flag every item at zero. | Signals on as soon as a par is set: drop the "has a count row" rule. The first restock list is then "fill every new par from zero," and the count happens after or instead. | |
| D9 | Do install vans show on the restock list? | Only if someone sets a par. There is no service/install switch. Leave install vans without pars; kits are Lane 4. | An explicit "this van uses kits" flag on the vehicle would hide it even if a par was set. That is a new column and a choice on the van dialog. Not recommended unless a par might get set on an install van by mistake. | |
| D10 | Can the tech see how many the shop has while picking? | Yes. Shop on-hand for the lines on their list, so they can skip a part the shop doesn't have. Never cost, never another van, never the full ledger. | Hide shop quantity: the tech sees only their van, and office is the one who can tell whether the shop can fill the list. The shop SELECT policy for techs comes out of M3, and the pick list drops that number. | |

---

## 12. Out of scope

Confirmed not in this lane:

- Kit templates, job material plans, pallets, readiness, dispatch material checks (Lane 4).
- Serial numbers, nameplate scan, refrigerant weight, RMA returns (Lane 3).
- Vendors, purchase orders, receiving, auto-drafted POs, costing method (Lane 5).
- Bulk seed of items or pars. Humans set pars in the app.
- Editing or deleting ledger rows. Reversals stay opposite entries.
- Turning negative on-hand into a hard block.
- Email, SMS, or a sidebar-wide badge.
- Rewriting `crews.members` into user ids. That is a workforce change, not van stock.
- Shop reorder points and warehouse par screens.

---

## 13. Risks

- **Tech write function is definer.** It bypasses the office INSERT policy. §4.3 is the allow-list, and the tests in §10 have to reject every other shape. A broad tech INSERT policy is the wrong shortcut.
- **Cost leak.** Any new tech query that selects `inventory_transactions.*` or `catalog_item_costs` fails the lane. Activity for the phone uses `fn_inventory_my_van_activity` only.
- **Stock "Low" badge changes in PR B** if D3 stands. Zero with a minimum becomes Below par on the office Stock screen as well as on the van, instead of only Out. Called out in §7 so it is not a surprise on a live page.
- **Checksum manifest.** Appending lines is safe. Regenerating the file with `update-migration-checksums.sh` is not, until that script learns about `supabase/verifications/`.
- **Lane 4 migration numbers.** Do not use `20261126xxxx`. If both lanes edit `authorization.ts`, `routes.ts`, `navPermissions.ts`, or `shellAccess.ts` in the same week, Zoinks sequences those with the table in §7. PR D is the inventory side of that collision and should merge last.
- **Uncounted vans look empty on purpose.** D8 means a van with pars and no count-in is absent from Needs restock. The banner on van stock is what tells the office why.
