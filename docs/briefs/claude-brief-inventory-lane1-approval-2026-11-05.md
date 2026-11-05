# Brief — Inventory Lane 1: APPROVED to plan (Collin, 2026-11-05)

Collin approves Lane 1 of the inventory design. This approval covers the **plan only** — produce the Lane 1 plan, do not write code yet. Collin approves the plan itself before any build starts.

## Source package (all in docs/briefs/, read all three first)

- Design: `field-service-inventory-design-2026-11-05.md`
- Zoinks review: `loop-inventory-design-review-2026-11-05.md`
- Mandatory amendments: `loop-inventory-design-amendments-2026-11-05.md` — these are REQUIRED, not suggestions. Where the design and the amendments disagree, the amendments win.

## Lane 1 scope (Foundation)

- Tables: vehicles, locations, the ONE item master, item_costs (separate table — techs/portal never read cost), stock_levels, and the append-only `inventory_transactions` ledger with trigger-maintained stock cache. Cancellations/returns are opposite entries, never edits.
- The item master merges the #36 service catalog and the inventory catalog into a single table with two facets — sellable (price, rate tiers) and stockable (SKU, cost, on-hand) — linked 1:1 where both apply. No separate service_items table.
- Vehicles: migrate `crews.truck_name` and `vehicle_alerts.vehicle_name` onto the vehicles FK and retire both free-text fields as part of this lane's plan.
- Screens: replace the current /inventory stub (it reads a table that exists in no migration — do not patch it). Catalog + stock screens, server-first per repo standards.
- Seed: SMALL — serialized equipment types + the ~50 consumables Legacy One actually pulls. Do NOT import Service Fusion's 416-item catalog.

## Confirmed defaults (from the review's open questions)

- One warehouse: the shop, 4403 Russell Rd, Mukilteo. Vans are locations under it, assigned per crew (3 crews).
- Locations model: warehouse, van, job (virtual buy-for-job), quarantine/RMA.
- Enforcement posture for the whole inventory build is staged (warn → soft block with office override → hard block). Nothing in Lane 1 hard-blocks anyone.
- Costing method is deferred to Lane 5; Lane 1 stores cost, it does not decide costing policy.

## Migration numbering — read carefully

The design package says new work starts at 20261121000000. That is STALE: the migration ledger now runs through **20261122000000** (job_follow_ups, applied 2026-11-05). Lane 1's migration must be numbered after 20261122000000. Follow the full repo migration standard: paired verify file, RLS with FORCE, CoreTable entry, and the rls-role-matrix + authz inventory updated in the same commit.

## Out of scope for Lane 1 (do not build, do not block on)

- Kits, material plans, readiness (Lane 4); vans/par & restock flows (Lane 2); serialized units (Lane 3); purchasing/POs (Lane 5).
- Design Lane 1 so it does not paint the later lanes into a corner: serial_units will be the single serial truth in Lane 3 (installed_systems links to it), and material plans will generate from estimate/job line items in Lane 4.

## Deliverable

The Lane 1 plan, committed to docs/briefs/: table definitions, the migration spec, the RLS/role matrix, the screen list, and the seed list. Post on #337 when it's up. No code, no migration files, until Collin approves the plan.
