-- =============================================================================
-- Migration — RMA / quarantine and refrigerant cylinders (Inventory Lane 3, M13)
-- Plan: docs/briefs/inventory-lane3-plan-2026-11-11.md (PR 5)
--
-- UP:
--   - refrigerant_log_entries.serial_unit_id   gets the same same-org foreign key the ledger
--                                              got in M10 (ON DELETE RESTRICT: the EPA log
--                                              outlives everything, so a cylinder that has
--                                              been logged against cannot be deleted)
--   - reconcile_job_materials                  REPLACED (copied from 20261126600000 with three
--                                              changes): each line may carry "cylinder_unit_id";
--                                              it is validated and written to the refrigerant
--                                              log entries of that line. The cylinder is the
--                                              container, the log stays by the pound against the
--                                              refrigerant SKU. Nothing else in it changes.
--   - fn_inventory_serial_unit_rma_guard       status moves into or out of quarantine, or to
--                                              returned_to_supplier, only go through
--                                              rma_serial_unit; the allowed moves are fixed
--   - rma_serial_unit(unit, action, location, note)   SECURITY DEFINER, owner / manager / office.
--                                              quarantine | return_to_supplier | repair | scrap,
--                                              with the ledger entries (quantity 1, serial_unit_id)
--                                              posted in the same transaction
--
-- A cylinder is a unit of a serialized catalog item with item_kind 'refrigerant'; the pounds
-- stay on the quantity-tracked refrigerant SKU (R-454B and R-410A remain separate SKUs).
-- Role posture is unchanged: ops read, owner / manager / office write units, delete owner only.
-- Techs never write units; closeout stays their path (reconcile_job_materials re-checks role).
-- All functions pin search_path. Nothing here changes existing rows.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   ALTER TABLE public.refrigerant_log_entries DROP CONSTRAINT IF EXISTS refrigerant_log_serial_unit_same_org_fkey;
--   DROP INDEX IF EXISTS public.refrigerant_log_entries_serial_unit_idx;
--   DROP TRIGGER IF EXISTS trg_inventory_serial_unit_rma_guard ON public.inventory_serial_units;
--   DROP FUNCTION IF EXISTS public.fn_inventory_serial_unit_rma_guard();
--   DROP FUNCTION IF EXISTS public.rma_serial_unit(uuid, text, uuid, text);
--   -- and restore reconcile_job_materials from 20261126600000_closeout_reconciliation.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Cylinder foreign key. All existing values are NULL ("no FK until that table exists").
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'refrigerant_log_serial_unit_same_org_fkey'
  ) THEN
    ALTER TABLE public.refrigerant_log_entries
      ADD CONSTRAINT refrigerant_log_serial_unit_same_org_fkey
      FOREIGN KEY (serial_unit_id, org_id)
      REFERENCES public.inventory_serial_units (id, org_id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS refrigerant_log_entries_serial_unit_idx
  ON public.refrigerant_log_entries (serial_unit_id);

-- ---------------------------------------------------------------------------
-- reconcile_job_materials — p_lines entries may add "cylinder_unit_id": uuid
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

  -- A cylinder can be named only on a refrigerant line, and must be a serialized refrigerant
  -- container (a unit of a serialized item_kind 'refrigerant' item) of this organization.
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_lines) AS x(line_id uuid, cylinder_unit_id uuid)
    WHERE x.cylinder_unit_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.job_material_lines AS l
        JOIN public.catalog_items AS li ON li.id = l.catalog_item_id
        JOIN public.inventory_serial_units AS cu ON cu.id = x.cylinder_unit_id AND cu.org_id = v_org
        JOIN public.catalog_items AS ci ON ci.id = cu.item_id
        WHERE l.id = x.line_id AND li.item_kind = 'refrigerant' AND li.tracking_mode = 'quantity'
          AND ci.item_kind = 'refrigerant' AND ci.tracking_mode = 'serialized'
          AND cu.status = 'in_stock'
      )
  ) THEN
    RAISE EXCEPTION 'a cylinder can only be named on a refrigerant line, and must be a refrigerant cylinder on hand'
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
           x.recovered, NULLIF(btrim(COALESCE(x.reason, '')), '') AS reason,
           x.cylinder_unit_id
    FROM public.job_material_lines AS l
    JOIN jsonb_to_recordset(p_lines) AS x(line_id uuid, used numeric, returned numeric, recovered numeric, reason text, cylinder_unit_id uuid)
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
        INSERT INTO public.refrigerant_log_entries (org_id, job_id, line_id, item_id, kind, lbs, serial_unit_id)
        VALUES (v_org, p_job_id, r.line_id, r.item_id, 'charged', round(r.used, 2), r.cylinder_unit_id);
      END IF;
      IF COALESCE(r.recovered, 0) > 0 THEN
        INSERT INTO public.refrigerant_log_entries (org_id, job_id, line_id, item_id, kind, lbs, serial_unit_id)
        VALUES (v_org, p_job_id, r.line_id, r.item_id, 'recovered', round(r.recovered, 2), r.cylinder_unit_id);
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

REVOKE ALL ON FUNCTION public.reconcile_job_materials(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_job_materials(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- RMA transitions. Moves into or out of quarantine, and to returned_to_supplier, are made
-- only by rma_serial_unit (it sets loop.rma for its own transaction). Allowed moves:
--   in_stock   -> installed, quarantine
--   installed  -> quarantine, scrapped          (scrapped here = the detached-unit write-off)
--   quarantine -> in_stock, returned_to_supplier, scrapped
--   returned_to_supplier, scrapped: final
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_inventory_serial_unit_rma_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('returned_to_supplier', 'scrapped') THEN
    RAISE EXCEPTION 'a unit that was % cannot change status', replace(OLD.status, '_', ' ')
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT (
    (OLD.status = 'in_stock'   AND NEW.status IN ('installed', 'quarantine'))
    OR (OLD.status = 'installed'  AND NEW.status IN ('quarantine', 'scrapped'))
    OR (OLD.status = 'quarantine' AND NEW.status IN ('in_stock', 'returned_to_supplier', 'scrapped'))
  ) THEN
    RAISE EXCEPTION 'a unit cannot go from % to %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF (NEW.status IN ('quarantine', 'returned_to_supplier') OR OLD.status = 'quarantine')
     AND COALESCE(current_setting('loop.rma', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'use the RMA flow to quarantine, repair, return or scrap a unit'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_serial_unit_rma_guard ON public.inventory_serial_units;
CREATE TRIGGER trg_inventory_serial_unit_rma_guard
  BEFORE UPDATE OF status ON public.inventory_serial_units
  FOR EACH ROW EXECUTE FUNCTION public.fn_inventory_serial_unit_rma_guard();

-- ---------------------------------------------------------------------------
-- rma_serial_unit
--   quarantine          in_stock or installed -> quarantine. p_location_id (a quarantine
--                       location) or the org's first active one; if the org has none, a
--                       location named "Quarantine" is created. An installed unit is taken off
--                       its system (the system keeps its warranty; its serial list follows the
--                       unit through the existing trigger) and any material-line pick is released.
--   return_to_supplier  quarantine -> returned_to_supplier (leaves stock)
--   scrap               quarantine -> scrapped (leaves stock)
--   repair              quarantine -> in_stock at p_location_id (a non-quarantine location)
-- A unit of a stockable item also gets its ledger entries (quantity 1, serial_unit_id) so
-- on-hand by location stays true. p_note is carried in the entry reason.
-- Returns the unit id and its new status.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rma_serial_unit(
  p_unit_id uuid,
  p_action text,
  p_location_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     text := current_app_role();
  v_uid      uuid := auth.uid();
  v_org      uuid := current_org_id();
  u          public.inventory_serial_units%ROWTYPE;
  v_stock    boolean := false;
  v_quar     uuid;
  v_dest     uuid;
  v_dest_type text;
  v_group    uuid;
  v_note     text := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_reason   text;
BEGIN
  IF v_uid IS NULL OR v_role IS NULL OR v_role NOT IN ('owner', 'manager', 'office') THEN
    RAISE EXCEPTION 'your role cannot run an RMA' USING ERRCODE = '42501';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('quarantine', 'return_to_supplier', 'repair', 'scrap') THEN
    RAISE EXCEPTION 'action must be quarantine, return_to_supplier, repair or scrap'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO u FROM public.inventory_serial_units
  WHERE id = p_unit_id AND org_id = v_org
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'serial unit % not found', p_unit_id USING ERRCODE = 'P0002';
  END IF;

  IF u.item_id IS NOT NULL THEN
    SELECT is_stockable INTO v_stock FROM public.catalog_items WHERE id = u.item_id AND org_id = v_org;
    v_stock := COALESCE(v_stock, false);
  END IF;

  PERFORM set_config('loop.rma', 'on', true);

  IF p_action = 'quarantine' THEN
    IF u.status NOT IN ('in_stock', 'installed') THEN
      RAISE EXCEPTION 'only a unit in stock or installed can be quarantined (this one is %)', u.status
        USING ERRCODE = 'check_violation';
    END IF;
    IF u.needs_review THEN
      RAISE EXCEPTION 'resolve this unit''s duplicate serial in the review queue first'
        USING ERRCODE = 'check_violation';
    END IF;

    IF p_location_id IS NOT NULL THEN
      SELECT id INTO v_quar FROM public.inventory_locations
      WHERE id = p_location_id AND org_id = v_org AND type = 'quarantine' AND is_active;
      IF v_quar IS NULL THEN
        RAISE EXCEPTION 'choose an active quarantine location' USING ERRCODE = 'check_violation';
      END IF;
    ELSE
      SELECT id INTO v_quar FROM public.inventory_locations
      WHERE org_id = v_org AND type = 'quarantine' AND is_active
      ORDER BY created_at, id LIMIT 1;
      IF v_quar IS NULL THEN
        INSERT INTO public.inventory_locations (org_id, type, name)
        VALUES (v_org, 'quarantine',
                CASE WHEN EXISTS (SELECT 1 FROM public.inventory_locations
                                  WHERE org_id = v_org AND lower(name) = 'quarantine')
                     THEN 'Quarantine · RMA' ELSE 'Quarantine' END)
        RETURNING id INTO v_quar;
      END IF;
    END IF;

    v_reason := 'RMA: quarantined' || COALESCE(' · ' || v_note, '');
    IF v_stock THEN
      IF u.status = 'in_stock' AND u.location_id IS NOT NULL THEN
        v_group := gen_random_uuid();
        INSERT INTO public.inventory_transactions
          (org_id, txn_type, item_id, location_id, qty_delta, transfer_group_id, reason, serial_unit_id, created_by)
        VALUES
          (v_org, 'transfer_out', u.item_id, u.location_id, -1, v_group, v_reason, u.id, v_uid),
          (v_org, 'transfer_in',  u.item_id, v_quar,         1, v_group, v_reason, u.id, v_uid);
      ELSIF u.status = 'installed' THEN
        INSERT INTO public.inventory_transactions
          (org_id, txn_type, item_id, location_id, qty_delta, reason, serial_unit_id, created_by)
        VALUES (v_org, 'receive', u.item_id, v_quar, 1, 'RMA return from a system' || COALESCE(' · ' || v_note, ''), u.id, v_uid);
      END IF;
    END IF;

    -- A unit in quarantine is not available for a job.
    DELETE FROM public.job_material_line_serials WHERE serial_unit_id = u.id AND org_id = v_org;

    UPDATE public.inventory_serial_units
       SET status = 'quarantine', location_id = v_quar, installed_system_id = NULL
     WHERE id = u.id;

  ELSE
    IF u.status <> 'quarantine' THEN
      RAISE EXCEPTION 'only a quarantined unit can be %',
        CASE p_action WHEN 'return_to_supplier' THEN 'returned to the supplier'
                      WHEN 'repair' THEN 'repaired' ELSE 'scrapped' END
        USING ERRCODE = 'check_violation';
    END IF;

    IF p_action = 'repair' THEN
      SELECT id, type INTO v_dest, v_dest_type FROM public.inventory_locations
      WHERE id = p_location_id AND org_id = v_org AND is_active;
      IF v_dest IS NULL OR v_dest_type = 'quarantine' THEN
        RAISE EXCEPTION 'choose the location the repaired unit goes back to' USING ERRCODE = 'check_violation';
      END IF;
      IF u.item_id IS NULL THEN
        RAISE EXCEPTION 'this unit has no catalog item, so it cannot go back into stock'
          USING ERRCODE = 'check_violation';
      END IF;
      v_reason := 'RMA: repaired, back in stock' || COALESCE(' · ' || v_note, '');
      IF v_stock AND u.location_id IS NOT NULL THEN
        v_group := gen_random_uuid();
        INSERT INTO public.inventory_transactions
          (org_id, txn_type, item_id, location_id, qty_delta, transfer_group_id, reason, serial_unit_id, created_by)
        VALUES
          (v_org, 'transfer_out', u.item_id, u.location_id, -1, v_group, v_reason, u.id, v_uid),
          (v_org, 'transfer_in',  u.item_id, v_dest,         1, v_group, v_reason, u.id, v_uid);
      END IF;
      UPDATE public.inventory_serial_units SET status = 'in_stock', location_id = v_dest WHERE id = u.id;

    ELSE
      v_reason := CASE p_action
                    WHEN 'return_to_supplier' THEN 'RMA: returned to supplier'
                    ELSE 'RMA: scrapped' END || COALESCE(' · ' || v_note, '');
      IF v_stock AND u.location_id IS NOT NULL THEN
        INSERT INTO public.inventory_transactions
          (org_id, txn_type, item_id, location_id, qty_delta, reason, serial_unit_id, created_by)
        VALUES (v_org, 'adjust', u.item_id, u.location_id, -1, v_reason, u.id, v_uid);
      END IF;
      UPDATE public.inventory_serial_units
         SET status = CASE p_action WHEN 'return_to_supplier' THEN 'returned_to_supplier' ELSE 'scrapped' END,
             location_id = NULL
       WHERE id = u.id;
    END IF;
  END IF;

  PERFORM set_config('loop.rma', 'off', true);

  RETURN jsonb_build_object(
    'unit_id', u.id,
    'status', (SELECT status FROM public.inventory_serial_units WHERE id = u.id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_inventory_serial_unit_rma_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rma_serial_unit(uuid, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rma_serial_unit(uuid, text, uuid, text) TO authenticated;
