-- Migration: vehicle_alerts
-- Real persistence for the Vehicle Alerts screen (replaces mock + localStorage).
--
-- Org/RLS pattern follows recent portal/job tables (org_id FK, current_org_id /
-- current_app_role helpers, ENABLE + FORCE RLS). Unlike portal_submissions, there
-- is NO anon / WITH CHECK (true) insert policy — authenticated org staff only.

CREATE TABLE IF NOT EXISTS public.vehicle_alerts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vehicle_name  text NOT NULL,
  title         text NOT NULL,
  description   text NOT NULL DEFAULT '',
  priority      text NOT NULL DEFAULT 'Medium'
                  CHECK (priority IN ('Low', 'Medium', 'High')),
  status        text NOT NULL DEFAULT 'New'
                  CHECK (status IN ('New', 'Acknowledged', 'Scheduled', 'Resolved')),
  reported_by   uuid NOT NULL REFERENCES public.user_profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicle_alerts_org_created_at_idx
  ON public.vehicle_alerts (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS vehicle_alerts_org_status_idx
  ON public.vehicle_alerts (org_id, status);

CREATE INDEX IF NOT EXISTS vehicle_alerts_reported_by_idx
  ON public.vehicle_alerts (reported_by);

ALTER TABLE public.vehicle_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_alerts FORCE ROW LEVEL SECURITY;

-- Read: all operational staff (not portal)
DROP POLICY IF EXISTS "vehicle_alerts: read for staff" ON public.vehicle_alerts;
CREATE POLICY "vehicle_alerts: read for staff"
  ON public.vehicle_alerts FOR SELECT
  TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales', 'tech')
    AND org_id = current_org_id()
  );

-- Insert: any operational staff for their own org; reporter must be self
DROP POLICY IF EXISTS "vehicle_alerts: insert for staff" ON public.vehicle_alerts;
CREATE POLICY "vehicle_alerts: insert for staff"
  ON public.vehicle_alerts FOR INSERT
  TO authenticated
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales', 'tech')
    AND org_id = current_org_id()
    AND reported_by = auth.uid()
  );

-- Update (status triage): office+ and dispatch
DROP POLICY IF EXISTS "vehicle_alerts: update for office+dispatch" ON public.vehicle_alerts;
CREATE POLICY "vehicle_alerts: update for office+dispatch"
  ON public.vehicle_alerts FOR UPDATE
  TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'office', 'dispatch')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office', 'dispatch')
    AND org_id = current_org_id()
  );

-- Delete: owner only
DROP POLICY IF EXISTS "vehicle_alerts: delete for owner" ON public.vehicle_alerts;
CREATE POLICY "vehicle_alerts: delete for owner"
  ON public.vehicle_alerts FOR DELETE
  TO authenticated
  USING (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );

-- updated_at: reuse the shared helper already present in the database
DROP TRIGGER IF EXISTS trg_vehicle_alerts_updated_at ON public.vehicle_alerts;
CREATE TRIGGER trg_vehicle_alerts_updated_at
  BEFORE UPDATE ON public.vehicle_alerts
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
