# Inventory Lane 3 — Serialized units, nameplate scan, RMA, cylinders

Status: approved by Collin 2026-11-11. Sequencing: Lane 3 runs first, alone. Billing stays on hold. The route view waits on the geocoding decision.

Amendments implemented here: 2 (one serial truth), 11 (nameplate scan primary, typing is the fallback), 12 (refrigerant cylinders by serial), 13 (RMA / warranty returns ship with serialized units). Lane 4 §3.6 and §3.4 say where Lane 3 plugs in.

## Decisions (Collin, 2026-11-11)

1. PR #469 (nameplate read from job photos) lands first. PR 4 is built on main after it merges, not stacked on its branch.
2. Backfill creates an `installed` serial unit for every imported system. Blank, placeholder and duplicate serials are flagged for office review and never guessed.
3. The decoder covers Mitsubishi and Bosch only for now.
4. Lane 3 runs first and alone.

## Architecture

- `inventory_serial_units` is the single serial truth. `installed_systems.serial_numbers` links to it and is never an independent copy.
- Warranty stays per installed system (existing decision). Units carry no warranty columns, so there is no second source for it.
- The ledger gets a nullable `serial_unit_id` (ALTER ADD COLUMN only; the append-only triggers are untouched). A separate guard trigger checks that the unit matches the item and moves one at a time. A serialized item posted without a unit is still accepted (staged enforcement, amendment 8).
- Uniqueness is (org, manufacturer, serial) among rows that do not need review. A flagged duplicate stays visible; nothing is merged or dropped.
- Decoder (PR 4) is a pure rules module of Mitsubishi and Bosch nomenclature and serial date-code rules. Each rule cites the manufacturer document number and page, and the UI links out to the manufacturer PDF. It is written from the manufacturer documents, not from a third-party site.

## PR sequence (each a draft; Zoinks gates tsc, vitest, lint, build and applies migrations)

| PR | Scope |
|----|-------|
| 1 | M10 `20261128000000_inventory_serial_units.sql`: table, ledger column and guard, transition bridge, backfill, review queue view, RLS. Verify SQL, checksum, rls-role-matrix section. |
| 2 | M11 `20261128100000_inventory_serial_units_authority.sql` (units rebuild `installed_systems.serial_numbers`; duplicate groups unflag themselves when they shrink to one row), serial-unit types, pure rules, repository, service, API routes (list, review queue, resolve), permission resource. The array-to-units bridge **stays** as the safety net for non-app writers (Service Fusion import, raw SQL) instead of being retired. Tests. |
| 3 | UI, no migration: office review queue screen (`/inventory/serials`), receive with serial (one unit and one ledger entry per serial), installed-system detail and edit read units, ledger TypeScript carries `serialUnitId`. **Not built: the material-line serial picker.** It needs somewhere to store the chosen unit (`job_material_line_serials` was never created) and PR 3 was scoped to no migration; the choice is open with Collin. |
| 4 | After #469 merges: scan integration writing to units, plus the Mitsubishi/Bosch decoder. |
| 5 | RMA / quarantine / return-to-supplier flow and cylinder tracking (`refrigerant_log_entries.serial_unit_id` foreign key). |

## PR 1 data expectations (read-only dry run against production, 2026-11-11)

- 2,778 installed systems. About 2,734 serial units are created by the backfill.
- About 262 of those rows sit in 130 duplicate groups and are flagged `duplicate_serial`.
- 44 systems have no usable serial (blank or a placeholder such as "unknown" or "na") and appear in the review queue as `missing_serial`. No unit is created for them.

## Open items carried forward

- The bridge runs both ways (PR 2). The array-to-units direction is kept on purpose so no writer can create a second serial source. A unit deleted by hand is not recreated until the system's serials are next saved.
- A unit detached from a system (its serial removed from the system) keeps status `installed` with no system or location. It is visible in the unit list but has no review reason yet; PR 3 gives detached units a place in the review queue.
- A new non-flagged unit can be inserted with the same key as rows already flagged for review. The resolve-review command in PR 2 settles a group by choosing which row is the real unit.
- Placeholder list lives in `fn_serial_is_placeholder`. Extending it is a new migration.
- Detached units (status installed, no system or location) still have no review reason: adding one changes the `inventory_serial_review_queue` view, which is a migration, so it is not in PR 3.
- Receiving a serialized item creates the units first and then the ledger entries (two statements). If the ledger post fails the units are discarded where the role may delete (owner only); otherwise they stay in stock with no ledger entry. A migration-backed function would make this atomic.
