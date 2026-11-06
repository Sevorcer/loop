-- =============================================================================
-- Migration — vehicle_operators (Inventory Lane 2, PR A, M1)
-- Plan: docs/briefs/inventory-lane2-plan-2026-11-05.md
-- Rulings: Collin approved D1–D10 as recommended (2026-11-06).
--
-- D7: the phone learns the van from this table. Office assigns people.
-- This does not replace crews.vehicle_id. No rows are seeded.
-- The Locations & vans dialog that writes these rows is Lane 2 PR B.
--
-- UP:
--   - vehicle_operators (person ↔ van, one home van per person)
--   - fn_vehicle_operator_guard (same-org vehicle and user)
--   - fn_inventory_visible_vehicle_ids (definer helper for location/stock RLS)
--   - RLS policies named in the plan
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP POLICY IF EXISTS "vehicle_operators: read for ops and self" ON public.vehicle_operators;
--   DROP POLICY IF EXISTS "vehicle_operators: insert for office+" ON public.vehicle_operators;
--   DROP POLICY IF EXISTS "vehicle_operators: update for office+" ON public.vehicle_operators;
--   DROP POLICY IF EXISTS "vehicle_operators: delete for owner" ON public.vehicle_operators;
--   DROP TRIGGER IF EXISTS trg_vehicle_operators_updated_at ON public.vehicle_operators;
--   DROP TRIGGER IF EXISTS trg_vehicle_operator_guard ON public.vehicle_operators;
--   DROP FUNCTION IF EXISTS public.fn_vehicle_operator_guard();
--   DROP FUNCTION IF EXISTS public.fn_inventory_visible_vehicle_ids();
--   DROP TABLE IF EXISTS public.vehicle_operators;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- vehicle_operators
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vehicle_operators (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vehicle_id  uuid NOT NULL,
  user_id     uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  is_home     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_operators_vehicle_same_org_fkey
    FOREIGN KEY (vehicle_id, org_id) REFERENCES public.vehicles (id, org_id) ON DELETE CASCADE,
  CONSTRAINT vehicle_operators_org_vehicle_user_key UNIQUE (org_id, vehicle_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_operators_one_home_uidx
  ON public.vehicle_operators (org_id, user_id)
  WHERE is_home;

CREATE INDEX IF NOT EXISTS vehicle_operators_org_user_idx
  ON public.vehicle_operators (org_id, user_id);

CREATE INDEX IF NOT EXISTS vehicle_operators_vehicle_idx
  ON public.vehicle_operators (vehicle_id);

-- ---------------------------------------------------------------------------
-- Same-org guard. The vehicle FK already pins the vehicle's org; the user
-- profile has no (id, org_id) unique key, so the profile check lives here.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_vehicle_operator_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vehicles
    WHERE id = NEW.vehicle_id AND org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'vehicle % is not in this organization', NEW.vehicle_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = NEW.user_id AND org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'user % is not in this organization', NEW.user_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_vehicle_operator_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_vehicle_operator_guard ON public.vehicle_operators;
CREATE TRIGGER trg_vehicle_operator_guard
  BEFORE INSERT OR UPDATE ON public.vehicle_operators
  FOR EACH ROW EXECUTE FUNCTION public.fn_vehicle_operator_guard();

DROP TRIGGER IF EXISTS trg_vehicle_operators_updated_at ON public.vehicle_operators;
CREATE TRIGGER trg_vehicle_operators_updated_at
  BEFORE UPDATE ON public.vehicle_operators
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- Vans the signed-in person is assigned to. SECURITY DEFINER so location and
-- stock policies can call it without recursing through vehicle_operators RLS.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_inventory_visible_vehicle_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vehicle_id
  FROM public.vehicle_operators
  WHERE user_id = auth.uid()
    AND org_id = current_org_id();
$$;

REVOKE ALL ON FUNCTION public.fn_inventory_visible_vehicle_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_inventory_visible_vehicle_ids() TO authenticated;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.vehicle_operators FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_operators TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS — ENABLE + FORCE. Sales and portal have no policy.
-- Tech reads their own rows and cannot assign themselves.
-- ---------------------------------------------------------------------------

ALTER TABLE public.vehicle_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_operators FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_operators: read for ops and self" ON public.vehicle_operators;
CREATE POLICY "vehicle_operators: read for ops and self"
  ON public.vehicle_operators FOR SELECT TO authenticated
  USING (
    org_id = current_org_id()
    AND (
      current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
      OR (current_app_role() = 'tech' AND user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "vehicle_operators: insert for office+" ON public.vehicle_operators;
CREATE POLICY "vehicle_operators: insert for office+"
  ON public.vehicle_operators FOR INSERT TO authenticated
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "vehicle_operators: update for office+" ON public.vehicle_operators;
CREATE POLICY "vehicle_operators: update for office+"
  ON public.vehicle_operators FOR UPDATE TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "vehicle_operators: delete for owner" ON public.vehicle_operators;
CREATE POLICY "vehicle_operators: delete for owner"
  ON public.vehicle_operators FOR DELETE TO authenticated
  USING (current_app_role() = 'owner' AND org_id = current_org_id());
