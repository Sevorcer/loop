-- =============================================================================
-- Migration — Any signed-in role may edit any job note (R2, 2026-11-05)
--
-- job_notes previously had INSERT + SELECT only. This adds UPDATE policies so
-- owner/manager/dispatch/office/sales may edit any note in the org, and techs
-- may edit any note on jobs they are assigned to. Edit traces are written as
-- job_activity rows by the app (type "note").
--
-- Does not change rows. Safe to re-run.
-- =============================================================================

DROP POLICY IF EXISTS "job_notes: update for office roles" ON public.job_notes;
DROP POLICY IF EXISTS "job_notes: update for staff" ON public.job_notes;
DROP POLICY IF EXISTS "job_notes: tech updates notes on assigned jobs" ON public.job_notes;

CREATE POLICY "job_notes: update for staff"
  ON public.job_notes
  FOR UPDATE
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
  );

CREATE POLICY "job_notes: tech updates notes on assigned jobs"
  ON public.job_notes
  FOR UPDATE
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND private.caller_is_assigned_to_job(job_id)
  )
  WITH CHECK (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND private.caller_is_assigned_to_job(job_id)
  );
