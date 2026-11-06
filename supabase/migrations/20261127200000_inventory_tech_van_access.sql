-- =============================================================================
-- Migration — tech van read and the tech post function (Inventory Lane 2, PR A, M3)
-- Plan: docs/briefs/inventory-lane2-plan-2026-11-05.md §4.3
-- Rulings: D5 office count-in then tech recount, D6 self-serve pull,
--          D8 signals are an application rule (the count gate lives here for
--          recounts), D10 shop on-hand is readable, cost never is.
--
-- There is no tech policy on inventory_transactions. That table carries
-- unit_cost_cents. Activity is a column list without cost. Writes go through
-- fn_inventory_post_van_entries, which is the allow-list.
--
-- D2 per-class templates (20261127400000) and D6 restock lists (20261127300000)
-- are not built. Those numbers stay unused.
--
-- JSON contract for fn_inventory_post_van_entries(jsonb), a JSON array:
--
--   Count (zero delta is skipped, matching the office count command):
--     { "txn_type": "count", "location_id": "<van location>", "item_id": "<item>",
--       "counted_qty": <number >= 0>, "reason": "<optional>" }
--     qty_delta is counted_qty minus current on-hand. If qty_delta is also
--     sent, it must equal that value. The van must already have a count row.
--
--   Transfer pair (transfer_in must be the next element):
--     { "txn_type": "transfer_out", "location_id": "<shop>", "item_id": "<item>",
--       "qty": <positive>, "reason": "Restock" }
--     { "txn_type": "transfer_in", "location_id": "<van>", "item_id": "<item>",
--       "qty": <positive>, "reason": "Restock" }
--     The function assigns a new transfer_group_id per pair. unit_cost_cents,
--     job_id, transfer_group_id, created_by, and reverses_transaction_id must
--     be absent or JSON null. Office does not use this function.
--
-- UP:
--   - tech SELECT on own active van locations and active warehouses
--   - tech SELECT on stock at those locations
--   - fn_inventory_my_van_activity (no cost, no job, no transfer group)
--   - fn_inventory_post_van_entries (count on own van, shop → own van)
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP POLICY IF EXISTS "inventory_locations: read own van and shop for tech" ON public.inventory_locations;
--   DROP POLICY IF EXISTS "inventory_stock_levels: read own van and shop for tech" ON public.inventory_stock_levels;
--   DROP FUNCTION IF EXISTS public.fn_inventory_my_van_activity(integer);
--   DROP FUNCTION IF EXISTS public.fn_inventory_post_van_entries(jsonb);
--   DROP FUNCTION IF EXISTS private.inventory_post_van_reject_privileged(jsonb);
--   DROP FUNCTION IF EXISTS private.inventory_post_van_uuid(jsonb, text);
--   DROP FUNCTION IF EXISTS private.inventory_post_van_own_van(uuid, uuid);
--   DROP FUNCTION IF EXISTS private.inventory_post_van_stockable(uuid, uuid);
--   DROP FUNCTION IF EXISTS private.inventory_post_van_qty(jsonb, text, boolean);
--   DROP FUNCTION IF EXISTS private.inventory_post_van_match_delta(jsonb, numeric);
--   DROP FUNCTION IF EXISTS private.inventory_post_van_reason(jsonb);
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tech read. Existing ops policies stay. Sales and portal stay denied.
-- Active rows only: a retired van drops out of the tech's view.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "inventory_locations: read own van and shop for tech" ON public.inventory_locations;
CREATE POLICY "inventory_locations: read own van and shop for tech"
  ON public.inventory_locations FOR SELECT TO authenticated
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND is_active
    AND (
      (type = 'van' AND vehicle_id IN (SELECT public.fn_inventory_visible_vehicle_ids()))
      OR type = 'warehouse'
    )
  );

DROP POLICY IF EXISTS "inventory_stock_levels: read own van and shop for tech" ON public.inventory_stock_levels;
CREATE POLICY "inventory_stock_levels: read own van and shop for tech"
  ON public.inventory_stock_levels FOR SELECT TO authenticated
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND location_id IN (
      SELECT id
      FROM public.inventory_locations
      WHERE org_id = current_org_id()
        AND is_active
        AND (
          (type = 'van' AND vehicle_id IN (SELECT public.fn_inventory_visible_vehicle_ids()))
          OR type = 'warehouse'
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Recent van activity without cost. Tech sees assigned vans. Office roles
-- see every van they can already read. Sales and portal get nothing.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_inventory_my_van_activity(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  txn_type text,
  item_id uuid,
  location_id uuid,
  qty_delta numeric,
  reason text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_limit integer;
BEGIN
  v_role := current_app_role();
  IF v_role IS NULL OR v_role IN ('sales', 'portal') THEN
    RETURN;
  END IF;
  IF v_role NOT IN ('tech', 'owner', 'manager', 'dispatch', 'office') THEN
    RETURN;
  END IF;
  IF current_org_id() IS NULL OR auth.uid() IS NULL THEN
    RETURN;
  END IF;

  v_limit := COALESCE(p_limit, 50);
  IF v_limit < 1 OR v_limit > 200 THEN
    RAISE EXCEPTION 'limit must be between 1 and 200'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.txn_type,
    t.item_id,
    t.location_id,
    t.qty_delta,
    t.reason,
    t.created_at
  FROM public.inventory_transactions t
  JOIN public.inventory_locations l
    ON l.id = t.location_id
   AND l.org_id = t.org_id
  WHERE t.org_id = current_org_id()
    AND l.type = 'van'
    AND (
      v_role IN ('owner', 'manager', 'dispatch', 'office')
      OR l.vehicle_id IN (SELECT public.fn_inventory_visible_vehicle_ids())
    )
  ORDER BY t.created_at DESC, t.id DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_inventory_my_van_activity(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_inventory_my_van_activity(integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- The only tech append path. Definer, so the checks in this body are the
-- authority. Anything that is not a recount or a shop-to-own-van transfer
-- raises. unit_cost_cents is forced null.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_inventory_post_van_entries(p_entries jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_org uuid;
  v_len integer;
  v_i integer;
  v_entry jsonb;
  v_pair jsonb;
  v_type text;
  v_location_id uuid;
  v_van_location_id uuid;
  v_shop_location_id uuid;
  v_parent_id uuid;
  v_item_id uuid;
  v_pair_item_id uuid;
  v_vehicle_id uuid;
  v_counted numeric;
  v_on_hand numeric;
  v_delta numeric;
  v_qty numeric;
  v_pair_qty numeric;
  v_reason text;
  v_pair_reason text;
  v_group uuid;
  v_new_id uuid;
  v_wh_count integer;
  v_posted jsonb := '[]'::jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR current_app_role() IS DISTINCT FROM 'tech' THEN
    RAISE EXCEPTION 'only a signed-in technician can post van entries'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_org := current_org_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'organization is not set'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' THEN
    RAISE EXCEPTION 'entries must be a JSON array'
      USING ERRCODE = 'check_violation';
  END IF;

  v_len := jsonb_array_length(p_entries);
  IF v_len = 0 THEN
    RETURN v_posted;
  END IF;
  IF v_len > 200 THEN
    RAISE EXCEPTION 'too many entries'
      USING ERRCODE = 'check_violation';
  END IF;

  v_i := 0;
  WHILE v_i < v_len LOOP
    v_entry := p_entries -> v_i;
    IF jsonb_typeof(v_entry) <> 'object' THEN
      RAISE EXCEPTION 'each entry must be an object'
        USING ERRCODE = 'check_violation';
    END IF;

    v_type := v_entry->>'txn_type';

    IF v_type = 'count' THEN
      PERFORM private.inventory_post_van_reject_privileged(v_entry);
      v_location_id := private.inventory_post_van_uuid(v_entry, 'location_id');
      v_item_id := private.inventory_post_van_uuid(v_entry, 'item_id');
      v_vehicle_id := private.inventory_post_van_own_van(v_location_id, v_org);
      v_reason := private.inventory_post_van_reason(v_entry);

      IF NOT EXISTS (
        SELECT 1 FROM public.inventory_transactions t
        WHERE t.org_id = v_org
          AND t.location_id = v_location_id
          AND t.txn_type = 'count'
      ) THEN
        RAISE EXCEPTION 'this van has not been counted in yet'
          USING ERRCODE = 'check_violation';
      END IF;

      PERFORM private.inventory_post_van_stockable(v_item_id, v_org);

      SELECT s.on_hand INTO v_on_hand
      FROM public.inventory_stock_levels s
      WHERE s.item_id = v_item_id
        AND s.location_id = v_location_id
        AND s.org_id = v_org;
      IF NOT FOUND THEN
        v_on_hand := 0;
      END IF;

      v_counted := private.inventory_post_van_qty(v_entry, 'counted_qty', true);
      v_delta := v_counted - v_on_hand;
      PERFORM private.inventory_post_van_match_delta(v_entry, v_delta);

      IF v_delta <> 0 THEN
        INSERT INTO public.inventory_transactions (
          org_id, txn_type, item_id, location_id, qty_delta,
          job_id, transfer_group_id, reverses_transaction_id,
          reason, unit_cost_cents, created_by
        ) VALUES (
          v_org, 'count', v_item_id, v_location_id, v_delta,
          NULL, NULL, NULL,
          v_reason, NULL, v_uid
        )
        RETURNING inventory_transactions.id INTO v_new_id;

        v_posted := v_posted || jsonb_build_array(jsonb_build_object(
          'id', v_new_id,
          'txn_type', 'count',
          'item_id', v_item_id,
          'location_id', v_location_id,
          'qty_delta', v_delta
        ));
      END IF;

      v_i := v_i + 1;

    ELSIF v_type = 'transfer_out' THEN
      IF v_i + 1 >= v_len THEN
        RAISE EXCEPTION 'a transfer_out must be followed by its transfer_in'
          USING ERRCODE = 'check_violation';
      END IF;
      v_pair := p_entries -> (v_i + 1);
      IF jsonb_typeof(v_pair) <> 'object' OR v_pair->>'txn_type' IS DISTINCT FROM 'transfer_in' THEN
        RAISE EXCEPTION 'a transfer_out must be followed by its transfer_in'
          USING ERRCODE = 'check_violation';
      END IF;

      PERFORM private.inventory_post_van_reject_privileged(v_entry);
      PERFORM private.inventory_post_van_reject_privileged(v_pair);

      v_van_location_id := private.inventory_post_van_uuid(v_pair, 'location_id');
      v_vehicle_id := private.inventory_post_van_own_van(v_van_location_id, v_org);
      v_shop_location_id := private.inventory_post_van_uuid(v_entry, 'location_id');
      v_item_id := private.inventory_post_van_uuid(v_entry, 'item_id');
      v_pair_item_id := private.inventory_post_van_uuid(v_pair, 'item_id');

      IF v_item_id IS DISTINCT FROM v_pair_item_id THEN
        RAISE EXCEPTION 'a transfer pair must be the same item'
          USING ERRCODE = 'check_violation';
      END IF;

      PERFORM private.inventory_post_van_stockable(v_item_id, v_org);

      SELECT l.parent_location_id INTO v_parent_id
      FROM public.inventory_locations l
      WHERE l.id = v_van_location_id
        AND l.org_id = v_org;

      v_parent_id := (
        SELECT l.id
        FROM public.inventory_locations l
        WHERE l.id = v_parent_id
          AND l.org_id = v_org
          AND l.type = 'warehouse'
          AND l.is_active
      );

      IF v_parent_id IS NULL THEN
        SELECT count(*) INTO v_wh_count
        FROM public.inventory_locations l
        WHERE l.org_id = v_org
          AND l.type = 'warehouse'
          AND l.is_active;
        IF v_wh_count IS DISTINCT FROM 1 THEN
          RAISE EXCEPTION 'shop warehouse for this van could not be resolved'
            USING ERRCODE = 'check_violation';
        END IF;
        SELECT l.id INTO v_parent_id
        FROM public.inventory_locations l
        WHERE l.org_id = v_org
          AND l.type = 'warehouse'
          AND l.is_active;
      END IF;

      IF v_shop_location_id IS DISTINCT FROM v_parent_id THEN
        RAISE EXCEPTION 'transfer must come from this van''s shop warehouse'
          USING ERRCODE = 'check_violation';
      END IF;

      v_qty := private.inventory_post_van_qty(v_entry, 'qty', false);
      v_pair_qty := private.inventory_post_van_qty(v_pair, 'qty', false);
      IF v_qty IS DISTINCT FROM v_pair_qty THEN
        RAISE EXCEPTION 'a transfer pair must move the same positive quantity'
          USING ERRCODE = 'check_violation';
      END IF;

      PERFORM private.inventory_post_van_match_delta(v_entry, -v_qty);
      PERFORM private.inventory_post_van_match_delta(v_pair, v_qty);

      v_reason := private.inventory_post_van_reason(v_entry);
      v_pair_reason := private.inventory_post_van_reason(v_pair);
      v_group := gen_random_uuid();

      INSERT INTO public.inventory_transactions (
        org_id, txn_type, item_id, location_id, qty_delta,
        job_id, transfer_group_id, reverses_transaction_id,
        reason, unit_cost_cents, created_by
      ) VALUES (
        v_org, 'transfer_out', v_item_id, v_shop_location_id, -v_qty,
        NULL, v_group, NULL,
        v_reason, NULL, v_uid
      )
      RETURNING inventory_transactions.id INTO v_new_id;

      v_posted := v_posted || jsonb_build_array(jsonb_build_object(
        'id', v_new_id,
        'txn_type', 'transfer_out',
        'item_id', v_item_id,
        'location_id', v_shop_location_id,
        'qty_delta', -v_qty
      ));

      INSERT INTO public.inventory_transactions (
        org_id, txn_type, item_id, location_id, qty_delta,
        job_id, transfer_group_id, reverses_transaction_id,
        reason, unit_cost_cents, created_by
      ) VALUES (
        v_org, 'transfer_in', v_item_id, v_van_location_id, v_qty,
        NULL, v_group, NULL,
        v_pair_reason, NULL, v_uid
      )
      RETURNING inventory_transactions.id INTO v_new_id;

      v_posted := v_posted || jsonb_build_array(jsonb_build_object(
        'id', v_new_id,
        'txn_type', 'transfer_in',
        'item_id', v_item_id,
        'location_id', v_van_location_id,
        'qty_delta', v_qty
      ));

      v_i := v_i + 2;
    ELSE
      RAISE EXCEPTION 'technicians can post a count or a shop-to-van transfer only'
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  RETURN v_posted;
END;
$$;

-- Helpers live in private so PostgREST does not publish them. Execute is
-- revoked from PUBLIC, anon, and authenticated, then granted back to the
-- migration role (the owner of fn_inventory_post_van_entries) so the definer
-- body can call them. They are not an API.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.inventory_post_van_reject_privileged(p_entry jsonb)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF (p_entry ? 'unit_cost_cents' AND jsonb_typeof(p_entry -> 'unit_cost_cents') IS DISTINCT FROM 'null')
     OR (p_entry ? 'job_id' AND jsonb_typeof(p_entry -> 'job_id') IS DISTINCT FROM 'null')
     OR (p_entry ? 'transfer_group_id' AND jsonb_typeof(p_entry -> 'transfer_group_id') IS DISTINCT FROM 'null')
     OR (p_entry ? 'reverses_transaction_id' AND jsonb_typeof(p_entry -> 'reverses_transaction_id') IS DISTINCT FROM 'null')
     OR (p_entry ? 'created_by' AND jsonb_typeof(p_entry -> 'created_by') IS DISTINCT FROM 'null')
  THEN
    RAISE EXCEPTION 'van entries cannot set cost, job, transfer group, reversal, or author'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_entry ? 'org_id'
     AND jsonb_typeof(p_entry -> 'org_id') IS DISTINCT FROM 'null'
     AND (p_entry->>'org_id')::uuid IS DISTINCT FROM current_org_id()
  THEN
    RAISE EXCEPTION 'entry is outside this organization'
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.inventory_post_van_uuid(p_entry jsonb, p_key text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_value uuid;
BEGIN
  IF p_entry -> p_key IS NULL OR jsonb_typeof(p_entry -> p_key) IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION '% must be a uuid', p_key
      USING ERRCODE = 'check_violation';
  END IF;
  BEGIN
    v_value := (p_entry->>p_key)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION '% must be a uuid', p_key
      USING ERRCODE = 'check_violation';
  END;
  RETURN v_value;
END;
$$;

CREATE OR REPLACE FUNCTION private.inventory_post_van_own_van(p_location_id uuid, p_org uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vehicle_id uuid;
BEGIN
  SELECT l.vehicle_id INTO v_vehicle_id
  FROM public.inventory_locations l
  WHERE l.id = p_location_id
    AND l.org_id = p_org
    AND l.type = 'van'
    AND l.is_active
    AND l.vehicle_id IN (SELECT public.fn_inventory_visible_vehicle_ids());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'van location is not available'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN v_vehicle_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.inventory_post_van_stockable(p_item_id uuid, p_org uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.catalog_items
    WHERE id = p_item_id
      AND org_id = p_org
      AND is_stockable
  ) THEN
    RAISE EXCEPTION 'item is not a stockable item in this organization'
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.inventory_post_van_qty(
  p_entry jsonb,
  p_key text,
  p_allow_zero boolean
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_qty numeric;
BEGIN
  IF p_entry -> p_key IS NULL OR jsonb_typeof(p_entry -> p_key) NOT IN ('number', 'string') THEN
    RAISE EXCEPTION '% is required', p_key
      USING ERRCODE = 'check_violation';
  END IF;
  BEGIN
    v_qty := (p_entry->>p_key)::numeric;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION '% must be a number', p_key
      USING ERRCODE = 'check_violation';
  END;
  IF v_qty IS NULL
     OR (p_allow_zero AND v_qty < 0)
     OR (NOT p_allow_zero AND v_qty <= 0)
     OR v_qty > 999999999.999
     OR v_qty <> trunc(v_qty, 3)
  THEN
    RAISE EXCEPTION '% must be a % number with at most 3 decimal places',
      p_key, CASE WHEN p_allow_zero THEN 'non-negative' ELSE 'positive' END
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN v_qty;
END;
$$;

CREATE OR REPLACE FUNCTION private.inventory_post_van_match_delta(p_entry jsonb, p_expected numeric)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_entry ? 'qty_delta' AND jsonb_typeof(p_entry -> 'qty_delta') IS DISTINCT FROM 'null' THEN
    IF (p_entry->>'qty_delta')::numeric IS DISTINCT FROM p_expected THEN
      RAISE EXCEPTION 'qty_delta does not match the quantity this entry would post'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.inventory_post_van_reason(p_entry jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_reason text;
BEGIN
  v_reason := NULLIF(btrim(p_entry->>'reason'), '');
  IF v_reason IS NOT NULL AND length(v_reason) > 500 THEN
    RAISE EXCEPTION 'reason is too long'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN v_reason;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_inventory_post_van_entries(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_inventory_post_van_entries(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION private.inventory_post_van_reject_privileged(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.inventory_post_van_uuid(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.inventory_post_van_own_van(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.inventory_post_van_stockable(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.inventory_post_van_qty(jsonb, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.inventory_post_van_match_delta(jsonb, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.inventory_post_van_reason(jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.inventory_post_van_reject_privileged(jsonb) TO CURRENT_USER;
GRANT EXECUTE ON FUNCTION private.inventory_post_van_uuid(jsonb, text) TO CURRENT_USER;
GRANT EXECUTE ON FUNCTION private.inventory_post_van_own_van(uuid, uuid) TO CURRENT_USER;
GRANT EXECUTE ON FUNCTION private.inventory_post_van_stockable(uuid, uuid) TO CURRENT_USER;
GRANT EXECUTE ON FUNCTION private.inventory_post_van_qty(jsonb, text, boolean) TO CURRENT_USER;
GRANT EXECUTE ON FUNCTION private.inventory_post_van_match_delta(jsonb, numeric) TO CURRENT_USER;
GRANT EXECUTE ON FUNCTION private.inventory_post_van_reason(jsonb) TO CURRENT_USER;
