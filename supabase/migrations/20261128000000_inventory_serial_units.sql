-- =============================================================================
-- Migration — Serialized units, one serial truth (Inventory Lane 3, PR 1)
-- Plan: docs/briefs/inventory-lane3-plan-2026-11-11.md (approved by Collin 2026-11-11)
-- Amendments: docs/briefs/claude-brief-inventory-amendments-2026-11-05.md (2, 11, 12, 13)
--
-- UP:
--   - inventory_serial_units        one row per physical serialized unit
--                                   (equipment, refrigerant cylinders). Authoritative
--                                   for serials; installed_systems links to it.
--   - fn_serial_is_placeholder      "unknown", "na", too-short serials are never
--                                   turned into units
--   - inventory_transactions.serial_unit_id
--                                   ALTER ADD COLUMN only. The append-only triggers
--                                   are untouched. A separate guard trigger checks
--                                   the unit matches the item and moves one at a time.
--   - fn_installed_system_serials_sync
--                                   TRANSITION BRIDGE (array -> units). While the app
--                                   still writes installed_systems.serial_numbers, each
--                                   save keeps the units complete. PR 2 flips the app to
--                                   write units and derives the array from them.
--   - Backfill                      one 'installed' unit per usable serial on every
--                                   existing installed system. Placeholders and blanks
--                                   are never guessed. Serials shared by several systems
--                                   get needs_review = true on every row in the group.
--   - inventory_serial_review_queue view of everything the office must review
--
-- Rules:
--   * Uniqueness is (org, manufacturer, serial), enforced only for rows that do not
--     need review. A flagged duplicate stays visible instead of being merged or dropped.
--   * Warranty stays per installed system (existing decision). No warranty columns here.
--   * No hard blocks: a serialized item moved without a serial unit still posts
--     (staged enforcement, amendment 8). Only an inconsistent serial unit is rejected.
--   * Techs never write units directly. They read installed units and units at their
--     own van or the shop. Writes come from the bridge or office+ roles.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP TRIGGER IF EXISTS trg_installed_systems_serial_sync ON public.installed_systems;
--   DROP TRIGGER IF EXISTS trg_inventory_txn_serial_guard ON public.inventory_transactions;
--   ALTER TABLE public.inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_serial_unit_same_org_fkey;
--   DROP INDEX IF EXISTS public.inventory_transactions_serial_unit_idx;
--   ALTER TABLE public.inventory_transactions DROP COLUMN IF EXISTS serial_unit_id;
--   DROP VIEW IF EXISTS public.inventory_serial_review_queue;
--   DROP TABLE IF EXISTS public.inventory_serial_units;
--   DROP FUNCTION IF EXISTS public.fn_installed_system_serials_sync();
--   DROP FUNCTION IF EXISTS public.fn_inventory_serial_unit_guard();
--   DROP FUNCTION IF EXISTS public.fn_inventory_txn_serial_guard();
--   DROP FUNCTION IF EXISTS public.fn_serial_is_placeholder(text);
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Placeholder serials. A tech typing "unknown" is not a serial.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_serial_is_placeholder(serial text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT serial IS NULL
      OR length(btrim(serial)) < 3
      OR lower(btrim(serial)) IN (
        'unknown', 'unk', 'na', 'n/a', 'n.a.', 'none', 'null', 'tbd',
        'not available', 'not visible', 'not readable', 'unreadable',
        'illegible', 'no serial', 'no tag', 'missing'
      );
$$;

-- ---------------------------------------------------------------------------
-- inventory_serial_units
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_serial_units (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  item_id              uuid,
  manufacturer         text NOT NULL DEFAULT '',
  model_number         text NOT NULL DEFAULT '',
  serial_number        text NOT NULL CHECK (length(btrim(serial_number)) > 0),
  serial_key           text GENERATED ALWAYS AS (lower(btrim(serial_number))) STORED,
  manufacturer_key     text GENERATED ALWAYS AS (lower(btrim(manufacturer))) STORED,
  status               text NOT NULL DEFAULT 'in_stock'
                         CHECK (status IN ('in_stock', 'installed', 'quarantine', 'returned_to_supplier', 'scrapped')),
  location_id          uuid,
  installed_system_id  uuid REFERENCES public.installed_systems(id) ON DELETE SET NULL,
  source               text NOT NULL
                         CHECK (source IN ('receipt', 'scan', 'manual', 'backfill', 'sync')),
  needs_review         boolean NOT NULL DEFAULT false,
  review_reason        text CHECK (review_reason IS NULL OR review_reason IN ('duplicate_serial')),
  created_by           uuid REFERENCES public.user_profiles(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_serial_units_id_org_key UNIQUE (id, org_id),
  CONSTRAINT inventory_serial_units_item_same_org_fkey
    FOREIGN KEY (item_id, org_id) REFERENCES public.catalog_items (id, org_id) ON DELETE RESTRICT,
  CONSTRAINT inventory_serial_units_location_same_org_fkey
    FOREIGN KEY (location_id, org_id) REFERENCES public.inventory_locations (id, org_id) ON DELETE RESTRICT,
  -- A unit linked to a system is installed. (A deleted system detaches the link.)
  CONSTRAINT inventory_serial_units_system_means_installed
    CHECK (installed_system_id IS NULL OR status = 'installed'),
  -- In stock means a known catalog item at a known place.
  CONSTRAINT inventory_serial_units_stock_has_item_and_place
    CHECK (status <> 'in_stock' OR (item_id IS NOT NULL AND location_id IS NOT NULL)),
  CONSTRAINT inventory_serial_units_quarantine_has_place
    CHECK (status <> 'quarantine' OR location_id IS NOT NULL),
  -- Installed units have left inventory.
  CONSTRAINT inventory_serial_units_installed_has_no_location
    CHECK (status <> 'installed' OR location_id IS NULL),
  CONSTRAINT inventory_serial_units_review_reason_matches
    CHECK (needs_review = (review_reason IS NOT NULL))
);

-- One physical unit per org + manufacturer + serial, among rows not flagged for review.
CREATE UNIQUE INDEX IF NOT EXISTS inventory_serial_units_identity_uidx
  ON public.inventory_serial_units (org_id, manufacturer_key, serial_key)
  WHERE NOT needs_review;

CREATE INDEX IF NOT EXISTS inventory_serial_units_system_idx
  ON public.inventory_serial_units (installed_system_id) WHERE installed_system_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS inventory_serial_units_org_status_idx
  ON public.inventory_serial_units (org_id, status);

CREATE INDEX IF NOT EXISTS inventory_serial_units_item_idx
  ON public.inventory_serial_units (item_id) WHERE item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS inventory_serial_units_location_idx
  ON public.inventory_serial_units (location_id) WHERE location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS inventory_serial_units_review_idx
  ON public.inventory_serial_units (org_id) WHERE needs_review;

CREATE INDEX IF NOT EXISTS inventory_serial_units_org_serial_idx
  ON public.inventory_serial_units (org_id, serial_key);

-- ---------------------------------------------------------------------------
-- Guard: the installed system and item must belong to this org, and a catalog
-- item attached to a unit must be tracked by serial.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_inventory_serial_unit_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.installed_system_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.installed_systems
    WHERE id = NEW.installed_system_id AND org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'installed system % does not belong to this organization', NEW.installed_system_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.catalog_items
    WHERE id = NEW.item_id AND org_id = NEW.org_id AND tracking_mode = 'serialized'
  ) THEN
    RAISE EXCEPTION 'catalog item % is not tracked by serial', NEW.item_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_serial_unit_guard ON public.inventory_serial_units;
CREATE TRIGGER trg_inventory_serial_unit_guard
  BEFORE INSERT OR UPDATE ON public.inventory_serial_units
  FOR EACH ROW EXECUTE FUNCTION public.fn_inventory_serial_unit_guard();

DROP TRIGGER IF EXISTS trg_inventory_serial_units_updated_at ON public.inventory_serial_units;
CREATE TRIGGER trg_inventory_serial_units_updated_at
  BEFORE UPDATE ON public.inventory_serial_units
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- Ledger link. ALTER ADD COLUMN only; the append-only triggers do not fire.
-- Existing rows keep serial_unit_id NULL.
-- ---------------------------------------------------------------------------

ALTER TABLE public.inventory_transactions
  ADD COLUMN IF NOT EXISTS serial_unit_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_transactions_serial_unit_same_org_fkey'
      AND conrelid = 'public.inventory_transactions'::regclass
  ) THEN
    ALTER TABLE public.inventory_transactions
      ADD CONSTRAINT inventory_transactions_serial_unit_same_org_fkey
      FOREIGN KEY (serial_unit_id, org_id)
      REFERENCES public.inventory_serial_units (id, org_id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS inventory_transactions_serial_unit_idx
  ON public.inventory_transactions (serial_unit_id) WHERE serial_unit_id IS NOT NULL;

-- A ledger row that names a serial unit must match the unit's item and move
-- exactly one unit. A row with no serial unit is always accepted.
CREATE OR REPLACE FUNCTION public.fn_inventory_txn_serial_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  unit_item uuid;
BEGIN
  IF NEW.serial_unit_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT item_id INTO unit_item
  FROM public.inventory_serial_units
  WHERE id = NEW.serial_unit_id AND org_id = NEW.org_id;

  IF unit_item IS NULL THEN
    RAISE EXCEPTION 'serial unit % is not matched to a catalog item', NEW.serial_unit_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF unit_item <> NEW.item_id THEN
    RAISE EXCEPTION 'serial unit % belongs to a different catalog item', NEW.serial_unit_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF abs(NEW.qty_delta) <> 1 THEN
    RAISE EXCEPTION 'a serial unit moves one at a time (got %)', NEW.qty_delta
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_txn_serial_guard ON public.inventory_transactions;
CREATE TRIGGER trg_inventory_txn_serial_guard
  BEFORE INSERT ON public.inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_inventory_txn_serial_guard();

-- ---------------------------------------------------------------------------
-- Transition bridge: installed_systems.serial_numbers -> units.
-- Idempotent. Never guesses: placeholders are skipped; a serial already held by
-- a different system flags BOTH rows for review instead of merging them.
-- Removing a serial deletes only units this bridge or the backfill created.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_installed_system_serials_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s text;
  s_key text;
  mfr_key text := lower(btrim(NEW.manufacturer));
  clash boolean;
  kept text[] := '{}';
BEGIN
  FOREACH s IN ARRAY COALESCE(NEW.serial_numbers, '{}'::text[]) LOOP
    s := btrim(s);
    IF public.fn_serial_is_placeholder(s) THEN
      CONTINUE;
    END IF;
    s_key := lower(s);
    IF s_key = ANY (kept) THEN
      CONTINUE;
    END IF;
    kept := kept || s_key;

    IF EXISTS (
      SELECT 1 FROM public.inventory_serial_units
      WHERE installed_system_id = NEW.id AND serial_key = s_key
    ) THEN
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.inventory_serial_units
      WHERE org_id = NEW.org_id AND manufacturer_key = mfr_key AND serial_key = s_key
    ) INTO clash;

    IF clash THEN
      UPDATE public.inventory_serial_units
         SET needs_review = true, review_reason = 'duplicate_serial'
       WHERE org_id = NEW.org_id AND manufacturer_key = mfr_key AND serial_key = s_key
         AND NOT needs_review;
    END IF;

    INSERT INTO public.inventory_serial_units
      (org_id, manufacturer, model_number, serial_number, status, installed_system_id,
       source, needs_review, review_reason)
    VALUES
      (NEW.org_id, NEW.manufacturer, NEW.model_number, s, 'installed', NEW.id,
       'sync', clash, CASE WHEN clash THEN 'duplicate_serial' END);
  END LOOP;

  DELETE FROM public.inventory_serial_units u
   WHERE u.installed_system_id = NEW.id
     AND u.source IN ('backfill', 'sync')
     AND NOT (u.serial_key = ANY (kept))
     AND NOT EXISTS (
       SELECT 1 FROM public.inventory_transactions t WHERE t.serial_unit_id = u.id
     );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_installed_systems_serial_sync ON public.installed_systems;
CREATE TRIGGER trg_installed_systems_serial_sync
  AFTER INSERT OR UPDATE OF serial_numbers ON public.installed_systems
  FOR EACH ROW EXECUTE FUNCTION public.fn_installed_system_serials_sync();

REVOKE ALL ON FUNCTION public.fn_inventory_serial_unit_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_inventory_txn_serial_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_installed_system_serials_sync() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Backfill. Idempotent: a system + serial that already has a unit is skipped.
-- ---------------------------------------------------------------------------

WITH src AS (
  SELECT DISTINCT ON (s.id, lower(btrim(x.serial)))
         s.id AS system_id,
         s.org_id,
         s.manufacturer,
         s.model_number,
         btrim(x.serial) AS serial,
         s.created_at
  FROM public.installed_systems s
  CROSS JOIN LATERAL unnest(s.serial_numbers) AS x(serial)
  WHERE NOT public.fn_serial_is_placeholder(x.serial)
  ORDER BY s.id, lower(btrim(x.serial))
),
grp AS (
  SELECT src.*,
         count(*) OVER (
           PARTITION BY src.org_id, lower(btrim(src.manufacturer)), lower(src.serial)
         ) AS n
  FROM src
)
INSERT INTO public.inventory_serial_units
  (org_id, manufacturer, model_number, serial_number, status, installed_system_id,
   source, needs_review, review_reason, created_at)
SELECT g.org_id, g.manufacturer, g.model_number, g.serial, 'installed', g.system_id,
       'backfill', g.n > 1, CASE WHEN g.n > 1 THEN 'duplicate_serial' END, g.created_at
FROM grp g
WHERE NOT EXISTS (
  SELECT 1 FROM public.inventory_serial_units u
  WHERE u.installed_system_id = g.system_id AND u.serial_key = lower(g.serial)
);

-- ---------------------------------------------------------------------------
-- Review queue: what the office must look at. security_invoker keeps RLS in force.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.inventory_serial_review_queue
WITH (security_invoker = true) AS
  SELECT u.org_id,
         'duplicate_serial'::text AS reason,
         u.id AS serial_unit_id,
         u.installed_system_id,
         u.manufacturer,
         u.model_number,
         u.serial_number
  FROM public.inventory_serial_units u
  WHERE u.needs_review
  UNION ALL
  SELECT s.org_id,
         'missing_serial'::text AS reason,
         NULL::uuid AS serial_unit_id,
         s.id AS installed_system_id,
         s.manufacturer,
         s.model_number,
         NULL::text AS serial_number
  FROM public.installed_systems s
  WHERE NOT EXISTS (
    SELECT 1 FROM unnest(s.serial_numbers) AS x(serial)
    WHERE NOT public.fn_serial_is_placeholder(x.serial)
  );

REVOKE ALL ON public.inventory_serial_review_queue FROM anon;

-- ---------------------------------------------------------------------------
-- Privileges and RLS — ENABLE + FORCE; portal and anon have no access.
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.inventory_serial_units FROM anon;
REVOKE TRUNCATE ON public.inventory_serial_units FROM authenticated;

ALTER TABLE public.inventory_serial_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_serial_units FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_serial_units: read for ops" ON public.inventory_serial_units;
CREATE POLICY "inventory_serial_units: read for ops"
  ON public.inventory_serial_units FOR SELECT TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

-- Techs read installed units (installed_systems is already org-readable to them)
-- and units at their own van or the shop. Sales and portal stay denied.
DROP POLICY IF EXISTS "inventory_serial_units: read for tech" ON public.inventory_serial_units;
CREATE POLICY "inventory_serial_units: read for tech"
  ON public.inventory_serial_units FOR SELECT TO authenticated
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND (
      installed_system_id IS NOT NULL
      OR location_id IN (
        SELECT id
        FROM public.inventory_locations
        WHERE org_id = current_org_id()
          AND is_active
          AND (
            (type = 'van' AND vehicle_id IN (SELECT public.fn_inventory_visible_vehicle_ids()))
            OR type = 'warehouse'
          )
      )
    )
  );

DROP POLICY IF EXISTS "inventory_serial_units: insert for office+" ON public.inventory_serial_units;
CREATE POLICY "inventory_serial_units: insert for office+"
  ON public.inventory_serial_units FOR INSERT TO authenticated
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "inventory_serial_units: update for office+" ON public.inventory_serial_units;
CREATE POLICY "inventory_serial_units: update for office+"
  ON public.inventory_serial_units FOR UPDATE TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "inventory_serial_units: delete for owner" ON public.inventory_serial_units;
CREATE POLICY "inventory_serial_units: delete for owner"
  ON public.inventory_serial_units FOR DELETE TO authenticated
  USING (current_app_role() = 'owner' AND org_id = current_org_id());
