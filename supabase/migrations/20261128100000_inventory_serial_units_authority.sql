-- =============================================================================
-- Migration — Serial units become authoritative both ways (Inventory Lane 3, PR 2, M11)
-- Plan: docs/briefs/inventory-lane3-plan-2026-11-11.md
-- Builds on 20261128000000_inventory_serial_units.sql (applied to production 2026-11-11).
--
-- PR 1 mirrored installed_systems.serial_numbers INTO units. This migration
-- closes the loop so units are the single serial truth in practice:
--
--   array write  -> units    fn_installed_system_serials_sync (replaced here)
--   unit change  -> array    fn_installed_system_serials_derive (new)
--
-- The array->units direction stays on purpose. It is the safety net for every
-- writer that is not the app (the Service Fusion import, raw SQL, any future
-- script), so none of them can create a second, silent source of serials.
--
-- UP:
--   - fn_installed_system_serials_sync   REPLACED: removing a serial from a system
--                                        deletes only backfill/sync units with no ledger
--                                        history; any other unit is detached, never deleted
--   - fn_installed_system_serials_derive installed_systems.serial_numbers is rebuilt from
--                                        the units attached to the system after any unit
--                                        insert, delete, re-link or serial edit. Placeholder
--                                        entries already on the array ("unknown") are kept.
--   - fn_inventory_serial_unit_unflag    when a duplicate group shrinks to one row, that row
--                                        stops needing review
--   - A transaction-local flag (loop.serial_sync) stops the two directions from
--     re-triggering each other.
--
-- Rules:
--   * Nothing here guesses. A group of two or more rows stays flagged until a person
--     removes or corrects all but one.
--   * No policy changes. Techs still cannot write units directly.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP TRIGGER IF EXISTS trg_inventory_serial_units_derive ON public.inventory_serial_units;
--   DROP TRIGGER IF EXISTS trg_inventory_serial_units_unflag ON public.inventory_serial_units;
--   DROP FUNCTION IF EXISTS public.fn_inventory_serial_units_derive_trigger();
--   DROP FUNCTION IF EXISTS public.fn_installed_system_serials_derive(uuid);
--   DROP FUNCTION IF EXISTS public.fn_inventory_serial_unit_unflag();
--   -- then restore fn_installed_system_serials_sync from 20261128000000.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- unit -> array
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_installed_system_serials_derive(p_system_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_array text[];
  from_units    text[];
  placeholders  text[];
  next_array    text[];
BEGIN
  SELECT serial_numbers INTO current_array
  FROM public.installed_systems WHERE id = p_system_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(u.serial_number ORDER BY u.created_at, u.id), '{}'::text[])
    INTO from_units
  FROM public.inventory_serial_units u
  WHERE u.installed_system_id = p_system_id;

  -- Placeholder entries cannot be units. Keep them so a rebuild never erases what a person typed.
  SELECT COALESCE(array_agg(x.serial ORDER BY x.ord), '{}'::text[])
    INTO placeholders
  FROM unnest(current_array) WITH ORDINALITY AS x(serial, ord)
  WHERE public.fn_serial_is_placeholder(x.serial);

  next_array := from_units || placeholders;

  IF current_array IS DISTINCT FROM next_array THEN
    PERFORM set_config('loop.serial_sync', 'on', true);
    UPDATE public.installed_systems SET serial_numbers = next_array WHERE id = p_system_id;
    PERFORM set_config('loop.serial_sync', 'off', true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_inventory_serial_units_derive_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('loop.serial_sync', true), 'off') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.installed_system_id IS NOT NULL THEN
    PERFORM public.fn_installed_system_serials_derive(NEW.installed_system_id);
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.installed_system_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR OLD.installed_system_id IS DISTINCT FROM NEW.installed_system_id) THEN
    PERFORM public.fn_installed_system_serials_derive(OLD.installed_system_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_serial_units_derive ON public.inventory_serial_units;
CREATE TRIGGER trg_inventory_serial_units_derive
  AFTER INSERT OR DELETE OR UPDATE OF installed_system_id, serial_number
  ON public.inventory_serial_units
  FOR EACH ROW EXECUTE FUNCTION public.fn_inventory_serial_units_derive_trigger();

-- ---------------------------------------------------------------------------
-- array -> unit (replaces the PR 1 function; same trigger)
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
  -- The derive function wrote this array from the units; nothing to reconcile.
  IF COALESCE(current_setting('loop.serial_sync', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('loop.serial_sync', 'on', true);

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

  -- A serial removed from the system: delete the units this bridge or the backfill
  -- created (when nothing in the ledger points at them), detach every other unit.
  DELETE FROM public.inventory_serial_units u
   WHERE u.installed_system_id = NEW.id
     AND u.source IN ('backfill', 'sync')
     AND NOT (u.serial_key = ANY (kept))
     AND NOT EXISTS (SELECT 1 FROM public.inventory_transactions t WHERE t.serial_unit_id = u.id);

  UPDATE public.inventory_serial_units u
     SET installed_system_id = NULL
   WHERE u.installed_system_id = NEW.id
     AND NOT (u.serial_key = ANY (kept));

  PERFORM set_config('loop.serial_sync', 'off', true);
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- A duplicate group that shrinks to one row no longer needs review.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_inventory_serial_unit_unflag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g record;
BEGIN
  FOR g IN
    SELECT DISTINCT k.org_id, k.manufacturer_key, k.serial_key
    FROM (
      SELECT OLD.org_id, OLD.manufacturer_key, OLD.serial_key WHERE TG_OP IN ('UPDATE', 'DELETE')
      UNION
      SELECT NEW.org_id, NEW.manufacturer_key, NEW.serial_key WHERE TG_OP = 'UPDATE'
    ) AS k
  LOOP
    UPDATE public.inventory_serial_units u
       SET needs_review = false, review_reason = NULL
     WHERE u.org_id = g.org_id
       AND u.manufacturer_key = g.manufacturer_key
       AND u.serial_key = g.serial_key
       AND u.needs_review
       AND (
         SELECT count(*) FROM public.inventory_serial_units o
         WHERE o.org_id = g.org_id
           AND o.manufacturer_key = g.manufacturer_key
           AND o.serial_key = g.serial_key
       ) = 1;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_serial_units_unflag ON public.inventory_serial_units;
CREATE TRIGGER trg_inventory_serial_units_unflag
  AFTER DELETE OR UPDATE OF serial_number, manufacturer
  ON public.inventory_serial_units
  FOR EACH ROW EXECUTE FUNCTION public.fn_inventory_serial_unit_unflag();

REVOKE ALL ON FUNCTION public.fn_installed_system_serials_derive(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_inventory_serial_units_derive_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_inventory_serial_unit_unflag() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_installed_system_serials_sync() FROM PUBLIC, anon, authenticated;
