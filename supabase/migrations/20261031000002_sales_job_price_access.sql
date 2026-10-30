-- Let sales enter a job price and read the production report.
--
-- Sales matches office and dispatch on job prices: read, insert, update, and
-- delete in their own company, plus the price history. The company check names
-- the price row, so a job from another company cannot be attached.
--
-- The production report also reads completion rows from job_activity. Sales
-- can read activity in their company, and can insert only a price event so
-- saving a price can record who changed it. That text still has no amount.
-- Jobs, assignees, completion teams, dispatch plans, and profiles already
-- allow a sales read in the same company. Technicians stay read-only on an
-- assigned job. Portal stays out.
--
-- This does not change or delete existing rows.
--
-- DOWN
--   DROP POLICY IF EXISTS "job_activity: sales reads own company" ON public.job_activity;
--   DROP POLICY IF EXISTS "job_activity: sales records a price change" ON public.job_activity;
--   Recreate the job_financials and job_financials_history finance policies
--   from 20261031000001_price_trigger_definer.sql, and the finance delete
--   policy from 20261031000000_person_team_reporting.sql.

DROP POLICY IF EXISTS "job_financials: finance read" ON public.job_financials;
CREATE POLICY "job_financials: finance read"
  ON public.job_financials FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
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
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
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
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1
      FROM public.jobs priced_job
      WHERE priced_job.id = job_financials.job_id
        AND priced_job.org_id = job_financials.org_id
    )
  );

DROP POLICY IF EXISTS "job_financials: finance delete" ON public.job_financials;
CREATE POLICY "job_financials: finance delete"
  ON public.job_financials FOR DELETE
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "job_financials_history: finance read" ON public.job_financials_history;
CREATE POLICY "job_financials_history: finance read"
  ON public.job_financials_history FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
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
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1
      FROM public.jobs priced_job
      WHERE priced_job.id = job_financials_history.job_id
        AND priced_job.org_id = job_financials_history.org_id
    )
  );

-- Completion dates for the production report, and the price timeline after a save.
DROP POLICY IF EXISTS "job_activity: sales reads own company" ON public.job_activity;
CREATE POLICY "job_activity: sales reads own company"
  ON public.job_activity FOR SELECT
  USING (
    current_app_role() = 'sales'
    AND org_id = current_org_id()
  );

-- Saving a price writes one timeline row. Sales cannot write other activity.
DROP POLICY IF EXISTS "job_activity: sales records a price change" ON public.job_activity;
CREATE POLICY "job_activity: sales records a price change"
  ON public.job_activity FOR INSERT
  WITH CHECK (
    current_app_role() = 'sales'
    AND org_id = current_org_id()
    AND type = 'price'
  );
