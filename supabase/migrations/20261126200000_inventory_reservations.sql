-- =============================================================================
-- Migration — Inventory reservations and availability (Inventory Lane 4, PR C, M3)
-- Plan: docs/briefs/inventory-lane4-plan-2026-11-05.md (approved 2026-11-05; D1–D13)
--
-- UP (expand-only; nothing existing changes meaning):
--   - inventory_reservations     a claim on shop stock for one plan line (never writes
--                                the ledger or stock levels)
--   - inventory_available        view: on_hand - reserved per item + location. A job that
--                                is Cancelled, Completed or deleted no longer holds
--                                stock, so a missed release hook cannot lock stock
--   - job_material_lines         ADDITIVE: stage, cached readiness (state, reason, eta),
--                                fulfil_location_id (NULL = the default shop warehouse)
--   - job_material_plans         ADDITIVE: cached rollup readiness
--   - default_fulfil_location()  the shop warehouse (oldest active warehouse of the org)
--   - reserve_job_materials()    idempotent reconcile: reserves what is available, trims
--                                what is no longer needed, releases when the job cannot
--                                hold stock. Per-item advisory locks stop two plans
--                                claiming the last unit
--   - release_job_reservations() release active claims (all, or one line)
--   - guard_tech_job_material_update  EXTENDED: techs still change only state and quantity
--
-- Allocation is first-come by reserved_at (D8). A moved job goes to the back of the
-- queue (reserve_job_materials(..., p_requeue => true)). Reservation writes are done
-- by SECURITY INVOKER functions, so RLS applies to the caller; there is no DELETE.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP FUNCTION IF EXISTS public.reserve_job_materials(uuid, text, boolean);
--   DROP FUNCTION IF EXISTS public.release_job_reservations(uuid, text, uuid);
--   DROP FUNCTION IF EXISTS public.default_fulfil_location(uuid);
--   DROP VIEW IF EXISTS public.inventory_available;
--   DROP TABLE IF EXISTS public.inventory_reservations;
--   DROP FUNCTION IF EXISTS public.fn_inventory_reservations_stamp();
--   DROP FUNCTION IF EXISTS public.fn_inventory_reservations_guard();
--   ALTER TABLE public.job_material_plans
--     DROP COLUMN IF EXISTS readiness_checked_at, DROP COLUMN IF EXISTS readiness_reason,
--     DROP COLUMN IF EXISTS readiness_state;
--   ALTER TABLE public.job_material_lines
--     DROP CONSTRAINT IF EXISTS job_material_lines_fulfil_same_org_fkey,
--     DROP CONSTRAINT IF EXISTS job_material_lines_id_org_key,
--     DROP COLUMN IF EXISTS fulfil_location_id, DROP COLUMN IF EXISTS readiness_eta,
--     DROP COLUMN IF EXISTS readiness_reason, DROP COLUMN IF EXISTS readiness_state,
--     DROP COLUMN IF EXISTS stage;
--   (then restore guard_tech_job_material_update() from 20261126100000)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- job_material_lines — additive columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.job_material_lines
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'planned'
    CHECK (stage IN ('planned', 'reserved', 'pulled', 'reconciled')),
  ADD COLUMN IF NOT EXISTS readiness_state text
    CHECK (readiness_state IS NULL OR readiness_state IN ('ok', 'arriving_in_time', 'short', 'at_risk')),
  ADD COLUMN IF NOT EXISTS readiness_reason text,
  ADD COLUMN IF NOT EXISTS readiness_eta date,
  ADD COLUMN IF NOT EXISTS fulfil_location_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_material_lines_id_org_key') THEN
    ALTER TABLE public.job_material_lines
      ADD CONSTRAINT job_material_lines_id_org_key UNIQUE (id, org_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_material_lines_fulfil_same_org_fkey') THEN
    ALTER TABLE public.job_material_lines
      ADD CONSTRAINT job_material_lines_fulfil_same_org_fkey
      FOREIGN KEY (fulfil_location_id, org_id)
      REFERENCES public.inventory_locations (id, org_id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS job_material_lines_fulfil_location_idx
  ON public.job_material_lines (fulfil_location_id) WHERE fulfil_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS job_material_lines_stage_idx
  ON public.job_material_lines (job_id, stage);

ALTER TABLE public.job_material_plans
  ADD COLUMN IF NOT EXISTS readiness_state text
    CHECK (readiness_state IS NULL OR readiness_state IN ('ok', 'arriving_in_time', 'short', 'at_risk')),
  ADD COLUMN IF NOT EXISTS readiness_reason text,
  ADD COLUMN IF NOT EXISTS readiness_checked_at timestamptz;

-- Tech guard (extends 20261126100000): techs still change only state and quantity.
CREATE OR REPLACE FUNCTION public.guard_tech_job_material_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_app_role() IS DISTINCT FROM 'tech' THEN
    RETURN NEW;
  END IF;

  IF NEW.name        IS DISTINCT FROM OLD.name
     OR NEW.unit        IS DISTINCT FROM OLD.unit
     OR NEW.part_number IS DISTINCT FROM OLD.part_number
     OR NEW.notes       IS DISTINCT FROM OLD.notes
     OR NEW.sort_order  IS DISTINCT FROM OLD.sort_order
     OR NEW.plan_id               IS DISTINCT FROM OLD.plan_id
     OR NEW.catalog_item_id       IS DISTINCT FROM OLD.catalog_item_id
     OR NEW.source                IS DISTINCT FROM OLD.source
     OR NEW.job_line_item_id      IS DISTINCT FROM OLD.job_line_item_id
     OR NEW.estimate_line_item_id IS DISTINCT FROM OLD.estimate_line_item_id
     OR NEW.kit_id                IS DISTINCT FROM OLD.kit_id
     OR NEW.kit_version           IS DISTINCT FROM OLD.kit_version
     OR NEW.kit_quantity          IS DISTINCT FROM OLD.kit_quantity
     OR NEW.is_optional           IS DISTINCT FROM OLD.is_optional
     OR NEW.non_stock_reason      IS DISTINCT FROM OLD.non_stock_reason
     OR NEW.stage                 IS DISTINCT FROM OLD.stage
     OR NEW.readiness_state       IS DISTINCT FROM OLD.readiness_state
     OR NEW.readiness_reason      IS DISTINCT FROM OLD.readiness_reason
     OR NEW.readiness_eta         IS DISTINCT FROM OLD.readiness_eta
     OR NEW.fulfil_location_id    IS DISTINCT FROM OLD.fulfil_location_id
  THEN
    RAISE EXCEPTION 'Technicians can only change a material''s state and quantity'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- inventory_reservations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id           uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  line_id          uuid NOT NULL,
  item_id          uuid NOT NULL,
  location_id      uuid NOT NULL,
  qty              numeric(12, 3) NOT NULL CHECK (qty > 0),
  status           text NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'pulled', 'released', 'consumed')),
  released_reason  text
                     CHECK (released_reason IS NULL OR released_reason IN (
                       'rescheduled', 'cancelled', 'on_hold', 'unscheduled', 'removed',
                       'plan_changed', 'completed', 'manual')),
  reserved_at      timestamptz NOT NULL DEFAULT now(),
  released_at      timestamptz,
  reserved_by      uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  CONSTRAINT inventory_reservations_line_same_org_fkey
    FOREIGN KEY (line_id, org_id) REFERENCES public.job_material_lines (id, org_id) ON DELETE CASCADE,
  CONSTRAINT inventory_reservations_item_same_org_fkey
    FOREIGN KEY (item_id, org_id) REFERENCES public.catalog_items (id, org_id) ON DELETE RESTRICT,
  CONSTRAINT inventory_reservations_location_same_org_fkey
    FOREIGN KEY (location_id, org_id) REFERENCES public.inventory_locations (id, org_id) ON DELETE RESTRICT,
  CONSTRAINT inventory_reservations_released_has_reason
    CHECK (status <> 'released' OR released_reason IS NOT NULL),
  CONSTRAINT inventory_reservations_closed_has_time
    CHECK ((status IN ('released', 'consumed')) = (released_at IS NOT NULL))
);

-- The availability view and reserve_job_materials() read active claims per item.
CREATE INDEX IF NOT EXISTS inventory_reservations_active_item_idx
  ON public.inventory_reservations (item_id, location_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS inventory_reservations_job_idx
  ON public.inventory_reservations (job_id, status);
CREATE INDEX IF NOT EXISTS inventory_reservations_line_idx
  ON public.inventory_reservations (line_id, status);
CREATE INDEX IF NOT EXISTS inventory_reservations_org_idx
  ON public.inventory_reservations (org_id);
CREATE INDEX IF NOT EXISTS inventory_reservations_location_idx
  ON public.inventory_reservations (location_id);
CREATE INDEX IF NOT EXISTS inventory_reservations_reserved_by_idx
  ON public.inventory_reservations (reserved_by);

CREATE OR REPLACE FUNCTION public.fn_inventory_reservations_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_line_job  uuid;
  v_line_item uuid;
  v_loc_type  text;
  v_loc_live  boolean;
BEGIN
  -- A claim always starts active; who and when come from the session, never the body.
  NEW.status          := 'active';
  NEW.released_reason := NULL;
  NEW.released_at     := NULL;
  NEW.reserved_by     := auth.uid();
  NEW.reserved_at     := now();

  SELECT job_id, catalog_item_id INTO v_line_job, v_line_item
  FROM public.job_material_lines WHERE id = NEW.line_id;
  IF NOT FOUND OR v_line_job IS DISTINCT FROM NEW.job_id OR v_line_item IS DISTINCT FROM NEW.item_id THEN
    RAISE EXCEPTION 'reservation must match its material line (job and catalog item)'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT type, is_active INTO v_loc_type, v_loc_live
  FROM public.inventory_locations WHERE id = NEW.location_id;
  IF NOT FOUND OR v_loc_type <> 'warehouse' OR NOT v_loc_live THEN
    RAISE EXCEPTION 'stock can only be reserved at an active warehouse'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_reservations_stamp ON public.inventory_reservations;
CREATE TRIGGER trg_inventory_reservations_stamp
  BEFORE INSERT ON public.inventory_reservations
  FOR EACH ROW EXECUTE FUNCTION public.fn_inventory_reservations_stamp();

-- Only the status can move: active -> pulled | released | consumed, pulled -> consumed | released.
CREATE OR REPLACE FUNCTION public.fn_inventory_reservations_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id      IS DISTINCT FROM OLD.org_id
     OR NEW.job_id      IS DISTINCT FROM OLD.job_id
     OR NEW.line_id     IS DISTINCT FROM OLD.line_id
     OR NEW.item_id     IS DISTINCT FROM OLD.item_id
     OR NEW.location_id IS DISTINCT FROM OLD.location_id
     OR NEW.qty         IS DISTINCT FROM OLD.qty
     OR NEW.reserved_at IS DISTINCT FROM OLD.reserved_at
     OR NEW.reserved_by IS DISTINCT FROM OLD.reserved_by
  THEN
    RAISE EXCEPTION 'a reservation can only change status; release it and reserve again'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT ((OLD.status = 'active' AND NEW.status IN ('pulled', 'released', 'consumed'))
         OR (OLD.status = 'pulled' AND NEW.status IN ('consumed', 'released'))) THEN
      RAISE EXCEPTION 'reservation cannot go from % to %', OLD.status, NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status IN ('released', 'consumed') THEN
      NEW.released_at := now();
    END IF;
  ELSIF NEW.released_reason IS DISTINCT FROM OLD.released_reason
        OR NEW.released_at IS DISTINCT FROM OLD.released_at THEN
    RAISE EXCEPTION 'a closed reservation cannot be edited' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_reservations_guard ON public.inventory_reservations;
CREATE TRIGGER trg_inventory_reservations_guard
  BEFORE UPDATE ON public.inventory_reservations
  FOR EACH ROW EXECUTE FUNCTION public.fn_inventory_reservations_guard();

-- ---------------------------------------------------------------------------
-- RLS and privileges
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.inventory_reservations FROM anon;
REVOKE ALL ON public.inventory_reservations FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inventory_reservations TO authenticated;

ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_reservations: read for office roles" ON public.inventory_reservations;
CREATE POLICY "inventory_reservations: read for office roles"
  ON public.inventory_reservations FOR SELECT TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
         AND org_id = (select current_org_id()));

DROP POLICY IF EXISTS "inventory_reservations: insert for office roles" ON public.inventory_reservations;
CREATE POLICY "inventory_reservations: insert for office roles"
  ON public.inventory_reservations FOR INSERT TO authenticated
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
              AND org_id = (select current_org_id())
              AND EXISTS (SELECT 1 FROM public.jobs AS j
                          WHERE j.id = inventory_reservations.job_id
                            AND j.org_id = (select current_org_id())));

DROP POLICY IF EXISTS "inventory_reservations: update for office roles" ON public.inventory_reservations;
CREATE POLICY "inventory_reservations: update for office roles"
  ON public.inventory_reservations FOR UPDATE TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
         AND org_id = (select current_org_id()))
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
              AND org_id = (select current_org_id()));

-- ---------------------------------------------------------------------------
-- inventory_available — on hand minus what live jobs have claimed
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.inventory_available
WITH (security_invoker = true) AS
WITH held AS (
  SELECT r.org_id, r.item_id, r.location_id, SUM(r.qty) AS reserved
  FROM public.inventory_reservations AS r
  JOIN public.jobs AS j ON j.id = r.job_id
  WHERE r.status = 'active'
    AND j.deleted_at IS NULL
    AND j.status NOT IN ('Cancelled', 'Completed')
  GROUP BY r.org_id, r.item_id, r.location_id
)
SELECT
  COALESCE(s.org_id, h.org_id)           AS org_id,
  COALESCE(s.item_id, h.item_id)         AS item_id,
  COALESCE(s.location_id, h.location_id) AS location_id,
  COALESCE(s.on_hand, 0)                 AS on_hand,
  COALESCE(h.reserved, 0)                AS reserved,
  COALESCE(s.on_hand, 0) - COALESCE(h.reserved, 0) AS available
FROM public.inventory_stock_levels AS s
FULL JOIN held AS h
  ON h.item_id = s.item_id AND h.location_id = s.location_id;

REVOKE ALL ON public.inventory_available FROM anon;
REVOKE ALL ON public.inventory_available FROM authenticated;
GRANT SELECT ON public.inventory_available TO authenticated;

-- ---------------------------------------------------------------------------
-- Functions — SECURITY INVOKER (RLS applies as the caller)
-- ---------------------------------------------------------------------------

-- The shop: the oldest active warehouse of the org, until Lane 2 adds a setting.
CREATE OR REPLACE FUNCTION public.default_fulfil_location(p_org uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.inventory_locations
  WHERE org_id = p_org AND type = 'warehouse' AND is_active
  ORDER BY created_at, id
  LIMIT 1;
$$;

-- release_job_reservations: close active claims (a whole job, or one line).
-- Writes one 'released' event per line. Returns the number of claims released.
CREATE OR REPLACE FUNCTION public.release_job_reservations(
  p_job_id  uuid,
  p_reason  text,
  p_line_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF current_app_role() IS NULL OR current_app_role() NOT IN ('owner', 'manager', 'dispatch', 'office') THEN
    RAISE EXCEPTION 'your role cannot release stock' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN (
       'rescheduled', 'cancelled', 'on_hold', 'unscheduled', 'removed',
       'plan_changed', 'completed', 'manual') THEN
    RAISE EXCEPTION 'invalid release reason %', p_reason USING ERRCODE = 'check_violation';
  END IF;

  WITH rel AS (
    UPDATE public.inventory_reservations
       SET status = 'released', released_reason = p_reason
     WHERE job_id = p_job_id
       AND status = 'active'
       AND (p_line_id IS NULL OR line_id = p_line_id)
    RETURNING line_id, qty
  ), per_line AS (
    SELECT line_id, SUM(qty) AS qty, COUNT(*) AS claims FROM rel GROUP BY line_id
  ), ev AS (
    INSERT INTO public.job_material_line_events
      (org_id, job_id, line_id, line_name, event_type, origin, from_qty, reason)
    SELECT l.org_id, l.job_id, l.id, l.name, 'released', 'system', p.qty, p_reason
    FROM per_line AS p
    JOIN public.job_material_lines AS l ON l.id = p.line_id
    RETURNING 1
  ), st AS (
    UPDATE public.job_material_lines AS l
       SET stage = 'planned'
      FROM per_line AS p
     WHERE l.id = p.line_id AND l.stage = 'reserved'
    RETURNING 1
  )
  SELECT COALESCE(SUM(claims), 0)::integer INTO v_count FROM per_line;

  RETURN v_count;
END;
$$;

-- reserve_job_materials: bring a job's claims in line with its plan. Idempotent.
--   p_reason   why claims are released when this call has to release them for a
--              date move ('rescheduled') or a plan edit ('plan_changed')
--   p_requeue  true for a date move: release first, then claim again, so the job
--              goes to the back of the queue (D8) but keeps stock nobody else took
-- A job holds stock only while its plan is confirmed, it is scheduled, and it is
-- Scheduled or In Progress. Otherwise every active claim is released and the
-- reason is derived from the job (cancelled, completed, on_hold, unscheduled).
-- Returns {released, reserved, lines: [{line_id, required, reserved, pulled}]}.
CREATE OR REPLACE FUNCTION public.reserve_job_materials(
  p_job_id   uuid,
  p_reason   text DEFAULT 'plan_changed',
  p_requeue  boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org          uuid;
  v_status       text;
  v_scheduled    date;
  v_deleted      timestamptz;
  v_plan_status  text;
  v_blocker      text;
  v_default_loc  uuid;
  v_loc          uuid;
  v_released     integer := 0;
  v_reserved     integer := 0;
  v_lines        jsonb := '[]'::jsonb;
  r              record;
  v_active       numeric;
  v_pulled       numeric;
  v_need         numeric;
  v_avail        numeric;
  v_take         numeric;
BEGIN
  IF current_app_role() IS NULL OR current_app_role() NOT IN ('owner', 'manager', 'dispatch', 'office') THEN
    RAISE EXCEPTION 'your role cannot reserve stock' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('rescheduled', 'plan_changed', 'manual') THEN
    RAISE EXCEPTION 'invalid reserve reason %', p_reason USING ERRCODE = 'check_violation';
  END IF;

  SELECT org_id, status, scheduled_for, deleted_at
    INTO v_org, v_status, v_scheduled, v_deleted
  FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job % not found', p_job_id USING ERRCODE = 'P0002';
  END IF;

  SELECT status INTO v_plan_status FROM public.job_material_plans WHERE job_id = p_job_id;

  v_blocker := CASE
    WHEN v_deleted IS NOT NULL OR v_status = 'Cancelled' THEN 'cancelled'
    WHEN v_status = 'Completed' THEN 'completed'
    WHEN v_status = 'On Hold' THEN 'on_hold'
    WHEN v_scheduled IS NULL THEN 'unscheduled'
    WHEN v_plan_status IS DISTINCT FROM 'confirmed' THEN 'plan_changed'
    ELSE NULL
  END;

  IF v_blocker IS NOT NULL THEN
    v_released := public.release_job_reservations(p_job_id, v_blocker);
    RETURN jsonb_build_object('released', v_released, 'reserved', 0, 'lines', '[]'::jsonb,
                              'holding', false, 'blocker', v_blocker);
  END IF;

  IF p_requeue THEN
    v_released := public.release_job_reservations(p_job_id, p_reason);
  END IF;

  -- Claims for lines that no longer qualify (optional, not stock, unlinked, or
  -- the catalog item stopped being stocked) are released.
  WITH keep AS (
    SELECT l.id
    FROM public.job_material_lines AS l
    JOIN public.catalog_items AS ci ON ci.id = l.catalog_item_id
    WHERE l.job_id = p_job_id AND NOT l.is_optional
      AND l.non_stock_reason IS NULL AND ci.is_stockable
  ), stale AS (
    SELECT DISTINCT r2.line_id
    FROM public.inventory_reservations AS r2
    WHERE r2.job_id = p_job_id AND r2.status = 'active'
      AND r2.line_id NOT IN (SELECT id FROM keep)
  )
  SELECT v_released + COALESCE(SUM(public.release_job_reservations(p_job_id, 'plan_changed', s.line_id)), 0)
    INTO v_released FROM stale AS s;

  -- Serialize on the items this job touches (sorted, so two jobs cannot deadlock).
  FOR r IN
    SELECT DISTINCT l.catalog_item_id AS item_id
    FROM public.job_material_lines AS l
    WHERE l.job_id = p_job_id AND l.catalog_item_id IS NOT NULL
    ORDER BY 1
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('loop.reserve:' || r.item_id::text, 0));
  END LOOP;

  v_default_loc := public.default_fulfil_location(v_org);

  FOR r IN
    SELECT l.id, l.catalog_item_id, l.quantity, l.fulfil_location_id, l.name
    FROM public.job_material_lines AS l
    JOIN public.catalog_items AS ci ON ci.id = l.catalog_item_id
    WHERE l.job_id = p_job_id AND NOT l.is_optional
      AND l.non_stock_reason IS NULL AND ci.is_stockable
    ORDER BY l.sort_order, l.created_at, l.id
  LOOP
    v_loc := COALESCE(r.fulfil_location_id, v_default_loc);

    SELECT COALESCE(SUM(qty) FILTER (WHERE status = 'active'), 0),
           COALESCE(SUM(qty) FILTER (WHERE status = 'pulled'), 0)
      INTO v_active, v_pulled
    FROM public.inventory_reservations WHERE line_id = r.id;

    -- Quantity went down, or the item / place changed: start this line over.
    IF v_active > GREATEST(r.quantity - v_pulled, 0)
       OR EXISTS (SELECT 1 FROM public.inventory_reservations
                  WHERE line_id = r.id AND status = 'active'
                    AND (item_id <> r.catalog_item_id OR location_id IS DISTINCT FROM v_loc)) THEN
      v_released := v_released + public.release_job_reservations(p_job_id, 'plan_changed', r.id);
      v_active := 0;
    END IF;

    v_need := GREATEST(r.quantity - v_pulled - v_active, 0);
    v_take := 0;

    IF v_need > 0 AND v_loc IS NOT NULL THEN
      SELECT COALESCE(a.available, 0) INTO v_avail
      FROM public.inventory_available AS a
      WHERE a.item_id = r.catalog_item_id AND a.location_id = v_loc;
      v_take := LEAST(v_need, GREATEST(COALESCE(v_avail, 0), 0));

      IF v_take > 0 THEN
        INSERT INTO public.inventory_reservations (org_id, job_id, line_id, item_id, location_id, qty)
        VALUES (v_org, p_job_id, r.id, r.catalog_item_id, v_loc, v_take);
        INSERT INTO public.job_material_line_events
          (org_id, job_id, line_id, line_name, event_type, origin, to_qty, detail)
        VALUES (v_org, p_job_id, r.id, r.name, 'reserved', 'system', v_take,
                jsonb_build_object('location_id', v_loc, 'required', r.quantity));
        v_reserved := v_reserved + 1;
      END IF;
    END IF;

    IF v_pulled = 0 THEN
      UPDATE public.job_material_lines
         SET stage = CASE WHEN v_active + v_take > 0 THEN 'reserved' ELSE 'planned' END
       WHERE id = r.id
         AND stage IS DISTINCT FROM CASE WHEN v_active + v_take > 0 THEN 'reserved' ELSE 'planned' END;
    END IF;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'line_id', r.id, 'required', r.quantity, 'reserved', v_active + v_take, 'pulled', v_pulled));
  END LOOP;

  RETURN jsonb_build_object('released', v_released, 'reserved', v_reserved, 'lines', v_lines,
                            'holding', true, 'blocker', NULL);
END;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.fn_inventory_reservations_stamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_inventory_reservations_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.default_fulfil_location(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_job_reservations(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reserve_job_materials(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.default_fulfil_location(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_job_reservations(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_job_materials(uuid, text, boolean) TO authenticated;
