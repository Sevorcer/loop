-- =============================================================================
-- Migration — Ledger link to plan lines and the pull flow (Inventory Lane 4, PR D, M6)
-- Plan: docs/briefs/inventory-lane4-plan-2026-11-05.md §2.11, §3.2, §6.6
--
-- UP (expand-only):
--   - inventory_transactions.material_line_id   nullable, same-org FK to job_material_lines,
--                                                ON DELETE RESTRICT (see note below)
--   - fn_inventory_txn_line_link()               a linked row must be for that line's job and item
--   - ensure_job_location(job)                   the job's virtual pallet location, created on demand
--   - pull_job_materials(job, line?)             warehouse -> pallet transfer for active reservations
--   - return_pallet_to_shop(job, note?)          pallet -> shop for a cancelled / deleted job
--   - inventory_stranded_pallets (view)          pallet stock left on cancelled / deleted jobs
--   - remove_material_line()                     now refuses a line that has stock movements
--
-- NOTE: the plan said ON DELETE SET NULL. That would run an UPDATE on the append-only
-- ledger, which its immutability trigger refuses, so RESTRICT is used. A line with
-- stock movements cannot be deleted; return the stock first.
--
-- All functions are SECURITY INVOKER: RLS applies as the caller. Pulls and returns are
-- ledger writes, so they are owner / manager / office (the existing ledger insert policy).
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP VIEW IF EXISTS public.inventory_stranded_pallets;
--   DROP FUNCTION IF EXISTS public.return_pallet_to_shop(uuid, text);
--   DROP FUNCTION IF EXISTS public.pull_job_materials(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.ensure_job_location(uuid);
--   DROP TRIGGER IF EXISTS trg_inventory_txn_line_link ON public.inventory_transactions;
--   DROP FUNCTION IF EXISTS public.fn_inventory_txn_line_link();
--   DROP INDEX IF EXISTS public.inventory_transactions_material_line_idx;
--   ALTER TABLE public.inventory_transactions
--     DROP CONSTRAINT IF EXISTS inventory_transactions_line_same_org_fkey,
--     DROP COLUMN IF EXISTS material_line_id;
--   -- and restore remove_material_line() from 20261126100000_material_plans.sql
-- =============================================================================

ALTER TABLE public.inventory_transactions
  ADD COLUMN IF NOT EXISTS material_line_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transactions_line_same_org_fkey') THEN
    ALTER TABLE public.inventory_transactions
      ADD CONSTRAINT inventory_transactions_line_same_org_fkey
      FOREIGN KEY (material_line_id, org_id)
      REFERENCES public.job_material_lines (id, org_id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS inventory_transactions_material_line_idx
  ON public.inventory_transactions (material_line_id) WHERE material_line_id IS NOT NULL;

-- A linked row must name the line's own job and catalog item. SECURITY DEFINER so the
-- check does not depend on the writer's visibility of the line.
CREATE OR REPLACE FUNCTION public.fn_inventory_txn_line_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.material_line_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.job_id IS NULL THEN
    RAISE EXCEPTION 'a ledger entry linked to a material line must also name the job'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.job_material_lines AS l
    WHERE l.id = NEW.material_line_id AND l.org_id = NEW.org_id
      AND l.job_id = NEW.job_id AND l.catalog_item_id = NEW.item_id
  ) THEN
    RAISE EXCEPTION 'material line % does not match this job and item', NEW.material_line_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_txn_line_link ON public.inventory_transactions;
CREATE TRIGGER trg_inventory_txn_line_link
  BEFORE INSERT ON public.inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_inventory_txn_line_link();

REVOKE EXECUTE ON FUNCTION public.fn_inventory_txn_line_link() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- ensure_job_location: the job's pallet (a 'job' location). Created on first pull.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_job_location(p_job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org    uuid;
  v_number text;
  v_loc    uuid;
  v_name   text;
BEGIN
  IF current_app_role() IS NULL OR current_app_role() NOT IN ('owner', 'manager', 'office') THEN
    RAISE EXCEPTION 'your role cannot move stock' USING ERRCODE = '42501';
  END IF;

  SELECT org_id, job_number INTO v_org, v_number FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job % not found', p_job_id USING ERRCODE = 'P0002';
  END IF;

  SELECT id INTO v_loc FROM public.inventory_locations WHERE job_id = p_job_id AND type = 'job';
  IF v_loc IS NOT NULL THEN
    RETURN v_loc;
  END IF;

  v_name := 'Pallet · ' || COALESCE(NULLIF(btrim(v_number), ''), left(p_job_id::text, 8));
  IF EXISTS (SELECT 1 FROM public.inventory_locations WHERE org_id = v_org AND lower(name) = lower(v_name)) THEN
    v_name := v_name || ' · ' || left(p_job_id::text, 4);
  END IF;

  INSERT INTO public.inventory_locations (org_id, type, name, job_id)
  VALUES (v_org, 'job', v_name, p_job_id)
  ON CONFLICT (job_id) WHERE type = 'job' DO NOTHING
  RETURNING id INTO v_loc;

  IF v_loc IS NULL THEN
    SELECT id INTO v_loc FROM public.inventory_locations WHERE job_id = p_job_id AND type = 'job';
  END IF;
  RETURN v_loc;
END;
$$;

-- ---------------------------------------------------------------------------
-- pull_job_materials: move each active reservation from the shop to the job's pallet.
--   Posts a paired transfer_out / transfer_in (job_id + material_line_id set), marks the
--   reservation 'pulled', and moves the line to 'pulled' (legacy state on_truck) once
--   everything it needs is on the pallet. A reservation is moved whole: if the shop's
--   physical on-hand is below it (a count came in lower), it is skipped and reported
--   as short; the reservation stays active. Idempotent: only active claims are moved.
-- Returns {pallet_location_id, pulled: [{line_id,item_id,qty}], short: [{line_id,item_id,qty,on_hand}]}.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pull_job_materials(
  p_job_id  uuid,
  p_line_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org      uuid;
  v_status   text;
  v_deleted  timestamptz;
  v_pallet   uuid;
  v_group    uuid;
  v_on_hand  numeric;
  v_pulled   jsonb := '[]'::jsonb;
  v_short    jsonb := '[]'::jsonb;
  v_uid      uuid := auth.uid();
  r          record;
  l          record;
  v_total    numeric;
BEGIN
  IF current_app_role() IS NULL OR current_app_role() NOT IN ('owner', 'manager', 'office') THEN
    RAISE EXCEPTION 'your role cannot move stock' USING ERRCODE = '42501';
  END IF;

  SELECT org_id, status, deleted_at INTO v_org, v_status, v_deleted FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job % not found', p_job_id USING ERRCODE = 'P0002';
  END IF;
  IF v_deleted IS NOT NULL OR v_status NOT IN ('Scheduled', 'In Progress') THEN
    RAISE EXCEPTION 'only a scheduled or in-progress job can have materials pulled'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Serialize on the items being moved (sorted, same key as reserve_job_materials).
  FOR r IN
    SELECT DISTINCT item_id FROM public.inventory_reservations
    WHERE job_id = p_job_id AND status = 'active' AND (p_line_id IS NULL OR line_id = p_line_id)
    ORDER BY 1
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('loop.reserve:' || r.item_id::text, 0));
  END LOOP;

  v_pallet := public.ensure_job_location(p_job_id);

  FOR r IN
    SELECT rv.id, rv.line_id, rv.item_id, rv.location_id, rv.qty
    FROM public.inventory_reservations AS rv
    WHERE rv.job_id = p_job_id AND rv.status = 'active' AND (p_line_id IS NULL OR rv.line_id = p_line_id)
    ORDER BY rv.item_id, rv.id
    FOR UPDATE
  LOOP
    SELECT COALESCE(on_hand, 0) INTO v_on_hand
    FROM public.inventory_stock_levels WHERE item_id = r.item_id AND location_id = r.location_id;
    v_on_hand := COALESCE(v_on_hand, 0);

    IF v_on_hand < r.qty THEN
      v_short := v_short || jsonb_build_array(jsonb_build_object(
        'line_id', r.line_id, 'item_id', r.item_id, 'qty', r.qty, 'on_hand', v_on_hand));
      CONTINUE;
    END IF;

    v_group := gen_random_uuid();
    INSERT INTO public.inventory_transactions
      (org_id, txn_type, item_id, location_id, qty_delta, job_id, material_line_id,
       transfer_group_id, reason, created_by)
    VALUES
      (v_org, 'transfer_out', r.item_id, r.location_id, -r.qty, p_job_id, r.line_id, v_group, 'Pulled for job', v_uid),
      (v_org, 'transfer_in',  r.item_id, v_pallet,       r.qty, p_job_id, r.line_id, v_group, 'Pulled for job', v_uid);

    UPDATE public.inventory_reservations SET status = 'pulled' WHERE id = r.id;

    v_pulled := v_pulled || jsonb_build_array(jsonb_build_object(
      'line_id', r.line_id, 'item_id', r.item_id, 'qty', r.qty));
  END LOOP;

  -- Per touched line: event, and stage / legacy state once fully on the pallet.
  FOR l IN
    SELECT DISTINCT (e->>'line_id')::uuid AS line_id FROM jsonb_array_elements(v_pulled) AS e
  LOOP
    SELECT COALESCE(SUM(qty), 0) INTO v_total
    FROM public.inventory_reservations WHERE line_id = l.line_id AND status = 'pulled';

    INSERT INTO public.job_material_line_events
      (org_id, job_id, line_id, line_name, event_type, origin, to_qty, detail)
    SELECT ln.org_id, ln.job_id, ln.id, ln.name, 'pulled', 'user', v_total,
           jsonb_build_object('pallet_location_id', v_pallet)
    FROM public.job_material_lines AS ln WHERE ln.id = l.line_id;

    UPDATE public.job_material_lines
       SET stage = 'pulled',
           state = CASE WHEN state = 'needed' THEN 'on_truck' ELSE state END
     WHERE id = l.line_id AND quantity <= v_total;
  END LOOP;

  RETURN jsonb_build_object('pallet_location_id', v_pallet, 'pulled', v_pulled, 'short', v_short);
END;
$$;

-- ---------------------------------------------------------------------------
-- return_pallet_to_shop: a cancelled (or deleted) job's pallet goes back to the shop.
--   Every positive balance at the job's location is transferred to the shop, linked to the
--   line that was pulled for that item. Pulled claims are released; lines drop back to planned.
-- Returns {shop_location_id, returned: [{item_id, qty}]}.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.return_pallet_to_shop(
  p_job_id uuid,
  p_note   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org      uuid;
  v_status   text;
  v_deleted  timestamptz;
  v_pallet   uuid;
  v_shop     uuid;
  v_group    uuid;
  v_line     uuid;
  v_uid      uuid := auth.uid();
  v_reason   text := COALESCE(NULLIF(btrim(p_note), ''), 'Pallet returned to shop');
  v_returned jsonb := '[]'::jsonb;
  r          record;
BEGIN
  IF current_app_role() IS NULL OR current_app_role() NOT IN ('owner', 'manager', 'office') THEN
    RAISE EXCEPTION 'your role cannot move stock' USING ERRCODE = '42501';
  END IF;

  SELECT org_id, status, deleted_at INTO v_org, v_status, v_deleted FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job % not found', p_job_id USING ERRCODE = 'P0002';
  END IF;
  IF v_deleted IS NULL AND v_status <> 'Cancelled' THEN
    RAISE EXCEPTION 'only a cancelled or deleted job''s pallet is returned this way'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT id INTO v_pallet FROM public.inventory_locations WHERE job_id = p_job_id AND type = 'job';
  IF v_pallet IS NULL THEN
    RETURN jsonb_build_object('shop_location_id', NULL, 'returned', v_returned);
  END IF;

  v_shop := public.default_fulfil_location(v_org);
  IF v_shop IS NULL THEN
    RAISE EXCEPTION 'add a warehouse before returning a pallet' USING ERRCODE = 'check_violation';
  END IF;

  FOR r IN
    SELECT item_id, on_hand FROM public.inventory_stock_levels
    WHERE location_id = v_pallet AND on_hand > 0
    ORDER BY item_id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('loop.reserve:' || r.item_id::text, 0));

    SELECT line_id INTO v_line
    FROM public.inventory_reservations
    WHERE job_id = p_job_id AND item_id = r.item_id AND status = 'pulled'
    ORDER BY reserved_at LIMIT 1;

    v_group := gen_random_uuid();
    INSERT INTO public.inventory_transactions
      (org_id, txn_type, item_id, location_id, qty_delta, job_id, material_line_id,
       transfer_group_id, reason, created_by)
    VALUES
      (v_org, 'transfer_out', r.item_id, v_pallet, -r.on_hand, p_job_id, v_line, v_group, v_reason, v_uid),
      (v_org, 'transfer_in',  r.item_id, v_shop,    r.on_hand, p_job_id, v_line, v_group, v_reason, v_uid);

    v_returned := v_returned || jsonb_build_array(jsonb_build_object('item_id', r.item_id, 'qty', r.on_hand));
  END LOOP;

  WITH rel AS (
    UPDATE public.inventory_reservations
       SET status = 'released', released_reason = 'cancelled'
     WHERE job_id = p_job_id AND status = 'pulled'
    RETURNING line_id, qty
  ), per_line AS (
    SELECT line_id, SUM(qty) AS qty FROM rel GROUP BY line_id
  ), ev AS (
    INSERT INTO public.job_material_line_events
      (org_id, job_id, line_id, line_name, event_type, origin, from_qty, reason)
    SELECT ln.org_id, ln.job_id, ln.id, ln.name, 'returned', 'user', p.qty, v_reason
    FROM per_line AS p JOIN public.job_material_lines AS ln ON ln.id = p.line_id
    RETURNING 1
  )
  UPDATE public.job_material_lines AS ln
     SET stage = 'planned',
         state = CASE WHEN ln.state = 'on_truck' THEN 'needed' ELSE ln.state END
    FROM per_line AS p
   WHERE ln.id = p.line_id AND ln.stage = 'pulled';

  RETURN jsonb_build_object('shop_location_id', v_shop, 'returned', v_returned);
END;
$$;

-- ---------------------------------------------------------------------------
-- inventory_stranded_pallets: stock still on the pallet of a cancelled / deleted job.
-- security_invoker: the reader's RLS on stock levels, locations and jobs applies.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.inventory_stranded_pallets
WITH (security_invoker = true) AS
SELECT
  j.id          AS job_id,
  j.job_number  AS job_number,
  j.title       AS job_title,
  j.status      AS job_status,
  l.id          AS location_id,
  sl.item_id    AS item_id,
  sl.on_hand    AS on_hand
FROM public.inventory_stock_levels AS sl
JOIN public.inventory_locations AS l ON l.id = sl.location_id AND l.type = 'job'
JOIN public.jobs AS j ON j.id = l.job_id
WHERE sl.on_hand > 0
  AND (j.status = 'Cancelled' OR j.deleted_at IS NOT NULL);

REVOKE ALL ON public.inventory_stranded_pallets FROM anon;
GRANT SELECT ON public.inventory_stranded_pallets TO authenticated;

-- ---------------------------------------------------------------------------
-- remove_material_line: refuse a line that has stock movements (was: a raw FK error).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.remove_material_line(
  p_line_id uuid,
  p_reason  text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('loop.line_origin', 'user', true);
  PERFORM set_config('loop.line_reason', coalesce(p_reason, ''), true);

  IF EXISTS (SELECT 1 FROM public.inventory_transactions WHERE material_line_id = p_line_id) THEN
    RAISE EXCEPTION 'this line has stock on the job''s pallet; return it to the shop before removing the line'
      USING ERRCODE = 'check_violation';
  END IF;

  DELETE FROM public.job_material_lines WHERE id = p_line_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'material line % not found', p_line_id USING ERRCODE = 'P0002';
  END IF;
  RETURN p_line_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.ensure_job_location(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pull_job_materials(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.return_pallet_to_shop(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_material_line(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_job_location(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pull_job_materials(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_pallet_to_shop(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_material_line(uuid, text) TO authenticated;
