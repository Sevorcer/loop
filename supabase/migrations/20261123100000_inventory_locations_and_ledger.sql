-- =============================================================================
-- Migration — Vehicles, inventory locations, stock cache, append-only ledger
-- (Inventory Lane 1, part 2 of 2)
-- Plan: docs/briefs/inventory-lane1-plan-2026-11-05.md (approved by Collin 2026-11-05)
--
-- UP:
--   - vehicles               real van entity (no rows are created from legacy
--                            free-text; Collin adds vans in the UI)
--   - inventory_locations    warehouse | van | job (virtual buy-for-job) | quarantine
--   - inventory_stock_levels trigger-maintained cache of on-hand per item+location
--   - inventory_transactions append-only ledger (the only way quantity changes)
--   - fn_inventory_txn_guard / _apply / _immutable trigger functions
--
-- Ledger rules:
--   * Corrections, cancellations and returns are OPPOSITE entries (reversal rows
--     reference the original), never edits. UPDATE/DELETE/TRUNCATE raise.
--   * Transfers are two rows sharing transfer_group_id (-qty out, +qty in).
--   * On-hand may go negative: nothing hard-blocks in Lane 1 (staged enforcement).
--   * Ledger rows block organization deletion by design (org FK is RESTRICT).
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP TABLE IF EXISTS public.inventory_transactions;
--   DROP TABLE IF EXISTS public.inventory_stock_levels;
--   DROP TABLE IF EXISTS public.inventory_locations;
--   DROP TABLE IF EXISTS public.vehicles;
--   DROP FUNCTION IF EXISTS public.fn_inventory_txn_guard();
--   DROP FUNCTION IF EXISTS public.fn_inventory_txn_apply();
--   DROP FUNCTION IF EXISTS public.fn_inventory_txn_immutable();
-- =============================================================================

-- ---------------------------------------------------------------------------
-- vehicles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vehicles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  plate       text,
  vin         text,
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'out_of_service', 'retired')),
  crew_id     uuid REFERENCES public.crews(id) ON DELETE SET NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicles_id_org_key UNIQUE (id, org_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_org_name_uidx
  ON public.vehicles (org_id, lower(name));

CREATE INDEX IF NOT EXISTS vehicles_org_status_idx
  ON public.vehicles (org_id, status);

CREATE INDEX IF NOT EXISTS vehicles_crew_id_idx
  ON public.vehicles (crew_id) WHERE crew_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- inventory_locations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_locations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type                text NOT NULL
                        CHECK (type IN ('warehouse', 'van', 'job', 'quarantine')),
  name                text NOT NULL CHECK (length(btrim(name)) > 0),
  parent_location_id  uuid,
  vehicle_id          uuid,
  job_id              uuid REFERENCES public.jobs(id) ON DELETE RESTRICT,
  address             text,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_locations_id_org_key UNIQUE (id, org_id),
  CONSTRAINT inventory_locations_parent_same_org_fkey
    FOREIGN KEY (parent_location_id, org_id) REFERENCES public.inventory_locations (id, org_id) ON DELETE RESTRICT,
  CONSTRAINT inventory_locations_vehicle_same_org_fkey
    FOREIGN KEY (vehicle_id, org_id) REFERENCES public.vehicles (id, org_id) ON DELETE RESTRICT,
  CONSTRAINT inventory_locations_van_has_vehicle CHECK ((type = 'van') = (vehicle_id IS NOT NULL)),
  CONSTRAINT inventory_locations_job_has_job CHECK ((type = 'job') = (job_id IS NOT NULL)),
  CONSTRAINT inventory_locations_not_self_parent CHECK (parent_location_id IS NULL OR parent_location_id <> id)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_locations_org_name_uidx
  ON public.inventory_locations (org_id, lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS inventory_locations_vehicle_uidx
  ON public.inventory_locations (vehicle_id) WHERE vehicle_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_locations_job_uidx
  ON public.inventory_locations (job_id) WHERE type = 'job';

CREATE INDEX IF NOT EXISTS inventory_locations_org_type_idx
  ON public.inventory_locations (org_id, type);

-- ---------------------------------------------------------------------------
-- inventory_stock_levels — cache; written ONLY by the ledger trigger
-- min_qty / max_qty (par) are populated in Lane 2; columns exist now.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_stock_levels (
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id      uuid NOT NULL,
  location_id  uuid NOT NULL,
  on_hand      numeric(12, 3) NOT NULL DEFAULT 0,
  min_qty      numeric(12, 3) CHECK (min_qty IS NULL OR min_qty >= 0),
  max_qty      numeric(12, 3) CHECK (max_qty IS NULL OR max_qty >= 0),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, location_id),
  CONSTRAINT inventory_stock_levels_item_same_org_fkey
    FOREIGN KEY (item_id, org_id) REFERENCES public.catalog_items (id, org_id) ON DELETE RESTRICT,
  CONSTRAINT inventory_stock_levels_location_same_org_fkey
    FOREIGN KEY (location_id, org_id) REFERENCES public.inventory_locations (id, org_id) ON DELETE RESTRICT,
  CONSTRAINT inventory_stock_levels_par_order CHECK (min_qty IS NULL OR max_qty IS NULL OR min_qty <= max_qty)
);

CREATE INDEX IF NOT EXISTS inventory_stock_levels_org_location_idx
  ON public.inventory_stock_levels (org_id, location_id);

-- ---------------------------------------------------------------------------
-- inventory_transactions — append-only ledger
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  txn_type                  text NOT NULL
                              CHECK (txn_type IN (
                                'receive', 'transfer_out', 'transfer_in', 'issue_to_job',
                                'return_from_job', 'adjust', 'count', 'buy_for_job', 'reversal'
                              )),
  item_id                   uuid NOT NULL,
  location_id               uuid NOT NULL,
  qty_delta                 numeric(12, 3) NOT NULL CHECK (qty_delta <> 0),
  job_id                    uuid REFERENCES public.jobs(id) ON DELETE RESTRICT,
  transfer_group_id         uuid,
  reverses_transaction_id   uuid REFERENCES public.inventory_transactions(id) ON DELETE RESTRICT,
  reason                    text,
  unit_cost_cents           bigint CHECK (unit_cost_cents IS NULL OR unit_cost_cents >= 0),
  created_by                uuid NOT NULL REFERENCES public.user_profiles(id),
  created_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_transactions_item_same_org_fkey
    FOREIGN KEY (item_id, org_id) REFERENCES public.catalog_items (id, org_id) ON DELETE RESTRICT,
  CONSTRAINT inventory_transactions_location_same_org_fkey
    FOREIGN KEY (location_id, org_id) REFERENCES public.inventory_locations (id, org_id) ON DELETE RESTRICT,
  -- Sign must match the type (adjust / count / reversal are signed either way).
  CONSTRAINT inventory_transactions_sign_matches_type CHECK (
    (txn_type IN ('receive', 'return_from_job', 'transfer_in', 'buy_for_job') AND qty_delta > 0)
    OR (txn_type IN ('issue_to_job', 'transfer_out') AND qty_delta < 0)
    OR txn_type IN ('adjust', 'count', 'reversal')
  ),
  CONSTRAINT inventory_transactions_transfer_has_group CHECK (
    (txn_type IN ('transfer_out', 'transfer_in')) = (transfer_group_id IS NOT NULL)
  ),
  CONSTRAINT inventory_transactions_reversal_links_original CHECK (
    (txn_type = 'reversal') = (reverses_transaction_id IS NOT NULL)
  ),
  CONSTRAINT inventory_transactions_reason_required CHECK (
    txn_type NOT IN ('adjust', 'reversal') OR (reason IS NOT NULL AND length(btrim(reason)) > 0)
  )
);

-- A ledger row can be reversed at most once.
CREATE UNIQUE INDEX IF NOT EXISTS inventory_transactions_reverses_uidx
  ON public.inventory_transactions (reverses_transaction_id) WHERE reverses_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS inventory_transactions_org_created_idx
  ON public.inventory_transactions (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS inventory_transactions_item_idx
  ON public.inventory_transactions (org_id, item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS inventory_transactions_location_idx
  ON public.inventory_transactions (org_id, location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS inventory_transactions_job_idx
  ON public.inventory_transactions (job_id) WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS inventory_transactions_transfer_group_idx
  ON public.inventory_transactions (transfer_group_id) WHERE transfer_group_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Trigger functions
-- ---------------------------------------------------------------------------

-- Guard: the item must be stockable, the job (if any) must belong to the same org,
-- and a reversal must mirror its original exactly (same item/location, -qty).
CREATE OR REPLACE FUNCTION public.fn_inventory_txn_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  orig public.inventory_transactions%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.catalog_items
    WHERE id = NEW.item_id AND org_id = NEW.org_id AND is_stockable
  ) THEN
    RAISE EXCEPTION 'inventory item % is not stockable in this organization', NEW.item_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.job_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.jobs WHERE id = NEW.job_id AND org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'job % does not belong to this organization', NEW.job_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.txn_type = 'reversal' THEN
    SELECT * INTO orig FROM public.inventory_transactions
    WHERE id = NEW.reverses_transaction_id AND org_id = NEW.org_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'reversal target % not found', NEW.reverses_transaction_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF orig.txn_type = 'reversal' THEN
      RAISE EXCEPTION 'a reversal cannot itself be reversed; post a new entry instead'
        USING ERRCODE = 'check_violation';
    END IF;
    IF orig.item_id <> NEW.item_id OR orig.location_id <> NEW.location_id OR orig.qty_delta <> -NEW.qty_delta THEN
      RAISE EXCEPTION 'reversal must mirror the original entry (same item and location, opposite quantity)'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Apply: maintain the stock cache. SECURITY DEFINER so the cache can be written
-- while no role has INSERT/UPDATE on inventory_stock_levels.
CREATE OR REPLACE FUNCTION public.fn_inventory_txn_apply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.inventory_stock_levels (org_id, item_id, location_id, on_hand, updated_at)
  VALUES (NEW.org_id, NEW.item_id, NEW.location_id, NEW.qty_delta, now())
  ON CONFLICT (item_id, location_id) DO UPDATE
    SET on_hand = public.inventory_stock_levels.on_hand + EXCLUDED.on_hand,
        updated_at = now();
  RETURN NEW;
END;
$$;

-- Immutable: the ledger never changes after insert, for any role.
CREATE OR REPLACE FUNCTION public.fn_inventory_txn_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'inventory_transactions is append-only (% is not allowed); post an opposite entry instead', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_txn_guard ON public.inventory_transactions;
CREATE TRIGGER trg_inventory_txn_guard
  BEFORE INSERT ON public.inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_inventory_txn_guard();

DROP TRIGGER IF EXISTS trg_inventory_txn_apply ON public.inventory_transactions;
CREATE TRIGGER trg_inventory_txn_apply
  AFTER INSERT ON public.inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_inventory_txn_apply();

DROP TRIGGER IF EXISTS trg_inventory_txn_no_update_delete ON public.inventory_transactions;
CREATE TRIGGER trg_inventory_txn_no_update_delete
  BEFORE UPDATE OR DELETE ON public.inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_inventory_txn_immutable();

DROP TRIGGER IF EXISTS trg_inventory_txn_no_truncate ON public.inventory_transactions;
CREATE TRIGGER trg_inventory_txn_no_truncate
  BEFORE TRUNCATE ON public.inventory_transactions
  FOR EACH STATEMENT EXECUTE FUNCTION public.fn_inventory_txn_immutable();

-- The trigger functions are not callable through the API.
REVOKE ALL ON FUNCTION public.fn_inventory_txn_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_inventory_txn_apply() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privileges — defense in depth beneath RLS
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.inventory_transactions FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.inventory_transactions FROM authenticated;

REVOKE ALL ON public.inventory_stock_levels FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.inventory_stock_levels FROM authenticated;

-- ---------------------------------------------------------------------------
-- RLS — ENABLE + FORCE; portal has no policy anywhere.
-- ---------------------------------------------------------------------------

ALTER TABLE public.vehicles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles               FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_locations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_locations    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_levels FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions FORCE ROW LEVEL SECURITY;

-- vehicles: every internal role reads (techs/sales file vehicle alerts) ---------
DROP POLICY IF EXISTS "vehicles: read for staff" ON public.vehicles;
CREATE POLICY "vehicles: read for staff"
  ON public.vehicles FOR SELECT TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'tech', 'office', 'sales')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "vehicles: insert for office+" ON public.vehicles;
CREATE POLICY "vehicles: insert for office+"
  ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "vehicles: update for office+" ON public.vehicles;
CREATE POLICY "vehicles: update for office+"
  ON public.vehicles FOR UPDATE TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "vehicles: delete for owner" ON public.vehicles;
CREATE POLICY "vehicles: delete for owner"
  ON public.vehicles FOR DELETE TO authenticated
  USING (current_app_role() = 'owner' AND org_id = current_org_id());

-- inventory_locations --------------------------------------------------------
DROP POLICY IF EXISTS "inventory_locations: read for ops" ON public.inventory_locations;
CREATE POLICY "inventory_locations: read for ops"
  ON public.inventory_locations FOR SELECT TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "inventory_locations: insert for office+" ON public.inventory_locations;
CREATE POLICY "inventory_locations: insert for office+"
  ON public.inventory_locations FOR INSERT TO authenticated
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "inventory_locations: update for office+" ON public.inventory_locations;
CREATE POLICY "inventory_locations: update for office+"
  ON public.inventory_locations FOR UPDATE TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "inventory_locations: delete for owner" ON public.inventory_locations;
CREATE POLICY "inventory_locations: delete for owner"
  ON public.inventory_locations FOR DELETE TO authenticated
  USING (current_app_role() = 'owner' AND org_id = current_org_id());

-- inventory_stock_levels: SELECT only. No write policy — quantities change via the ledger.
DROP POLICY IF EXISTS "inventory_stock_levels: read for ops" ON public.inventory_stock_levels;
CREATE POLICY "inventory_stock_levels: read for ops"
  ON public.inventory_stock_levels FOR SELECT TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

-- inventory_transactions: SELECT + INSERT only (UPDATE/DELETE: no policy, no privilege, trigger-blocked)
DROP POLICY IF EXISTS "inventory_transactions: read for ops" ON public.inventory_transactions;
CREATE POLICY "inventory_transactions: read for ops"
  ON public.inventory_transactions FOR SELECT TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "inventory_transactions: insert for office+" ON public.inventory_transactions;
CREATE POLICY "inventory_transactions: insert for office+"
  ON public.inventory_transactions FOR INSERT TO authenticated
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
    AND created_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_locations_updated_at ON public.inventory_locations;
CREATE TRIGGER trg_inventory_locations_updated_at
  BEFORE UPDATE ON public.inventory_locations
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
