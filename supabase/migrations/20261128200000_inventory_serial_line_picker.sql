-- =============================================================================
-- Migration — Serial picker on material lines (Inventory Lane 3, M12)
-- Plan: docs/briefs/inventory-lane3-plan-2026-11-11.md (PR 3b)
--
-- UP:
--   - job_material_line_serials         the unit a material line uses. The link IS the
--                                        record; it is never derived from the ledger.
--   - fn_job_material_line_serial_guard  a unit can be linked only if it is in stock, not
--                                        flagged, the line's own catalog item, and the line
--                                        has room (one unit per quantity)
--   - fn_inventory_txn_line_units_follow a pull (transfer_in linked to a line) moves that
--                                        line's linked units to the new location, so a pull
--                                        to the pallet and a return to the shop carry the units
--   - fn_installed_system_serials_adopt  a serial typed on an installed system that matches a
--                                        unit sitting in stock (same maker, or no maker) is that
--                                        unit: it becomes installed on the system instead of
--                                        creating a second, duplicate-flagged unit
--   - inventory_serial_review_queue      REPLACED: adds reason 'detached_unit' (installed, on no
--                                        system, not part of a duplicate group)
--
-- Role posture (same as the other inventory tables): ops roles read; owner / manager / office
-- write; techs read the links on jobs they are assigned to and never write them. No UPDATE.
-- Warranty stays on the installed system; nothing here adds warranty fields.
-- All functions pin search_path. Nothing here changes existing rows.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP TRIGGER IF EXISTS trg_installed_systems_serial_adopt ON public.installed_systems;
--   DROP FUNCTION IF EXISTS public.fn_installed_system_serials_adopt();
--   DROP TRIGGER IF EXISTS trg_inventory_txn_line_units_follow ON public.inventory_transactions;
--   DROP FUNCTION IF EXISTS public.fn_inventory_txn_line_units_follow();
--   DROP TABLE IF EXISTS public.job_material_line_serials;
--   DROP FUNCTION IF EXISTS public.fn_job_material_line_serial_guard();
--   -- and restore inventory_serial_review_queue from 20261128000000_inventory_serial_units.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.job_material_line_serials (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  line_id        uuid NOT NULL,
  serial_unit_id uuid NOT NULL,
  created_by     uuid REFERENCES public.user_profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- A unit is picked for one line at a time. Release it to use it elsewhere.
  CONSTRAINT job_material_line_serials_unit_key UNIQUE (serial_unit_id),
  CONSTRAINT job_material_line_serials_line_same_org_fkey
    FOREIGN KEY (line_id, org_id) REFERENCES public.job_material_lines (id, org_id) ON DELETE CASCADE,
  CONSTRAINT job_material_line_serials_unit_same_org_fkey
    FOREIGN KEY (serial_unit_id, org_id) REFERENCES public.inventory_serial_units (id, org_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS job_material_line_serials_line_idx
  ON public.job_material_line_serials (line_id);
CREATE INDEX IF NOT EXISTS job_material_line_serials_org_idx
  ON public.job_material_line_serials (org_id);
CREATE INDEX IF NOT EXISTS job_material_line_serials_created_by_idx
  ON public.job_material_line_serials (created_by);

-- ---------------------------------------------------------------------------
-- Guard. SECURITY DEFINER so the checks do not depend on what the writer can see.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_job_material_line_serial_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l record;
  u record;
  taken integer;
BEGIN
  -- Serialize picks for one line so two people cannot overfill it.
  SELECT id, catalog_item_id, quantity INTO l
  FROM public.job_material_lines
  WHERE id = NEW.line_id AND org_id = NEW.org_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'material line % not found', NEW.line_id USING ERRCODE = 'check_violation';
  END IF;

  SELECT item_id, status, needs_review INTO u
  FROM public.inventory_serial_units
  WHERE id = NEW.serial_unit_id AND org_id = NEW.org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'serial unit % not found', NEW.serial_unit_id USING ERRCODE = 'check_violation';
  END IF;

  IF l.catalog_item_id IS NULL OR u.item_id IS DISTINCT FROM l.catalog_item_id THEN
    RAISE EXCEPTION 'that unit is not the item on this material line' USING ERRCODE = 'check_violation';
  END IF;
  IF u.status <> 'in_stock' THEN
    RAISE EXCEPTION 'only a unit in stock can be picked for a material line' USING ERRCODE = 'check_violation';
  END IF;
  IF u.needs_review THEN
    RAISE EXCEPTION 'that unit is flagged for review; resolve it before picking it' USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO taken FROM public.job_material_line_serials WHERE line_id = NEW.line_id;
  IF taken >= l.quantity THEN
    RAISE EXCEPTION 'this line already has all of its units picked' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_material_line_serial_guard ON public.job_material_line_serials;
CREATE TRIGGER trg_job_material_line_serial_guard
  BEFORE INSERT ON public.job_material_line_serials
  FOR EACH ROW EXECUTE FUNCTION public.fn_job_material_line_serial_guard();

-- ---------------------------------------------------------------------------
-- Follow-through: stock that lands somewhere for a material line (a pull to the
-- pallet, a pallet returned to the shop) takes that line's picked units with it.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_inventory_txn_line_units_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.inventory_serial_units u
     SET location_id = NEW.location_id
    FROM public.job_material_line_serials s
   WHERE s.line_id = NEW.material_line_id
     AND s.serial_unit_id = u.id
     AND u.org_id = NEW.org_id
     AND u.status = 'in_stock'
     AND u.location_id IS DISTINCT FROM NEW.location_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_txn_line_units_follow ON public.inventory_transactions;
CREATE TRIGGER trg_inventory_txn_line_units_follow
  AFTER INSERT ON public.inventory_transactions
  FOR EACH ROW
  WHEN (NEW.material_line_id IS NOT NULL AND NEW.txn_type = 'transfer_in')
  EXECUTE FUNCTION public.fn_inventory_txn_line_units_follow();

-- ---------------------------------------------------------------------------
-- Adoption: a serial typed on an installed system that matches a unit in stock is
-- that unit. Runs before the bridge (triggers fire by name; "adopt" sorts before
-- "sync"). The transaction flag keeps the unit-to-array trigger from rewriting the
-- array while other serials in it are still waiting for their units.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_installed_system_serials_adopt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('loop.serial_sync', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('loop.serial_sync', 'on', true);

  UPDATE public.inventory_serial_units u
     SET status = 'installed',
         installed_system_id = NEW.id,
         location_id = NULL
   WHERE u.org_id = NEW.org_id
     AND u.status = 'in_stock'
     AND u.installed_system_id IS NULL
     AND NOT u.needs_review
     AND (u.manufacturer_key = lower(btrim(NEW.manufacturer)) OR u.manufacturer_key = '')
     AND u.serial_key IN (
       SELECT lower(btrim(x.serial))
       FROM unnest(COALESCE(NEW.serial_numbers, '{}'::text[])) AS x(serial)
       WHERE NOT public.fn_serial_is_placeholder(x.serial)
     );

  PERFORM set_config('loop.serial_sync', 'off', true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_installed_systems_serial_adopt ON public.installed_systems;
CREATE TRIGGER trg_installed_systems_serial_adopt
  AFTER INSERT OR UPDATE OF serial_numbers ON public.installed_systems
  FOR EACH ROW EXECUTE FUNCTION public.fn_installed_system_serials_adopt();

REVOKE ALL ON FUNCTION public.fn_job_material_line_serial_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_inventory_txn_line_units_follow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_installed_system_serials_adopt() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and RLS — ENABLE + FORCE; portal and anon have no access. No UPDATE.
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.job_material_line_serials FROM anon;
REVOKE UPDATE, TRUNCATE ON public.job_material_line_serials FROM authenticated;

ALTER TABLE public.job_material_line_serials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_material_line_serials FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_material_line_serials: read for ops" ON public.job_material_line_serials;
CREATE POLICY "job_material_line_serials: read for ops"
  ON public.job_material_line_serials FOR SELECT TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = (select current_org_id())
  );

DROP POLICY IF EXISTS "job_material_line_serials: tech reads assigned jobs" ON public.job_material_line_serials;
CREATE POLICY "job_material_line_serials: tech reads assigned jobs"
  ON public.job_material_line_serials FOR SELECT TO authenticated
  USING (
    (select current_app_role()) = 'tech'
    AND org_id = (select current_org_id())
    AND EXISTS (
      SELECT 1 FROM public.job_material_lines AS l
      WHERE l.id = job_material_line_serials.line_id
        AND l.org_id = job_material_line_serials.org_id
        AND private.caller_is_assigned_to_job(l.job_id)
    )
  );

DROP POLICY IF EXISTS "job_material_line_serials: insert for office+" ON public.job_material_line_serials;
CREATE POLICY "job_material_line_serials: insert for office+"
  ON public.job_material_line_serials FOR INSERT TO authenticated
  WITH CHECK (
    (select current_app_role()) IN ('owner', 'manager', 'office')
    AND org_id = (select current_org_id())
  );

DROP POLICY IF EXISTS "job_material_line_serials: delete for office+" ON public.job_material_line_serials;
CREATE POLICY "job_material_line_serials: delete for office+"
  ON public.job_material_line_serials FOR DELETE TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'office')
    AND org_id = (select current_org_id())
  );

-- ---------------------------------------------------------------------------
-- Review queue: now also the units that were detached from a system and are in no
-- duplicate group, which were invisible before. security_invoker keeps RLS in force.
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
  )
  UNION ALL
  SELECT u.org_id,
         'detached_unit'::text AS reason,
         u.id AS serial_unit_id,
         NULL::uuid AS installed_system_id,
         u.manufacturer,
         u.model_number,
         u.serial_number
  FROM public.inventory_serial_units u
  WHERE u.status = 'installed'
    AND u.installed_system_id IS NULL
    AND NOT u.needs_review;

REVOKE ALL ON public.inventory_serial_review_queue FROM anon;
