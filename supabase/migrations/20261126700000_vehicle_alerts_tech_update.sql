-- =============================================================================
-- Vehicle alerts — techs may update alert status (Collin, 2026-11-06:
-- "techs get full access to vehicle alerts"). Widens the UPDATE policy from
-- 20261120500000 (office+dispatch) to include tech and sales is NOT added;
-- delete stays owner-only. Policy renamed to match its scope.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   Re-create the "vehicle_alerts: update for office+dispatch" policy from
--   20261120500000 and drop this one.
-- =============================================================================

DROP POLICY IF EXISTS "vehicle_alerts: update for office+dispatch" ON public.vehicle_alerts;
DROP POLICY IF EXISTS "vehicle_alerts: update for staff" ON public.vehicle_alerts;
CREATE POLICY "vehicle_alerts: update for staff"
  ON public.vehicle_alerts FOR UPDATE
  TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'office', 'dispatch', 'tech')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office', 'dispatch', 'tech')
    AND org_id = current_org_id()
  );
