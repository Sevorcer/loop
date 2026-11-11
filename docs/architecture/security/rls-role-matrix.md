# RLS Role Matrix — LOOP Internal Operations
**Version:** 1.0  
**Sprint:** 24  
**Status:** Approved  
**Last updated:** 2026-07-20

This document is the **single source of truth** for the LOOP internal operations permission model. The SQL policies in `database/policies/002_role_policies.sql` and the TypeScript contract in `src/services/authorization.ts` are both derived from this matrix.

For the external portal permission model (homeowner, GC, builder, property_manager roles), see [`docs/architecture/project-portal/authorization-matrix.md`](../project-portal/authorization-matrix.md).

---

## Role Definitions

| Role       | Who                        | Scope                                      |
|------------|----------------------------|--------------------------------------------|
| `owner`    | Company owner              | Full read/write on all internal tables     |
| `manager`  | Operations / office manager | Full operational r/w, no hard-delete      |
| `dispatch` | Dispatcher                 | Read operational data, update job status   |
| `tech`     | Field technician           | Read/update **own assigned** jobs only     |
| `office`   | Office staff               | Create/read customers & properties, read jobs |
| `sales`    | Sales team                 | Customers, properties, job prices, and revenue reports |
| `portal`   | External portal user       | Isolated — no access to any internal table |

**Portal isolation rule:** Users with the `portal` app_role are external stakeholders. They cannot access any internal operational table (`jobs`, `customers`, `properties`, `contractors`, `job_activity`). Access is exclusively through `portal_users` / `portal_memberships` tables.

---

## Permission Matrix

Legend: `✓` = allowed | `own` = own rows only | `status` = status column only (app-layer enforcement) | `—` = denied

### customers

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓       | ✓        | —    | ✓      | ✓     | —      |
| INSERT | ✓     | ✓       | —        | —    | ✓      | ✓     | —      |
| UPDATE | ✓     | ✓       | —        | —    | ✓      | ✓     | —      |
| DELETE | ✓     | —       | —        | —    | —      | —     | —      |

### properties

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓       | ✓        | ✓    | ✓      | ✓     | —      |
| INSERT | ✓     | ✓       | —        | —    | ✓      | ✓     | —      |
| UPDATE | ✓     | ✓       | —        | —    | ✓      | ✓     | —      |
| DELETE | ✓     | —       | —        | —    | —      | —     | —      |

### contractors

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓       | ✓        | ✓    | —      | —     | —      |
| INSERT | ✓     | ✓       | —        | —    | —      | —     | —      |
| UPDATE | ✓     | ✓       | —        | —    | —      | —     | —      |
| DELETE | ✓     | —       | —        | —    | —      | —     | —      |

### jobs

| Action | owner | manager | dispatch | tech      | office | sales | portal |
|--------|-------|---------|----------|-----------|--------|-------|--------|
| SELECT | ✓     | ✓       | ✓        | own       | ✓      | ✓     | —      |
| INSERT | ✓     | ✓       | —        | —         | ✓      | —     | —      |
| UPDATE | ✓     | ✓       | status   | own+status| —      | —     | —      |
| DELETE | ✓     | —       | —        | —         | —      | —     | —      |

> **dispatch / tech UPDATE note:** Dispatch and tech may update job rows at the RLS layer. Column-level restriction (only `status` may be changed) is enforced at the application service layer, not via RLS, because Supabase column-level security requires PostgreSQL 15+. This is documented here so the application layer can be audited independently.

### job_activity

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓       | ✓        | own  | ✓      | company | —      |
| INSERT | ✓     | ✓       | ✓        | own  | ✓      | price   | —      |
| UPDATE | —     | —       | —        | —    | —      | —     | —      |
| DELETE | —     | —       | —        | —    | —      | —     | —      |

> **Append-only:** `job_activity` is an immutable audit log. No role may UPDATE or DELETE rows. Office may insert so a note they add is recorded on the timeline. Tech read and insert follow job assignment (`assigned_user_id` or `job_assignees`). Sales may read activity in their company so a production report can use the completion date, and may insert only a `price` row. That row does not include the dollar amount.

### time_off

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓       | ✓        | own  | ✓      | —     | —      |
| INSERT | ✓     | ✓       | ✓        | —    | ✓      | —     | —      |
| UPDATE | ✓     | ✓       | ✓        | —    | ✓      | —     | —      |
| DELETE | ✓     | ✓       | ✓        | —    | ✓      | —     | —      |

> A technician can read only their own time off. They cannot create or change it.

### calendar_tasks

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓       | ✓        | assigned or everyone | ✓ | — | — |
| INSERT | ✓     | ✓       | ✓        | —    | ✓      | —     | —      |
| UPDATE | ✓     | ✓       | ✓        | mark done | ✓ | — | — |
| DELETE | ✓     | ✓       | ✓        | —    | ✓      | —     | —      |

> Tech updates are limited to `done_at` and `done_by` by `guard_tech_calendar_task_update`.

### calendar_saved_groups

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓       | ✓        | —    | ✓      | —     | —      |
| INSERT | ✓     | ✓       | ✓        | —    | ✓      | —     | —      |
| UPDATE | ✓     | ✓       | ✓        | —    | ✓      | —     | —      |
| DELETE | ✓     | ✓       | ✓        | —    | ✓      | —     | —      |

> Shared person filters for the calendar. A technician cannot read them. Each browser still remembers which people that user currently has selected.

### job_financials

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓       | ✓        | assigned | ✓      | ✓     | —      |
| INSERT | ✓     | ✓       | ✓        | —        | ✓      | ✓     | —      |
| UPDATE | ✓     | ✓       | ✓        | —        | ✓      | ✓     | —      |
| DELETE | ✓     | ✓       | ✓        | —        | ✓      | ✓     | —      |

> Job price in cents. Owner, manager, dispatch, office, and sales can read and change it for a job in their company, including the price history. A technician can read it only on a job they are assigned to. Revenue reports, the CSV export, and the reports API stay with owner, manager, dispatch, office, and sales. Technicians and portal users cannot open them. The job timeline records who changed the price and does not include the amount.

### job_notes

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓       | ✓        | own  | ✓      | ✓     | —      |
| INSERT | ✓     | ✓       | ✓        | own  | ✓      | —     | —      |
| UPDATE | —     | —       | —        | —    | —      | —     | —      |
| DELETE | —     | —       | —        | —    | —      | —     | —      |

> **Append-only:** each note is its own row (author, role, timestamp). Techs insert only on jobs assigned to them. The legacy `jobs.notes` column is kept; new notes are not written by replacing it.

### job_signatures

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓       | ✓        | own  | ✓      | ✓     | —      |
| INSERT | ✓     | ✓       | —        | own  | ✓      | —     | —      |
| UPDATE | —     | —       | —        | —    | —      | —     | —      |
| DELETE | —     | —       | —        | —    | —      | —     | —      |

> **Append-only:** each capture stores the signer name, the teammate who captured it, and the time. The image is in the private `job-signatures` bucket. Techs read and insert only on jobs assigned to them (`assigned_user_id` or `job_assignees`). Storage policies follow the same job visibility, so a technician cannot download another crew's signature file.

### job_callbacks

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓       | ✓        | own  | ✓      | ✓     | —      |
| INSERT | ✓     | ✓       | ✓        | —    | ✓      | —     | —      |
| UPDATE | —     | —       | —        | —    | —      | —     | —      |
| DELETE | —     | —       | —        | —    | —      | —     | —      |

> **Return visits:** office and dispatch create a Callback job from a completed job. The link stores the reason and points both ways. Techs can read a link when they are assigned to either job. Dispatch still cannot create an ordinary job. A jobs INSERT policy allows dispatch to insert a row only when `type` is `Callback`. `POST /api/jobs` remains denied for dispatch.

### portal_users

| Action | owner | manager | dispatch | tech | office | sales | portal (own row) |
|--------|-------|---------|----------|------|--------|-------|-----------------|
| SELECT | ✓     | ✓       | —        | —    | —      | —     | own             |
| INSERT | ✓     | ✓       | —        | —    | —      | —     | —               |
| UPDATE | ✓     | ✓       | —        | —    | —      | —     | own             |
| DELETE | ✓     | —       | —        | —    | —      | —     | —               |

### portal_memberships

| Action | owner | manager | dispatch | tech | office | sales | portal (own row) |
|--------|-------|---------|----------|------|--------|-------|-----------------|
| SELECT | ✓     | ✓       | —        | —    | —      | —     | own             |
| INSERT | ✓     | ✓       | —        | —    | —      | —     | —               |
| UPDATE | ✓     | ✓       | —        | —    | —      | —     | —               |
| DELETE | ✓     | —       | —        | —    | —      | —     | —               |

---

### Storage: `manuals` bucket (private)

PDF copies of indexed manuals (`drive_manual_files.storage_path`). One policy, SELECT only (`manuals_storage_select`, 20261124000000):
owner / manager / dispatch / office / sales / tech may read an object only when a `drive_manual_files` row visible to them (so same-org, via that table's RLS) points at its path. No INSERT/UPDATE/DELETE policy; uploads are service-side. portal / anon: none. Served to the browser only through `GET /api/manuals/:id/file` (no signed-URL redirect).

---

## Inventory Lane 1 (migrations 20261123000000, 20261123100000)

All eight tables are RLS ENABLE + FORCE, org-scoped via `current_org_id()`. Portal users have no access to any of them.

### catalog_categories

Item categories (hierarchical, max 3 levels).

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | ✓     | ✓     | ✓     | —      |
| INSERT | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| UPDATE | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| DELETE | ✓     | —     | —     | —     | —     | —     | —      |

### catalog_items

Item master (sellable + stockable facets). Retail price lives here; cost does not.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | ✓     | ✓     | ✓     | —      |
| INSERT | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| UPDATE | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| DELETE | ✓     | —     | —     | —     | —     | —     | —      |

### catalog_price_tiers

Named price tiers per item.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | ✓     | ✓     | ✓     | —      |
| INSERT | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| UPDATE | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| DELETE | ✓     | —     | —     | —     | —     | —     | —      |

### catalog_item_costs

Unit cost, kept apart so cost never leaks to technicians or sales through the catalog.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| INSERT | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| UPDATE | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| DELETE | ✓     | —     | —     | —     | —     | —     | —      |

### vehicles

Fleet vehicles. Added by hand in the Locations & vans screen; never auto-created. Readable by all internal roles because techs and sales file vehicle alerts.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | ✓     | ✓     | ✓     | —      |
| INSERT | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| UPDATE | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| DELETE | ✓     | —     | —     | —     | —     | —     | —      |

### inventory_locations

Warehouse, van, job and quarantine locations. Tech SELECT was added in Lane 2 (`20261127200000`) and is limited to the tech's own active van and active warehouses. Other roles are unchanged from Lane 1. Tech still cannot insert, update, or delete.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | own van + shop | ✓     | —     | —      |
| INSERT | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| UPDATE | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| DELETE | ✓     | —     | —     | —     | —     | —     | —      |

### inventory_stock_levels

Cache maintained by a SECURITY DEFINER trigger on the ledger. No role (including owner) can write it directly; INSERT/UPDATE/DELETE are revoked from `authenticated`. Par changes go through `fn_inventory_set_par` (Lane 2) and are not an UPDATE grant. Tech SELECT matches locations: own active van and active warehouses only.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | own van + shop | ✓     | —     | —      |
| INSERT | —     | —     | —     | —     | —     | —     | —      |
| UPDATE | —     | —     | —     | —     | —     | —     | —      |
| DELETE | —     | —     | —     | —     | —     | —     | —      |

### inventory_transactions

Append-only stock ledger. `created_by` must equal `auth.uid()`. UPDATE, DELETE and TRUNCATE are blocked by trigger and revoked. Corrections are opposite entries.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | —     | ✓     | —     | —      |
| INSERT | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| UPDATE | —     | —     | —     | —     | —     | —     | —      |
| DELETE | —     | —     | —     | —     | —     | —     | —      |

## Inventory Lane 2 (migrations 20261127000000, 20261127100000, 20261127200000)

Collin ruled D1–D10 on 2026-11-06 as the plan recommended. No par-template table and no restock-list table. `20261127300000` and `20261127400000` stay unused. Stock still changes only by appending `inventory_transactions`. Costs stay off every tech path: there is no tech policy on `inventory_transactions` or `catalog_item_costs`.

Person assignment on Locations & vans (writing `vehicle_operators` from the van dialog) is the next PR. This section is the grant.

### vehicle_operators

Who may open which van on the phone. Office assigns people. Techs see their own rows and cannot assign themselves. This does not replace `crews.vehicle_id`.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | own rows | ✓     | —     | —      |
| INSERT | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| UPDATE | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| DELETE | ✓     | —     | —     | —     | —     | —     | —      |

### inventory_locations (Lane 2)

Tech gains SELECT for the active van locations in `fn_inventory_visible_vehicle_ids()` and for active warehouses. Not job, not quarantine, not someone else's van. Other roles are unchanged. The `inventory_locations` table in the Lane 1 section is the current grant.

### inventory_stock_levels (Lane 2)

Tech gains SELECT for those same locations. Writes stay locked for every role, including owner. `fn_inventory_set_par` (owner, manager, office; active van; active stockable item) is the only par write. The ledger apply sets `inventory.ledger_apply` so a stock movement cannot clear `min_qty` / `max_qty`.

### inventory_transactions (unchanged grants)

Tech does not gain SELECT or INSERT. Cost stays on the row. A tech appends only through `fn_inventory_post_van_entries`: a `count` on an already counted-in van they are assigned to, or a `transfer_out`/`transfer_in` pair from that van's shop warehouse onto that van, with `unit_cost_cents` forced null. Office keeps `postLedgerCommand` and the INSERT policy. `fn_inventory_my_van_activity` returns id, type, item, location, quantity delta, reason, and time. It does not return cost, job, or transfer group.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | —     | ✓     | —     | —      |
| INSERT | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| UPDATE | —     | —     | —     | —     | —     | —     | —      |
| DELETE | —     | —     | —     | —     | —     | —     | —      |

## Inventory Lane 4 (migrations 20261126000000, 20261126100000, 20261126200000, 20261126300000, 20261126400000, 20261126500000, 20261126600000)

Kit templates and the inventory rules row. Nothing here is seeded. `save_kit_template()` is SECURITY INVOKER, so these policies apply to it.

### inventory_settings

One row per org (readiness lead/buffer days, closeout enforcement stage). Absent row = built-in defaults. Owner creates and edits; there is no DELETE policy and the privilege is revoked.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | —     | ✓     | —     | —      |
| INSERT | ✓     | —     | —     | —     | —     | —     | —      |
| UPDATE | ✓     | —     | —     | —     | —     | —     | —      |
| DELETE | —     | —     | —     | —     | —     | —     | —      |

### kit_templates

Named install kits built from the catalog. Every internal role reads (crews should see what is in a kit). Kits are snapshots once attached to a job (a later PR), so edits never change existing jobs.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | ✓     | ✓     | ✓     | —      |
| INSERT | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| UPDATE | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| DELETE | ✓     | —     | —     | —     | —     | —     | —      |

### kit_template_lines

Catalog-backed lines (never free text). A kit save replaces its lines as a set, so owner, manager and office can delete lines (the kit itself stays owner-delete).

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | ✓     | ✓     | ✓     | —      |
| INSERT | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| UPDATE | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| DELETE | ✓     | ✓     | —     | —     | ✓     | —     | —      |

### job_material_plans

One plan header per job (draft or confirmed). Editing is office-side; confirming and reopening are owner, manager, dispatch and office. A trigger stamps who confirmed and when. Techs read the plan but change line state and quantity through `job_material_lines`, not the header.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | ✓     | ✓     | ✓     | —      |
| INSERT | ✓     | ✓     | ✓     | —     | ✓     | ✓     | —      |
| UPDATE | ✓     | ✓     | ✓     | —     | ✓     | —     | —      |
| DELETE | —     | —     | —     | —     | —     | —     | —      |

### job_kits

Kits attached to a job (a snapshot of the kit at attach time). Anyone who can edit a plan can attach or refresh a kit.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | ✓     | ✓     | ✓     | —      |
| INSERT | ✓     | ✓     | ✓     | —     | ✓     | ✓     | —      |
| UPDATE | ✓     | ✓     | ✓     | —     | ✓     | ✓     | —      |
| DELETE | ✓     | ✓     | ✓     | —     | ✓     | ✓     | —      |

### job_material_line_events

Append-only history of every plan-line change (who, when, why). The actor and time are stamped by trigger and UPDATE/DELETE privileges are revoked. Most events are written by the line trigger; a tech may only insert quantity-change events.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | ✓     | ✓     | ✓     | —      |
| INSERT | ✓     | ✓     | ✓     | ✓ (qty only) | ✓ | ✓ | —      |
| UPDATE | —     | —     | —     | —     | —     | —     | —      |
| DELETE | —     | —     | —     | —     | —     | —     | —      |

### catalog_item_aliases

"This estimate wording means that catalog item", written when a needs-SKU line is linked. Resolving needs-SKU lines is owner, manager and office. Dispatch and sales can read.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | —     | ✓     | ✓     | —      |
| INSERT | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| UPDATE | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| DELETE | ✓     | ✓     | —     | —     | ✓     | —     | —      |

### inventory_reservations

Stock held for a job line. Rows are never deleted: a database guard allows only active → pulled / released / consumed (and pulled → consumed / released), and the stamp trigger forces new rows to `active` with `auth.uid()`. Created and released by the `reserve_job_materials` / `release_job_reservations` functions (SECURITY INVOKER, role-checked: others get 42501). The `inventory_available` view (security_invoker) subtracts active and pulled claims on live jobs from on-hand.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | —     | ✓     | —     | —      |
| INSERT | ✓     | ✓     | ✓     | —     | ✓     | —     | —      |
| UPDATE | ✓     | ✓     | ✓     | —     | ✓     | —     | —      |
| DELETE | —     | —     | —     | —     | —     | —     | —      |

### inventory_expected_arrivals

What is on its way (item, receiving warehouse, quantity, date, optional job it is a special order for). Non-expected rows are frozen by a guard trigger; item and location never change. `receive_expected_arrival` posts the ledger `receive` and marks the row received in one call (owner, manager, office). Dispatch reads so the board can explain readiness.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | —     | ✓     | —     | —      |
| INSERT | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| UPDATE | ✓     | ✓     | —     | —     | ✓     | —     | —      |
| DELETE | ✓ (not received) | —  | —     | —     | —     | —     | —      |

### job_readiness_snapshots

Append-only record of a job's material readiness when its plan is confirmed, when its rollup changes, and when the job is dispatched. Actor and time are stamped by trigger; UPDATE/DELETE privileges are revoked (a job delete still cascades). A tech may insert only the `dispatched` row on a job assigned to them.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | —     | ✓     | —     | —      |
| INSERT | ✓     | ✓     | ✓     | ✓ (dispatched, assigned jobs) | ✓ | — | —      |
| UPDATE | —     | —     | —     | —     | —     | —     | —      |
| DELETE | —     | —     | —     | —     | —     | —     | —      |

### job_material_events

Append-only field events (missing part, wrong part, substitution, unplanned use, supply-house run, kit feedback) used to improve kits. A tech reads and adds events only on jobs assigned to them.

| Action | owner | manager | dispatch | tech | office | sales | portal |
|--------|-------|---------|----------|------|--------|-------|--------|
| SELECT | ✓     | ✓     | ✓     | ✓ (assigned jobs) | ✓ | — | —      |
| INSERT | ✓     | ✓     | ✓     | ✓ (assigned jobs) | ✓ | — | —      |
| UPDATE | —     | —     | —     | —     | —     | —     | —      |
| DELETE | —     | —     | —     | —     | —     | —     | —      |

---

### Pull flow (20261126500000)

`inventory_transactions` gains a nullable `material_line_id` (same-org composite FK to `job_material_lines`, `ON DELETE RESTRICT`; the append-only ledger cannot take a `SET NULL` update). A BEFORE INSERT trigger requires a linked row to carry a `job_id` and to match the line's job and catalog item. Ledger policies are unchanged: only owner, manager, and office can write.

`ensure_job_location()`, `pull_job_materials()`, and `return_pallet_to_shop()` are SECURITY INVOKER, granted to `authenticated` only, and refuse every role except owner, manager, and office (SQLSTATE 42501). Returns are allowed only for Cancelled or deleted jobs. `remove_material_line()` now refuses lines that already have ledger rows.

`inventory_stranded_pallets` is a `security_invoker` view over `inventory_stock_levels`, so it shows exactly the rows the caller can already read.

### Closeout reconciliation (20261126600000)

`job_material_lines` gains `used_qty`, `returned_qty`, `recovered_qty`, and `variance_reason`. The technician column guard still limits techs to state, quantity, and these four columns on jobs assigned to them, and a reconciled line is frozen for them. Only `reconcile_job_materials` moves a line to the `reconciled` stage (it sets a transaction-local flag the guard honours).

`reconcile_job_materials()` is the one SECURITY DEFINER function in Lane 4: an assigned technician may reconcile their job but cannot write the ledger. It requires an authenticated owner, manager, office, or assigned tech in the job's own organization, refuses cancelled or deleted jobs, takes advisory locks, and posts `issue_to_job`, a pallet-to-shop transfer, and an explained `adjust` in one transaction. `override_material_reconciliation()` is SECURITY INVOKER (owner, manager, office).

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `job_material_reconciliations` | owner, manager, dispatch, office; tech on assigned jobs | owner, manager, office (overrides only); `submitted` rows come from the function | none | none |
| `refrigerant_log_entries` | owner, manager, dispatch, office; tech on assigned jobs | none (written only by `reconcile_job_materials`) | none | none |

### Technician "no system installed" attestation (20261127700000)

`guard_tech_job_update` stays an allowlist (technicians may change only `status`), but now also exempts `jobs.no_system_installed`, `no_system_installed_by` and `no_system_installed_at`. A technician may set or clear the closeout attestation, matching what the UI and API already allow every role. Integrity rule: setting it must stamp `_by = auth.uid()` and a non-null `_at`; clearing must null both. Every other column, including any added later, stays locked for technicians. Other roles are unaffected.

### Serialized units (20261128000000)

`inventory_serial_units` is the single serial truth for equipment and refrigerant cylinders. RLS is enabled and forced; `anon` has no privileges and there is no portal policy.

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `inventory_serial_units` | owner, manager, dispatch, office; tech for installed units and units at their own van or the shop | owner, manager, office | owner, manager, office | owner |

Technicians never write units directly. A technician saving a serial on an installed system reaches the table only through `fn_installed_system_serials_sync()`, a trigger function (SECURITY DEFINER, no EXECUTE for `authenticated` or `anon`) that is idempotent, skips placeholder serials, and flags every row in a duplicate group for review instead of merging. Sales has no access.

`inventory_transactions` gains a nullable `serial_unit_id` (same-org composite foreign key, `ON DELETE RESTRICT`; the append-only triggers are unchanged). `fn_inventory_txn_serial_guard()` rejects a ledger row whose unit is unmatched, belongs to a different item, or moves other than one unit; a row with no unit is always accepted. Ledger policies are unchanged.

`inventory_serial_review_queue` is a `security_invoker` view, so it shows exactly the rows the caller can already read.

### Serial units are authoritative both ways (20261128100000)

No policy changes. `inventory_serial_units` keeps the five policies from 20261128000000, and `installed_systems.serial_numbers` is now a mirror rebuilt from the units.

Three new trigger functions (`fn_installed_system_serials_derive`, `fn_inventory_serial_units_derive_trigger`, `fn_inventory_serial_unit_unflag`) are SECURITY DEFINER with a pinned `search_path` and no EXECUTE for `authenticated` or `anon`. The array-to-unit bridge from 20261128000000 stays as the safety net for writers that are not the app. When a serial leaves a system it deletes only backfill or sync units with no ledger history and detaches every other unit. A transaction-local flag (`loop.serial_sync`) stops the two directions from re-triggering each other.

API layer: `inventory_serial_units` select is owner, manager, dispatch, tech, office; insert and update are owner, manager, office; delete is owner. The review queue and `PATCH /api/inventory/serials/[id]` use the update gate, and the correct and remove actions also require `installed_systems` update because they edit a system's serial list.

### Serial picker on material lines (20261128200000)

`job_material_line_serials` records the unit a material line uses (the link is the record, never derived from the ledger). FORCE RLS; anon none; no UPDATE grant and no UPDATE policy.

| Operation | Roles |
|-----------|-------|
| SELECT | owner, manager, dispatch, office (whole org); tech only on jobs they are assigned to |
| INSERT / DELETE | owner, manager, office |

Techs read the units they are using and never write the link. A BEFORE INSERT guard (SECURITY DEFINER, pinned `search_path`) refuses a unit that is not the line's catalog item, not in stock, flagged for review, or beyond the line's quantity; a unit can be picked for one line at a time.

Three more SECURITY DEFINER functions with a pinned `search_path` and no EXECUTE for `authenticated` or `anon`: `fn_job_material_line_serial_guard`, `fn_inventory_txn_line_units_follow` (a `transfer_in` linked to a line moves that line's picked in-stock units to the new location, which covers a pull to the pallet and a pallet returned to the shop), and `fn_installed_system_serials_adopt` (a serial typed on an installed system that matches an in-stock unit of the same maker, or a unit with no maker, makes that unit installed on the system instead of creating a duplicate; it fires before the bridge and sets the `loop.serial_sync` flag around its update).

`inventory_serial_review_queue` (still `security_invoker`) gains reason `detached_unit`: status installed, on no system, not in a duplicate group.

---

## Deny Rules — Hard Blocks

The following are always blocked regardless of role or policy evaluation:

| Artifact / Pattern | Reason |
|--------------------|--------|
| Any `portal` role accessing `jobs`, `customers`, `properties`, `contractors`, `job_activity` | Portal isolation — external users must never see internal operational data |
| `anon` / unauthenticated requests | No ALLOW policy matches; RLS deny-by-default blocks all access |
| Cross-org row access | Every policy gates on `org_id = current_org_id()`; cross-org data is structurally impossible |
| `job_activity` UPDATE / DELETE | Log is append-only; no policy grants these operations |
| `dispatch` INSERT on ordinary jobs | Dispatchers schedule and update work. They may insert a job only when it is a Callback return visit |
| `tech` INSERT on jobs | Technicians execute work, not create it |
| `sales` INSERT/UPDATE on jobs | Sales own pre-sales data (customers, properties), not job execution |

---

## Multi-Tenant Org Isolation

Every table contains an `org_id` column. Every policy expression includes:

```sql
AND org_id = current_org_id()
```

`current_org_id()` is a `SECURITY DEFINER` function that resolves the calling user's org from `user_profiles`. This means:

- A user cannot see rows in a different org even if they guess a valid UUID.
- An application bug that omits org filtering in a query is caught by RLS at the database layer.

---

## Privilege Escalation — Tested Scenarios

The automated tests in `src/services/__tests__/authorization.test.ts` cover:

1. `portal` cannot access any internal operational table (all actions denied)
2. `tech` cannot access another tech's assigned jobs
3. `dispatch` cannot INSERT an ordinary job or DELETE jobs. Callback return visits are the exception, and only through `job_callbacks`
4. `sales` cannot access contractors
5. `office` cannot access contractors
6. No role except `owner` can DELETE customers, properties, contractors, or jobs
7. No role can UPDATE or DELETE `job_activity`
8. `anon` (no role) is denied everything

---

## API Authorization Layer (Sprint 25–26)

The authorization contract in `src/services/authorization.ts` is now enforced at the Next.js API boundary via `src/lib/api-auth.ts`. A full endpoint-to-policy inventory, including CI guard documentation, lives at [`docs/architecture/security/endpoint-authz-inventory.md`](./endpoint-authz-inventory.md).

### Endpoint → Table/Action Mapping

| Endpoint | Method | Auth primitive | Table | Action |
|----------|--------|---------------|-------|--------|
| `/api/customers` | GET | `requirePermission` | `customers` | `select` |
| `/api/customers` | POST | `requirePermission` | `customers` | `insert` |
| `/api/customers/[id]` | GET | `requirePermission` | `customers` | `select` |
| `/api/customers/[id]` | PATCH | `requirePermission` | `customers` | `update` |
| `/api/customers/[id]` | DELETE | `requirePermission` | `customers` | `delete` |
| `/api/properties` | GET | `requirePermission` | `properties` | `select` |
| `/api/properties` | POST | `requirePermission` | `properties` | `insert` |
| `/api/properties/[id]` | GET | `requirePermission` | `properties` | `select` |
| `/api/properties/[id]` | PATCH | `requirePermission` | `properties` | `update` |
| `/api/properties/[id]` | DELETE | `requirePermission` | `properties` | `delete` |
| `/api/jobs` | GET | `requirePermission` | `jobs` | `select` |
| `/api/jobs` | POST | `requirePermission` | `jobs` | `insert` |
| `/api/jobs/[id]` | GET | `requirePermission` | `jobs` | `select` |
| `/api/jobs/[id]` | PATCH | `requirePermission` | `jobs` | `update` |
| `/api/jobs/[id]` | DELETE | `requirePermission` | `jobs` | `delete` |
| `/api/dispatch` | GET | `requirePermission` | `jobs` | `select` |
| `/api/documents` | GET | `requirePermission` | `portal_memberships` | `select` |
| `/api/documents` | POST | `requirePermission` | `portal_memberships` | `insert` |
| `/api/copilot/search` | POST | `requireApiSession` | n/a (search) | n/a |
| `/api/auth/sign-out` | POST | `requireApiSession` | n/a (session teardown) | n/a |

### Error Response Format

All authorization failures return a consistent JSON envelope:

```json
// 401 — unauthenticated
{ "error": "UNAUTHORIZED", "message": "...", "code": 401 }

// 403 — authenticated but insufficient role
{ "error": "FORBIDDEN", "message": "Role 'X' is not permitted to perform 'Y' on 'Z'.", "code": 403 }
```

### Role Resolution (current)

The `resolveRequestRole` function in `src/lib/api-auth.ts` reads the `X-Loop-Role` request header during development and testing. When Supabase auth is wired, this function will be extended to verify the JWT ****** and extract the `app_role` claim. No other code changes are required.

### Audit Events

Every sensitive mutation (POST/PATCH/DELETE) emits a structured log event via `src/lib/audit.ts`:

```
[AUDIT] {"role":"owner","action":"create","resource":"jobs","resourceId":"","details":{},"timestamp":"..."}
```

When Supabase persistence is wired, `emitAuditEvent` will be extended to write to `job_activity` or a dedicated `audit_log` table.

### Frontend Permission Gates

The `PermissionGate` component (`src/features/auth/PermissionGate.tsx`) is used in key screens to hide restricted actions. Role is resolved client-side from `localStorage` (`loop_dev_role` key, default `owner`) via `RoleProvider`. No action is rendered until the role is confirmed — preventing any flash of unauthorized content.

Gated UI elements:

| Screen | Element | Table | Action |
|--------|---------|-------|--------|
| `/jobs` | New Job button | `jobs` | `insert` |
| `/jobs/[id]` | Edit Job link | `jobs` | `update` |
| `/jobs/[id]` | Job status actions panel | `jobs` | `update` |
| `/customers` | New Customer button | `customers` | `insert` |
| `/properties` | New Property button | `properties` | `insert` |

---

## Deferred Scope (Post Sprint 24)

| Item | Notes |
|------|-------|
| Column-level security for dispatch/tech UPDATE on jobs | Requires PostgreSQL 15+ or application-layer enforcement until migrated |
| `inventory` table policies | Added when inventory transitions off mock storage |
| `dispatch_plans` table policies | Added when dispatch transitions off mock storage |
| Per-column audit triggers | To track which field changed in a job UPDATE |
| Rate limiting by role | Future Supabase Edge Function concern |
| Supabase JWT claim extraction in `resolveRequestRole` | Replace header-based role resolution with real session auth |
