-- =============================================================================
-- Inventory Lane 4 (M7) — closeout reconciliation and the refrigerant log
--
--   - job_material_lines   ADDITIVE: used_qty, returned_qty, recovered_qty, variance_reason.
--                          Tech guard: techs may fill these on assigned jobs, but a reconciled
--                          line is frozen for them.
--   - job_material_reconciliations   one row per job: 'submitted' (written only by
--                          reconcile_job_materials) or 'overridden' (office roles, soft stage).
--                          Insert-only.
--   - refrigerant_log_entries   append-only EPA log. Written only by reconcile_job_materials
--                          in this migration; no direct INSERT grant.
--   - reconcile_job_materials(job, lines)   SECURITY DEFINER. Posts, in one transaction:
--                          issue_to_job for used, a pallet -> shop transfer for returned, and an
--                          explicit `adjust` (with the stated reason) for any residual, so the
--                          job's pallet ends at zero. Then marks reservations consumed/released,
--                          lines 'reconciled', and writes the reconciliation row.
--                          Definer because an assigned tech may reconcile but cannot write the
--                          ledger directly; the function re-checks role, org and assignment.
--   - override_material_reconciliation(job, reason)   SECURITY INVOKER, owner/manager/office.
--
-- Nothing here is seeded. Expand-only: no existing column, constraint or policy is dropped.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP FUNCTION IF EXISTS public.override_material_reconciliation(uuid, text);
--   DROP FUNCTION IF EXISTS public.reconcile_job_materials(uuid, jsonb);
--   DROP TABLE IF EXISTS public.refrigerant_log_entries;
--   DROP TABLE IF EXISTS public.job_material_reconciliations;
--   DROP FUNCTION IF EXISTS public.fn_reconciliation_stamp();
--   DROP FUNCTION IF EXISTS public.fn_refrigerant_log_stamp();
--   ALTER TABLE public.job_material_lines
--     DROP COLUMN IF EXISTS used_qty, DROP COLUMN IF EXISTS returned_qty,
--     DROP COLUMN IF EXISTS recovered_qty, DROP COLUMN IF EXISTS variance_reason;
--   -- and re-create guard_tech_job_material_update() from 20261126200000.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- job_material_lines — reconciliation columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.job_material_lines
  ADD COLUMN IF NOT EXISTS used_qty       numeric(12, 3) CHECK (used_qty IS NULL OR used_qty >= 0),
  ADD COLUMN IF NOT EXISTS returned_qty   numeric(12, 3) CHECK (returned_qty IS NULL OR returned_qty >= 0),
  ADD COLUMN IF NOT EXISTS recovered_qty  numeric(12, 3) CHECK (recovered_qty IS NULL OR recovered_qty >= 0),
  ADD COLUMN IF NOT EXISTS variance_reason text CHECK (variance_reason IS NULL OR char_length(variance_reason) <= 500);

-- Tech guard (extends 20261126200000): the reconciliation columns are now open to techs on
-- assigned jobs (RLS already limits them to those), but only until the line is reconciled, and
-- only reconcile_job_materials (which sets loop.reconcile for its own transaction) moves the stage.
CREATE OR REPLACE FUNCTION public.guard_tech_job_material_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_app_role() IS DISTINCT FROM 'tech' THEN
    RETURN NEW;
  END IF;

  IF current_setting('loop.reconcile', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF OLD.stage = 'reconciled' THEN
    RAISE EXCEPTION 'This material has been reconciled and can no longer be changed by a technician'
      USING ERRCODE = '42501';
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
    RAISE EXCEPTION 'Technicians can only change a material''s state, quantity and reconciliation numbers'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- job_material_reconciliations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_material_reconciliations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id                 uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  status                 text NOT NULL CHECK (status IN ('submitted', 'overridden')),
  enforcement_at_submit  text NOT NULL CHECK (enforcement_at_submit IN ('warn', 'soft', 'hard')),
  lines_total            integer NOT NULL DEFAULT 0 CHECK (lines_total >= 0),
  lines_with_variance    integer NOT NULL DEFAULT 0 CHECK (lines_with_variance >= 0),
  submitted_by           uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  submitted_at           timestamptz,
  override_reason        text CHECK (override_reason IS NULL OR char_length(btrim(override_reason)) BETWEEN 1 AND 1000),
  override_by            uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  override_at            timestamptz,
  CONSTRAINT job_material_reconciliations_job_key UNIQUE (job_id),
  CONSTRAINT job_material_reconciliations_shape CHECK (
    (status = 'submitted' AND submitted_at IS NOT NULL)
    OR (status = 'overridden' AND override_reason IS NOT NULL AND override_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS job_material_reconciliations_org_idx
  ON public.job_material_reconciliations (org_id, status);
CREATE INDEX IF NOT EXISTS job_material_reconciliations_submitted_by_idx
  ON public.job_material_reconciliations (submitted_by);
CREATE INDEX IF NOT EXISTS job_material_reconciliations_override_by_idx
  ON public.job_material_reconciliations (override_by);

-- Who and when come from the session; the enforcement stage is read from the org's settings.
CREATE OR REPLACE FUNCTION public.fn_reconciliation_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'submitted' THEN
    NEW.submitted_by := auth.uid();
    NEW.submitted_at := now();
    NEW.override_reason := NULL;
    NEW.override_by := NULL;
    NEW.override_at := NULL;
  ELSE
    NEW.submitted_by := NULL;
    NEW.submitted_at := NULL;
    NEW.override_by := auth.uid();
    NEW.override_at := now();
  END IF;
  NEW.enforcement_at_submit := COALESCE(
    (SELECT s.closeout_enforcement FROM public.inventory_settings AS s WHERE s.org_id = NEW.org_id),
    'warn');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconciliation_stamp ON public.job_material_reconciliations;
CREATE TRIGGER trg_reconciliation_stamp
  BEFORE INSERT ON public.job_material_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.fn_reconciliation_stamp();

DROP TRIGGER IF EXISTS trg_reconciliation_guard ON public.job_material_reconciliations;
CREATE TRIGGER trg_reconciliation_guard
  BEFORE UPDATE OR DELETE ON public.job_material_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.fn_material_metrics_guard();

-- ---------------------------------------------------------------------------
-- refrigerant_log_entries — append-only EPA log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.refrigerant_log_entries (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id               uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  line_id              uuid,   -- no FK: the record outlives a removed line
  item_id              uuid NOT NULL,
  kind                 text NOT NULL CHECK (kind IN ('charged', 'added', 'recovered')),
  lbs                  numeric(8, 2) NOT NULL CHECK (lbs > 0),
  installed_system_id  uuid,   -- soft reference, not used yet
  serial_unit_id       uuid,   -- cylinder (Lane 3); no FK until that table exists
  logged_by            uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  logged_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refrigerant_log_item_same_org_fkey
    FOREIGN KEY (item_id, org_id) REFERENCES public.catalog_items (id, org_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS refrigerant_log_entries_job_idx
  ON public.refrigerant_log_entries (job_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS refrigerant_log_entries_item_idx
  ON public.refrigerant_log_entries (item_id);
CREATE INDEX IF NOT EXISTS refrigerant_log_entries_logged_by_idx
  ON public.refrigerant_log_entries (logged_by);

CREATE OR REPLACE FUNCTION public.fn_refrigerant_log_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.logged_by := auth.uid();
  NEW.logged_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refrigerant_log_stamp ON public.refrigerant_log_entries;
CREATE TRIGGER trg_refrigerant_log_stamp
  BEFORE INSERT ON public.refrigerant_log_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_refrigerant_log_stamp();

DROP TRIGGER IF EXISTS trg_refrigerant_log_guard ON public.refrigerant_log_entries;
CREATE TRIGGER trg_refrigerant_log_guard
  BEFORE UPDATE OR DELETE ON public.refrigerant_log_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_material_metrics_guard();

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.job_material_reconciliations FROM anon;
REVOKE ALL ON public.job_material_reconciliations FROM authenticated;
GRANT SELECT, INSERT ON public.job_material_reconciliations TO authenticated;
REVOKE ALL ON public.refrigerant_log_entries FROM anon;
REVOKE ALL ON public.refrigerant_log_entries FROM authenticated;
GRANT SELECT ON public.refrigerant_log_entries TO authenticated;

ALTER TABLE public.job_material_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_material_reconciliations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.refrigerant_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refrigerant_log_entries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_material_reconciliations: read for office roles" ON public.job_material_reconciliations;
CREATE POLICY "job_material_reconciliations: read for office roles"
  ON public.job_material_reconciliations FOR SELECT TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
         AND org_id = (select current_org_id()));

DROP POLICY IF EXISTS "job_material_reconciliations: tech reads assigned jobs" ON public.job_material_reconciliations;
CREATE POLICY "job_material_reconciliations: tech reads assigned jobs"
  ON public.job_material_reconciliations FOR SELECT TO authenticated
  USING ((select current_app_role()) = 'tech'
         AND org_id = (select current_org_id())
         AND private.caller_is_assigned_to_job(job_id));

-- Direct inserts are overrides only; 'submitted' rows come from reconcile_job_materials.
DROP POLICY IF EXISTS "job_material_reconciliations: office override" ON public.job_material_reconciliations;
CREATE POLICY "job_material_reconciliations: office override"
  ON public.job_material_reconciliations FOR INSERT TO authenticated
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'office')
              AND org_id = (select current_org_id())
              AND status = 'overridden'
              AND EXISTS (SELECT 1 FROM public.jobs AS j
                          WHERE j.id = job_material_reconciliations.job_id
                            AND j.org_id = (select current_org_id())));

DROP POLICY IF EXISTS "refrigerant_log_entries: read for office roles" ON public.refrigerant_log_entries;
CREATE POLICY "refrigerant_log_entries: read for office roles"
  ON public.refrigerant_log_entries FOR SELECT TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
         AND org_id = (select current_org_id()));

DROP POLICY IF EXISTS "refrigerant_log_entries: tech reads assigned jobs" ON public.refrigerant_log_entries;
CREATE POLICY "refrigerant_log_entries: tech reads assigned jobs"
  ON public.refrigerant_log_entries FOR SELECT TO authenticated
  USING ((select current_app_role()) = 'tech'
         AND org_id = (select current_org_id())
         AND private.caller_is_assigned_to_job(job_id));

REVOKE EXECUTE ON FUNCTION public.fn_reconciliation_stamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_refrigerant_log_stamp() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- override_material_reconciliation: an office role completes a job without reconciling it
-- (soft stage). Records who and why; the service also writes a job_activity row.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.override_material_reconciliation(p_job_id uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_id  uuid;
BEGIN
  IF current_app_role() IS NULL OR current_app_role() NOT IN ('owner', 'manager', 'office') THEN
    RAISE EXCEPTION 'only the office can override material reconciliation' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'an override needs a reason' USING ERRCODE = 'check_violation';
  END IF;

  SELECT org_id INTO v_org FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND OR v_org IS DISTINCT FROM current_org_id() THEN
    RAISE EXCEPTION 'job % not found', p_job_id USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.job_material_reconciliations (org_id, job_id, status, override_reason)
  VALUES (v_org, p_job_id, 'overridden', btrim(p_reason))
  ON CONFLICT (job_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'materials were already reconciled or overridden for this job'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- reconcile_job_materials
--   p_lines: [{"line_id": uuid, "used": n, "returned": n, "recovered": n?, "reason": text?}]
--   Every catalog-linked, non-optional line of the job must be listed. For each line:
--     pulled   = quantity of its 'pulled' reservations (on the pallet)
--     residual = pulled - used - returned
--   A non-zero residual needs a reason (over-pull, damaged, left on site, ...); a line that was
--   never pulled and was used anyway (bought on the way) gets "Not pulled from the shop" by
--   default. The residual is posted as an `adjust` on the pallet so it ends at zero.
--   Items that are not stockable keep the numbers but post nothing to the ledger.
-- Returns {lines, variance_lines, shop_location_id}.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reconcile_job_materials(p_job_id uuid, p_lines jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     text := current_app_role();
  v_uid      uuid := auth.uid();
  v_org      uuid;
  v_status   text;
  v_deleted  timestamptz;
  v_number   text;
  v_pallet   uuid;
  v_shop     uuid;
  v_name     text;
  v_group    uuid;
  v_pulled   numeric;
  v_residual numeric;
  v_reason   text;
  v_stock    boolean;
  v_kind     text;
  v_count    integer := 0;
  v_variance integer := 0;
  r          record;
BEGIN
  IF v_uid IS NULL OR v_role IS NULL OR v_role NOT IN ('owner', 'manager', 'office', 'tech') THEN
    RAISE EXCEPTION 'your role cannot reconcile materials' USING ERRCODE = '42501';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'send the used and returned quantities for each material line'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT org_id, status, deleted_at, job_number INTO v_org, v_status, v_deleted, v_number
  FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND OR v_org IS DISTINCT FROM current_org_id() THEN
    RAISE EXCEPTION 'job % not found', p_job_id USING ERRCODE = 'P0002';
  END IF;
  IF v_role = 'tech' AND NOT private.caller_is_assigned_to_job(p_job_id) THEN
    RAISE EXCEPTION 'you are not assigned to this job' USING ERRCODE = '42501';
  END IF;
  IF v_deleted IS NOT NULL OR v_status = 'Cancelled' THEN
    RAISE EXCEPTION 'a cancelled or deleted job cannot be reconciled' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('loop.reconcile:' || p_job_id::text, 0));

  IF EXISTS (SELECT 1 FROM public.job_material_reconciliations WHERE job_id = p_job_id) THEN
    RAISE EXCEPTION 'materials were already reconciled or overridden for this job'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Input validation ---------------------------------------------------------
  IF (SELECT count(*) <> count(DISTINCT x.line_id) FROM jsonb_to_recordset(p_lines) AS x(line_id uuid)) THEN
    RAISE EXCEPTION 'each line can be listed only once' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_lines) AS x(line_id uuid, used numeric, returned numeric, recovered numeric)
    WHERE x.line_id IS NULL OR COALESCE(x.used, 0) < 0 OR COALESCE(x.returned, 0) < 0 OR COALESCE(x.recovered, 0) < 0
  ) THEN
    RAISE EXCEPTION 'quantities cannot be negative' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_lines) AS x(line_id uuid)
    WHERE NOT EXISTS (SELECT 1 FROM public.job_material_lines AS l
                      WHERE l.id = x.line_id AND l.job_id = p_job_id AND l.org_id = v_org
                        AND l.catalog_item_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'a listed line does not belong to this job or has no catalog item'
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.job_material_lines AS l
    WHERE l.job_id = p_job_id AND l.org_id = v_org AND l.catalog_item_id IS NOT NULL
      AND NOT l.is_optional AND l.stage <> 'reconciled'
      AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(p_lines) AS x(line_id uuid) WHERE x.line_id = l.id)
  ) THEN
    RAISE EXCEPTION 'every material line needs a used and returned quantity'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Serialize with pulls and reservations on the same items (sorted: no lock-order cycles).
  FOR r IN
    SELECT DISTINCT l.catalog_item_id AS item_id
    FROM public.job_material_lines AS l
    JOIN jsonb_to_recordset(p_lines) AS x(line_id uuid) ON x.line_id = l.id
    ORDER BY 1
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('loop.reserve:' || r.item_id::text, 0));
  END LOOP;

  PERFORM set_config('loop.reconcile', 'on', true);

  SELECT id INTO v_pallet FROM public.inventory_locations WHERE job_id = p_job_id AND type = 'job';
  v_shop := public.default_fulfil_location(v_org);

  FOR r IN
    SELECT l.id AS line_id, l.name, l.catalog_item_id AS item_id,
           COALESCE(x.used, 0) AS used, COALESCE(x.returned, 0) AS returned,
           x.recovered, NULLIF(btrim(COALESCE(x.reason, '')), '') AS reason
    FROM public.job_material_lines AS l
    JOIN jsonb_to_recordset(p_lines) AS x(line_id uuid, used numeric, returned numeric, recovered numeric, reason text)
      ON x.line_id = l.id
    WHERE l.stage <> 'reconciled'
    ORDER BY l.catalog_item_id, l.id
  LOOP
    SELECT is_stockable, item_kind INTO v_stock, v_kind FROM public.catalog_items WHERE id = r.item_id;
    SELECT COALESCE(SUM(qty), 0) INTO v_pulled
    FROM public.inventory_reservations WHERE line_id = r.line_id AND status = 'pulled';

    v_residual := v_pulled - r.used - r.returned;
    v_reason := r.reason;
    IF v_residual <> 0 AND v_reason IS NULL THEN
      IF v_pulled = 0 THEN
        v_reason := 'Not pulled from the shop';
      ELSE
        RAISE EXCEPTION 'a reason is needed for "%": % pulled, % used, % returned',
          r.name, v_pulled, r.used, r.returned USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    IF v_residual <> 0 THEN
      v_variance := v_variance + 1;
    END IF;

    IF v_stock THEN
      IF r.returned > 0 AND v_shop IS NULL THEN
        RAISE EXCEPTION 'there is no shop location to return "%" to', r.name USING ERRCODE = 'check_violation';
      END IF;

      IF v_pallet IS NULL AND (r.used > 0 OR r.returned > 0 OR v_residual <> 0) THEN
        v_name := 'Pallet · ' || COALESCE(NULLIF(btrim(v_number), ''), left(p_job_id::text, 8));
        IF EXISTS (SELECT 1 FROM public.inventory_locations WHERE org_id = v_org AND lower(name) = lower(v_name)) THEN
          v_name := v_name || ' · ' || left(p_job_id::text, 4);
        END IF;
        INSERT INTO public.inventory_locations (org_id, type, name, job_id)
        VALUES (v_org, 'job', v_name, p_job_id)
        ON CONFLICT (job_id) WHERE type = 'job' DO NOTHING
        RETURNING id INTO v_pallet;
        IF v_pallet IS NULL THEN
          SELECT id INTO v_pallet FROM public.inventory_locations WHERE job_id = p_job_id AND type = 'job';
        END IF;
      END IF;

      IF r.used > 0 THEN
        INSERT INTO public.inventory_transactions
          (org_id, txn_type, item_id, location_id, qty_delta, job_id, material_line_id, reason, created_by)
        VALUES (v_org, 'issue_to_job', r.item_id, v_pallet, -r.used, p_job_id, r.line_id, 'Used on job', v_uid);
      END IF;

      IF r.returned > 0 THEN
        v_group := gen_random_uuid();
        INSERT INTO public.inventory_transactions
          (org_id, txn_type, item_id, location_id, qty_delta, job_id, material_line_id,
           transfer_group_id, reason, created_by)
        VALUES
          (v_org, 'transfer_out', r.item_id, v_pallet, -r.returned, p_job_id, r.line_id, v_group, 'Returned at closeout', v_uid),
          (v_org, 'transfer_in',  r.item_id, v_shop,    r.returned, p_job_id, r.line_id, v_group, 'Returned at closeout', v_uid);
      END IF;

      IF v_residual <> 0 THEN
        INSERT INTO public.inventory_transactions
          (org_id, txn_type, item_id, location_id, qty_delta, job_id, material_line_id, reason, created_by)
        VALUES (v_org, 'adjust', r.item_id, v_pallet, -v_residual, p_job_id, r.line_id,
                'Closeout: ' || v_reason, v_uid);
      END IF;
    END IF;

    IF v_kind = 'refrigerant' THEN
      IF r.used > 0 THEN
        INSERT INTO public.refrigerant_log_entries (org_id, job_id, line_id, item_id, kind, lbs)
        VALUES (v_org, p_job_id, r.line_id, r.item_id, 'charged', round(r.used, 2));
      END IF;
      IF COALESCE(r.recovered, 0) > 0 THEN
        INSERT INTO public.refrigerant_log_entries (org_id, job_id, line_id, item_id, kind, lbs)
        VALUES (v_org, p_job_id, r.line_id, r.item_id, 'recovered', round(r.recovered, 2));
      END IF;
    END IF;

    UPDATE public.job_material_lines
       SET used_qty = r.used,
           returned_qty = r.returned,
           recovered_qty = r.recovered,
           variance_reason = v_reason,
           stage = 'reconciled',
           state = 'used'
     WHERE id = r.line_id;

    INSERT INTO public.job_material_line_events (org_id, job_id, line_id, line_name, event_type, origin, to_qty, detail)
    VALUES (v_org, p_job_id, r.line_id, r.name, 'used', 'user', r.used,
            jsonb_build_object('pulled', v_pulled, 'returned', r.returned, 'variance', v_residual));
    IF r.returned > 0 THEN
      INSERT INTO public.job_material_line_events (org_id, job_id, line_id, line_name, event_type, origin, to_qty)
      VALUES (v_org, p_job_id, r.line_id, r.name, 'returned', 'user', r.returned);
    END IF;

    v_count := v_count + 1;
  END LOOP;

  UPDATE public.inventory_reservations SET status = 'consumed'
   WHERE job_id = p_job_id AND status = 'pulled';
  UPDATE public.inventory_reservations SET status = 'released', released_reason = 'completed'
   WHERE job_id = p_job_id AND status = 'active';

  INSERT INTO public.job_material_reconciliations (org_id, job_id, status, lines_total, lines_with_variance)
  VALUES (v_org, p_job_id, 'submitted', v_count, v_variance);

  RETURN jsonb_build_object('lines', v_count, 'variance_lines', v_variance, 'shop_location_id', v_shop);
END;
$$;

REVOKE ALL ON FUNCTION public.override_material_reconciliation(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reconcile_job_materials(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.override_material_reconciliation(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_job_materials(uuid, jsonb) TO authenticated;
