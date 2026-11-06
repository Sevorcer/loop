-- =============================================================================
-- Migration — par writes and the stock-level guard (Inventory Lane 2, PR A, M2)
-- Plan: docs/briefs/inventory-lane2-plan-2026-11-05.md §4.2
-- Rulings: D2 per van (no template table), D3 min/max stay the columns,
--          D4 owner/manager/office set pars. No new columns. No seed.
--
-- min_qty / max_qty already exist on inventory_stock_levels. On-hand stays
-- trigger-owned. authenticated still has no INSERT/UPDATE/DELETE on the cache.
-- Pars are not a stock-level grant; they go through fn_inventory_set_par.
--
-- UP:
--   - fn_inventory_stock_levels_guard rejects on-hand edits that are not the ledger
--   - fn_inventory_txn_apply sets inventory.ledger_apply around its upsert
--     so a ledger post cannot wipe a par. The upsert math is unchanged.
--   - fn_inventory_set_par inserts an on_hand = 0 row or updates min/max only
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP TRIGGER IF EXISTS trg_inventory_stock_levels_guard ON public.inventory_stock_levels;
--   DROP FUNCTION IF EXISTS public.fn_inventory_stock_levels_guard();
--   DROP FUNCTION IF EXISTS public.fn_inventory_set_par(uuid, uuid, numeric, numeric);
--   -- Restore the Lane 1 apply function (no ledger_apply flag).
--   -- Pars already stored in min_qty / max_qty are left in place.
--   CREATE OR REPLACE FUNCTION public.fn_inventory_txn_apply()
--   RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
--   AS $body$
--   BEGIN
--     INSERT INTO public.inventory_stock_levels (org_id, item_id, location_id, on_hand, updated_at)
--     VALUES (NEW.org_id, NEW.item_id, NEW.location_id, NEW.qty_delta, now())
--     ON CONFLICT (item_id, location_id) DO UPDATE
--       SET on_hand = public.inventory_stock_levels.on_hand + EXCLUDED.on_hand,
--           updated_at = now();
--     RETURN NEW;
--   END;
--   $body$;
--   REVOKE ALL ON FUNCTION public.fn_inventory_txn_apply() FROM PUBLIC, anon, authenticated;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Guard. Ledger applies may change on_hand and must keep the par.
-- Any other update may change min_qty, max_qty, and updated_at only.
-- A non-ledger insert (the par function) must open the row at zero on-hand.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_inventory_stock_levels_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF current_setting('inventory.ledger_apply', true) = 'on' THEN
      RETURN NEW;
    END IF;
    IF NEW.on_hand IS DISTINCT FROM 0 THEN
      RAISE EXCEPTION 'a stock row opened outside the ledger must start at zero on-hand'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- The flag is set only for the ledger upsert, then cleared. While it is on,
  -- copy the stored par forward so the cache write cannot blank min/max.
  IF current_setting('inventory.ledger_apply', true) = 'on' THEN
    NEW.min_qty := OLD.min_qty;
    NEW.max_qty := OLD.max_qty;
    RETURN NEW;
  END IF;

  IF NEW.on_hand IS DISTINCT FROM OLD.on_hand
     OR NEW.item_id IS DISTINCT FROM OLD.item_id
     OR NEW.location_id IS DISTINCT FROM OLD.location_id
     OR NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'inventory_stock_levels on-hand is maintained by the ledger; par changes use fn_inventory_set_par'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_inventory_stock_levels_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_inventory_stock_levels_guard ON public.inventory_stock_levels;
CREATE TRIGGER trg_inventory_stock_levels_guard
  BEFORE INSERT OR UPDATE ON public.inventory_stock_levels
  FOR EACH ROW EXECUTE FUNCTION public.fn_inventory_stock_levels_guard();

-- ---------------------------------------------------------------------------
-- Ledger apply. Upsert math is the Lane 1 statement. The flag is local to
-- this transaction and cleared before the function returns, so a later par
-- write in the same transaction is not treated as a ledger write.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_inventory_txn_apply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('inventory.ledger_apply', 'on', true);
  BEGIN
    INSERT INTO public.inventory_stock_levels (org_id, item_id, location_id, on_hand, updated_at)
    VALUES (NEW.org_id, NEW.item_id, NEW.location_id, NEW.qty_delta, now())
    ON CONFLICT (item_id, location_id) DO UPDATE
      SET on_hand = public.inventory_stock_levels.on_hand + EXCLUDED.on_hand,
          updated_at = now();
    PERFORM set_config('inventory.ledger_apply', 'off', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('inventory.ledger_apply', 'off', true);
    RAISE;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_inventory_txn_apply() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Set or clear a van's par. On-hand is never written except as 0 on a new row.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_inventory_set_par(
  p_location_id uuid,
  p_item_id uuid,
  p_min numeric,
  p_max numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF auth.uid() IS NULL OR current_app_role() NOT IN ('owner', 'manager', 'office') THEN
    RAISE EXCEPTION 'only owner, manager, and office can set van pars'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_org := current_org_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'organization is not set'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_min IS NOT NULL AND (p_min < 0 OR p_min > 999999999.999 OR p_min <> trunc(p_min, 3)) THEN
    RAISE EXCEPTION 'minimum must be blank or a non-negative number with at most 3 decimal places'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_max IS NOT NULL AND (p_max < 0 OR p_max > 999999999.999 OR p_max <> trunc(p_max, 3)) THEN
    RAISE EXCEPTION 'fill-to must be blank or a non-negative number with at most 3 decimal places'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_min IS NOT NULL AND p_max IS NOT NULL AND p_min > p_max THEN
    RAISE EXCEPTION 'fill-to cannot be less than the minimum'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_locations
    WHERE id = p_location_id
      AND org_id = v_org
      AND type = 'van'
      AND is_active
  ) THEN
    RAISE EXCEPTION 'par levels can only be set on an active van'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.catalog_items
    WHERE id = p_item_id
      AND org_id = v_org
      AND is_stockable
      AND is_active
  ) THEN
    RAISE EXCEPTION 'par levels can only be set on an active stockable item'
      USING ERRCODE = 'check_violation';
  END IF;

  -- One statement so two savers cannot both insert. The guard allows the
  -- zero-on-hand insert and a later update that touches only the par.
  INSERT INTO public.inventory_stock_levels (
    org_id, item_id, location_id, on_hand, min_qty, max_qty, updated_at
  )
  VALUES (v_org, p_item_id, p_location_id, 0, p_min, p_max, now())
  ON CONFLICT (item_id, location_id) DO UPDATE
    SET min_qty = EXCLUDED.min_qty,
        max_qty = EXCLUDED.max_qty,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.fn_inventory_set_par(uuid, uuid, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_inventory_set_par(uuid, uuid, numeric, numeric) TO authenticated;
