-- B4: let office staff edit jobs.
--
-- Adds `office` to the jobs UPDATE policy so office staff can edit a job
-- (including flipping closeout_mode). Mirrors the authorization matrix
-- (services/authorization.ts jobs.update) and the app-layer gate in
-- /api/jobs/[id] (which blocks only tech from the full update action).
--
-- Does not touch rows. Safe to run more than once. The tech UPDATE policy
-- and its allowlist trigger are untouched, so techs still change status only.
--
-- MUST be applied to the production database before the matching code deploys.

DROP POLICY IF EXISTS "jobs: update for owner/manager/dispatch" ON public.jobs;
DROP POLICY IF EXISTS "jobs: update for owner/manager/dispatch/office" ON public.jobs;
CREATE POLICY "jobs: update for owner/manager/dispatch/office"
  ON public.jobs
  FOR UPDATE
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

-- DOWN
-- Restore the baseline (20260719000001) policy without office:
--   DROP POLICY IF EXISTS "jobs: update for owner/manager/dispatch/office" ON public.jobs;
--   CREATE POLICY "jobs: update for owner/manager/dispatch"
--     ON public.jobs FOR UPDATE
--     USING (
--       current_app_role() IN ('owner', 'manager', 'dispatch')
--       AND org_id = current_org_id()
--     );
