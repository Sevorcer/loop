-- B3: job_tasks checklist permissions.
--
-- Anyone on the internal team may ADD a checklist item; only office and above
-- (office, manager, owner — not dispatch, not tech) may REMOVE one. This is
-- the RLS layer; the API route and the UI enforce the same split.
--
-- Does not touch rows. Safe to run more than once.
--
-- MUST be applied to the production database before the matching code deploys.

-- INSERT — anyone in the org (internal staff). The customer portal role is
-- external and stays off the checklist. Replaces the previous office-only
-- insert policy from 20261031100000.
DROP POLICY IF EXISTS "job_tasks: insert for owner/manager/office" ON public.job_tasks;
DROP POLICY IF EXISTS "job_tasks: insert for org staff" ON public.job_tasks;
CREATE POLICY "job_tasks: insert for org staff"
  ON public.job_tasks
  FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'tech', 'office', 'sales')
    AND org_id = current_org_id()
  );

-- DELETE — office and above only. Dispatch and tech lose removal; they keep
-- the ability to add (above) and to check items off (unchanged). Replaces the
-- office-roles delete policy from 20261031100000.
DROP POLICY IF EXISTS "job_tasks: delete for office roles" ON public.job_tasks;
DROP POLICY IF EXISTS "job_tasks: delete for owner" ON public.job_tasks;
DROP POLICY IF EXISTS "job_tasks: delete for office and above" ON public.job_tasks;
CREATE POLICY "job_tasks: delete for office and above"
  ON public.job_tasks
  FOR DELETE
  USING (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

-- DOWN
-- Restore the 20261031100000 definitions:
--   DROP POLICY IF EXISTS "job_tasks: insert for org staff" ON public.job_tasks;
--   CREATE POLICY "job_tasks: insert for owner/manager/office"
--     ON public.job_tasks FOR INSERT
--     WITH CHECK (
--       current_app_role() IN ('owner', 'manager', 'office', 'dispatch')
--       AND org_id = current_org_id()
--     );
--   DROP POLICY IF EXISTS "job_tasks: delete for office and above" ON public.job_tasks;
--   CREATE POLICY "job_tasks: delete for office roles"
--     ON public.job_tasks FOR DELETE
--     USING (
--       current_app_role() IN ('owner', 'manager', 'office', 'dispatch')
--       AND org_id = current_org_id()
--     );
