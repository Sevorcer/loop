-- =============================================================================
-- Migration — Expected arrivals (Inventory Lane 4, PR C, M4)
-- Plan: docs/briefs/inventory-lane4-plan-2026-11-05.md §2.9, §3.4 (D1)
--
-- UP (expand-only):
--   - inventory_expected_arrivals   what is on its way: item, qty, ETA, optional
--                                   job it is for. The Lane 4 on-order source until
--                                   Lane 5 purchasing exists (po_line_id is reserved,
--                                   no FK). No vendor, PO, price or invoice fields.
--   - receive_expected_arrival()    marks an arrival received by posting a normal
--                                   ledger `receive`, so stock stays single-source
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP FUNCTION IF EXISTS public.receive_expected_arrival(uuid);
--   DROP TABLE IF EXISTS public.inventory_expected_arrivals;
--   DROP FUNCTION IF EXISTS public.fn_expected_arrivals_stamp();
--   DROP FUNCTION IF EXISTS public.fn_expected_arrivals_guard();
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_expected_arrivals (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id                 uuid NOT NULL,
  location_id             uuid NOT NULL,
  qty                     numeric(12, 3) NOT NULL CHECK (qty > 0),
  eta_date                date NOT NULL,
  status                  text NOT NULL DEFAULT 'expected'
                            CHECK (status IN ('expected', 'received', 'cancelled')),
  for_job_id              uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  supplier_note           text CHECK (supplier_note IS NULL OR char_length(supplier_note) <= 500),
  po_line_id              uuid,   -- reserved for Lane 5; deliberately no FK
  receipt_transaction_id  uuid UNIQUE REFERENCES public.inventory_transactions(id) ON DELETE RESTRICT,
  created_by              uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_by              uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_expected_arrivals_item_same_org_fkey
    FOREIGN KEY (item_id, org_id) REFERENCES public.catalog_items (id, org_id) ON DELETE RESTRICT,
  CONSTRAINT inventory_expected_arrivals_location_same_org_fkey
    FOREIGN KEY (location_id, org_id) REFERENCES public.inventory_locations (id, org_id) ON DELETE RESTRICT,
  CONSTRAINT inventory_expected_arrivals_received_has_receipt
    CHECK ((status = 'received') = (receipt_transaction_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS inventory_expected_arrivals_open_idx
  ON public.inventory_expected_arrivals (org_id, item_id, eta_date) WHERE status = 'expected';
CREATE INDEX IF NOT EXISTS inventory_expected_arrivals_location_idx
  ON public.inventory_expected_arrivals (location_id);
CREATE INDEX IF NOT EXISTS inventory_expected_arrivals_for_job_idx
  ON public.inventory_expected_arrivals (for_job_id) WHERE for_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_expected_arrivals_created_by_idx
  ON public.inventory_expected_arrivals (created_by);
CREATE INDEX IF NOT EXISTS inventory_expected_arrivals_updated_by_idx
  ON public.inventory_expected_arrivals (updated_by);

CREATE OR REPLACE FUNCTION public.fn_expected_arrivals_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_loc_type text;
  v_job_org  uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status                 := 'expected';
    NEW.receipt_transaction_id := NULL;
    NEW.created_by             := auth.uid();
    NEW.created_at             := now();
  END IF;
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();

  SELECT type INTO v_loc_type FROM public.inventory_locations WHERE id = NEW.location_id;
  IF NOT FOUND OR v_loc_type <> 'warehouse' THEN
    RAISE EXCEPTION 'stock can only be expected at a warehouse' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.for_job_id IS NOT NULL THEN
    SELECT org_id INTO v_job_org FROM public.jobs WHERE id = NEW.for_job_id;
    IF NOT FOUND OR v_job_org <> NEW.org_id THEN
      RAISE EXCEPTION 'the job belongs to another company' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expected_arrivals_stamp ON public.inventory_expected_arrivals;
CREATE TRIGGER trg_expected_arrivals_stamp
  BEFORE INSERT OR UPDATE ON public.inventory_expected_arrivals
  FOR EACH ROW EXECUTE FUNCTION public.fn_expected_arrivals_stamp();

-- Received and cancelled rows are history. Open rows can change qty, ETA, job and note.
CREATE OR REPLACE FUNCTION public.fn_expected_arrivals_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status <> 'expected' THEN
    RAISE EXCEPTION 'a % arrival cannot be changed', OLD.status USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.org_id      IS DISTINCT FROM OLD.org_id
     OR NEW.item_id     IS DISTINCT FROM OLD.item_id
     OR NEW.location_id IS DISTINCT FROM OLD.location_id
     OR NEW.created_by  IS DISTINCT FROM OLD.created_by
     OR NEW.po_line_id  IS DISTINCT FROM OLD.po_line_id
  THEN
    RAISE EXCEPTION 'an arrival''s item and place cannot change; cancel it and add a new one'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expected_arrivals_guard ON public.inventory_expected_arrivals;
CREATE TRIGGER trg_expected_arrivals_guard
  BEFORE UPDATE ON public.inventory_expected_arrivals
  FOR EACH ROW EXECUTE FUNCTION public.fn_expected_arrivals_guard();

-- RLS ------------------------------------------------------------------------

REVOKE ALL ON public.inventory_expected_arrivals FROM anon;
REVOKE ALL ON public.inventory_expected_arrivals FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_expected_arrivals TO authenticated;

ALTER TABLE public.inventory_expected_arrivals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_expected_arrivals FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_expected_arrivals: read for office roles" ON public.inventory_expected_arrivals;
CREATE POLICY "inventory_expected_arrivals: read for office roles"
  ON public.inventory_expected_arrivals FOR SELECT TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
         AND org_id = (select current_org_id()));

DROP POLICY IF EXISTS "inventory_expected_arrivals: insert for owner/manager/office" ON public.inventory_expected_arrivals;
CREATE POLICY "inventory_expected_arrivals: insert for owner/manager/office"
  ON public.inventory_expected_arrivals FOR INSERT TO authenticated
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'office')
              AND org_id = (select current_org_id()));

DROP POLICY IF EXISTS "inventory_expected_arrivals: update for owner/manager/office" ON public.inventory_expected_arrivals;
CREATE POLICY "inventory_expected_arrivals: update for owner/manager/office"
  ON public.inventory_expected_arrivals FOR UPDATE TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'office')
         AND org_id = (select current_org_id()))
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'office')
              AND org_id = (select current_org_id()));

-- Only an open arrival can be deleted; a received one is tied to a ledger entry.
DROP POLICY IF EXISTS "inventory_expected_arrivals: delete open for owner" ON public.inventory_expected_arrivals;
CREATE POLICY "inventory_expected_arrivals: delete open for owner"
  ON public.inventory_expected_arrivals FOR DELETE TO authenticated
  USING ((select current_app_role()) = 'owner'
         AND org_id = (select current_org_id())
         AND status <> 'received');

-- receive_expected_arrival: post the ledger `receive` and close the arrival, atomically.
-- SECURITY INVOKER: the ledger's own policy decides who may receive (owner, manager, office).
CREATE OR REPLACE FUNCTION public.receive_expected_arrival(p_arrival_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  a      public.inventory_expected_arrivals%ROWTYPE;
  v_txn  uuid;
BEGIN
  IF current_app_role() IS NULL OR current_app_role() NOT IN ('owner', 'manager', 'office') THEN
    RAISE EXCEPTION 'your role cannot receive stock' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO a FROM public.inventory_expected_arrivals WHERE id = p_arrival_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'arrival % not found', p_arrival_id USING ERRCODE = 'P0002';
  END IF;
  IF a.status <> 'expected' THEN
    RAISE EXCEPTION 'this arrival is already %', a.status USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.inventory_transactions
    (org_id, txn_type, item_id, location_id, qty_delta, created_by, reason, job_id)
  VALUES
    (a.org_id, 'receive', a.item_id, a.location_id, a.qty, auth.uid(),
     COALESCE(a.supplier_note, 'Expected arrival received'), NULL)
  RETURNING id INTO v_txn;

  UPDATE public.inventory_expected_arrivals
     SET status = 'received', receipt_transaction_id = v_txn
   WHERE id = p_arrival_id;

  RETURN jsonb_build_object('arrival_id', p_arrival_id, 'transaction_id', v_txn,
                            'item_id', a.item_id, 'qty', a.qty);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_expected_arrivals_stamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_expected_arrivals_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.receive_expected_arrival(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_expected_arrival(uuid) TO authenticated;
