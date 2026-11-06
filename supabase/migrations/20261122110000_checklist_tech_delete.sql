-- =============================================================================
-- Migration — Techs may delete checklist items (R1, field feedback 2026-11-05)
--
-- Replaces B3: delete was office/manager/owner only. Techs may now DELETE
-- job_tasks on jobs they are assigned to (same assignment helper the update
-- policy already uses). Office/manager/owner keep org-wide delete.
--
-- App layer: canRemoveJobChecklistItem now includes tech; deletions write a
-- job_activity "Checklist item removed" row.
--
-- Does not change rows. Safe to re-run.
-- =============================================================================

DROP POLICY IF EXISTS "job_tasks: delete for office and above" ON public.job_tasks;
DROP POLICY IF EXISTS "job_tasks: delete for office roles" ON public.job_tasks;
DROP POLICY IF EXISTS "job_tasks: delete for owner" ON public.job_tasks;
DROP POLICY IF EXISTS "job_tasks: tech deletes tasks on assigned jobs" ON public.job_tasks;

CREATE POLICY "job_tasks: delete for office and above"
  ON public.job_tasks
  FOR DELETE
  USING (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

CREATE POLICY "job_tasks: tech deletes tasks on assigned jobs"
  ON public.job_tasks
  FOR DELETE
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND private.caller_is_assigned_to_job(job_id)
  );
