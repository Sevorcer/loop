-- Let an owner or the office save a job price.
--
-- The same-company triggers ran as the caller with an empty search path.
-- They read public.jobs, and that table's row security calls
-- public.current_app_role() and public.current_org_id(). Those helpers read
-- user_profiles with no schema and no search_path, so every insert failed
-- with: relation "user_profiles" does not exist.
--
-- The triggers now run as their owner. Their search_path stays empty, and
-- anon and authenticated cannot call them as ordinary functions. The helpers
-- keep a public search_path so user_profiles resolves. Policies that compared
-- priced_job.org_id to itself now name the price row's company column.
--
-- This does not change or delete existing rows.
--
-- DOWN
--   ALTER FUNCTION private.enforce_job_price_same_company() SECURITY INVOKER;
--   ALTER FUNCTION private.enforce_calendar_group_member_same_company() SECURITY INVOKER;
--   ALTER FUNCTION public.current_app_role() RESET search_path;
--   ALTER FUNCTION public.current_org_id() RESET search_path;
--   GRANT EXECUTE ON FUNCTION private.enforce_job_price_same_company() TO authenticated;
--   GRANT EXECUTE ON FUNCTION private.enforce_calendar_group_member_same_company() TO authenticated;
--   Recreate the job_financials, job_financials_history, and
--   calendar_saved_group_members policies from
--   20261031000000_person_team_reporting.sql.

ALTER FUNCTION private.enforce_job_price_same_company() SECURITY DEFINER;
ALTER FUNCTION private.enforce_job_price_same_company() SET search_path = '';

ALTER FUNCTION private.enforce_calendar_group_member_same_company() SECURITY DEFINER;
ALTER FUNCTION private.enforce_calendar_group_member_same_company() SET search_path = '';

ALTER FUNCTION public.current_app_role() SET search_path = public;
ALTER FUNCTION public.current_org_id() SET search_path = public;

REVOKE ALL ON FUNCTION private.enforce_job_price_same_company() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.enforce_job_price_same_company() FROM anon;
REVOKE ALL ON FUNCTION private.enforce_job_price_same_company() FROM authenticated;

REVOKE ALL ON FUNCTION private.enforce_calendar_group_member_same_company() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.enforce_calendar_group_member_same_company() FROM anon;
REVOKE ALL ON FUNCTION private.enforce_calendar_group_member_same_company() FROM authenticated;

-- The unqualified org_id inside the subquery bound to priced_job.org_id.
DROP POLICY IF EXISTS "job_financials: finance read" ON public.job_financials;
CREATE POLICY "job_financials: finance read"
  ON public.job_financials FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1
      FROM public.jobs priced_job
      WHERE priced_job.id = job_financials.job_id
        AND priced_job.org_id = job_financials.org_id
    )
  );

DROP POLICY IF EXISTS "job_financials: finance insert" ON public.job_financials;
CREATE POLICY "job_financials: finance insert"
  ON public.job_financials FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1
      FROM public.jobs priced_job
      WHERE priced_job.id = job_financials.job_id
        AND priced_job.org_id = job_financials.org_id
    )
  );

DROP POLICY IF EXISTS "job_financials: finance update" ON public.job_financials;
CREATE POLICY "job_financials: finance update"
  ON public.job_financials FOR UPDATE
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1
      FROM public.jobs priced_job
      WHERE priced_job.id = job_financials.job_id
        AND priced_job.org_id = job_financials.org_id
    )
  );

DROP POLICY IF EXISTS "job_financials: tech reads assigned" ON public.job_financials;
CREATE POLICY "job_financials: tech reads assigned"
  ON public.job_financials FOR SELECT
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1
      FROM public.jobs priced_job
      WHERE priced_job.id = job_financials.job_id
        AND priced_job.org_id = job_financials.org_id
        AND (
          priced_job.assigned_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.job_assignees assignee
            WHERE assignee.job_id = priced_job.id
              AND assignee.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "job_financials_history: finance read" ON public.job_financials_history;
CREATE POLICY "job_financials_history: finance read"
  ON public.job_financials_history FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1
      FROM public.jobs priced_job
      WHERE priced_job.id = job_financials_history.job_id
        AND priced_job.org_id = job_financials_history.org_id
    )
  );

DROP POLICY IF EXISTS "job_financials_history: finance insert" ON public.job_financials_history;
CREATE POLICY "job_financials_history: finance insert"
  ON public.job_financials_history FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1
      FROM public.jobs priced_job
      WHERE priced_job.id = job_financials_history.job_id
        AND priced_job.org_id = job_financials_history.org_id
    )
  );

DROP POLICY IF EXISTS "calendar_saved_group_members: office insert" ON public.calendar_saved_group_members;
CREATE POLICY "calendar_saved_group_members: office insert"
  ON public.calendar_saved_group_members FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles member_profile
      WHERE member_profile.id = calendar_saved_group_members.user_id
        AND member_profile.org_id = calendar_saved_group_members.org_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.calendar_saved_groups saved_group
      WHERE saved_group.id = calendar_saved_group_members.group_id
        AND saved_group.org_id = calendar_saved_group_members.org_id
    )
  );
