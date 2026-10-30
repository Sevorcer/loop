-- Technicians only see properties on jobs assigned to them.
-- Office staff can write crew assignments, schedule blocks, and dispatch events
-- (owner/manager/dispatcher already could). Technicians still cannot edit job
-- details or cancel a job, even if they call the database directly.
--
-- UP:
--   - Replace the broad properties SELECT policy so techs are scoped to assigned jobs
--   - Allow the office role to write dispatch placement tables
--   - Block technician updates that change job details or cancel a job
--
-- DOWN
--   DROP TRIGGER IF EXISTS guard_tech_job_update ON public.jobs;
--   DROP FUNCTION IF EXISTS public.guard_tech_job_update();
--   DROP POLICY IF EXISTS "properties: tech reads properties on assigned jobs" ON public.properties;
--   DROP POLICY IF EXISTS "properties: read for internal operational roles" ON public.properties;
--   CREATE POLICY "properties: read for internal operational roles"
--     ON public.properties FOR SELECT
--     USING (
--       current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
--       AND org_id = current_org_id()
--     );
--   DROP POLICY IF EXISTS "crew_assignments: org write" ON public.crew_assignments;
--   CREATE POLICY "crew_assignments: org write" ON public.crew_assignments
--     FOR ALL USING (org_id = current_org_id())
--     WITH CHECK (
--       org_id = current_org_id()
--       AND current_app_role() IN ('owner','manager','dispatch')
--     );
--   DROP POLICY IF EXISTS "schedule_blocks: org write" ON public.schedule_blocks;
--   CREATE POLICY "schedule_blocks: org write" ON public.schedule_blocks
--     FOR ALL USING (org_id = current_org_id())
--     WITH CHECK (
--       org_id = current_org_id()
--       AND current_app_role() IN ('owner','manager','dispatch')
--     );
--   DROP POLICY IF EXISTS "dispatch_events: org insert" ON public.dispatch_events;
--   CREATE POLICY "dispatch_events: org insert" ON public.dispatch_events
--     FOR INSERT WITH CHECK (
--       org_id = current_org_id()
--       AND current_app_role() IN ('owner','manager','dispatch')
--     );

DROP POLICY IF EXISTS "properties: read for internal operational roles" ON public.properties;
CREATE POLICY "properties: read for internal operational roles"
  ON public.properties FOR SELECT
  USING (
    current_app_role() IN ('owner','manager','dispatch','office','sales')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "properties: tech reads properties on assigned jobs" ON public.properties;
CREATE POLICY "properties: tech reads properties on assigned jobs"
  ON public.properties FOR SELECT
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND id IN (
      SELECT j.property_id
      FROM public.jobs j
      WHERE j.org_id = current_org_id()
        AND j.property_id IS NOT NULL
        AND (
          j.assigned_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.job_assignees ja
            WHERE ja.job_id = j.id
              AND ja.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "crew_assignments: org write" ON public.crew_assignments;
CREATE POLICY "crew_assignments: org write"
  ON public.crew_assignments FOR ALL
  USING (org_id = current_org_id())
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','office')
  );

DROP POLICY IF EXISTS "schedule_blocks: org write" ON public.schedule_blocks;
CREATE POLICY "schedule_blocks: org write"
  ON public.schedule_blocks FOR ALL
  USING (org_id = current_org_id())
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','office')
  );

DROP POLICY IF EXISTS "dispatch_events: org insert" ON public.dispatch_events;
CREATE POLICY "dispatch_events: org insert"
  ON public.dispatch_events FOR INSERT
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','office')
  );

CREATE OR REPLACE FUNCTION public.guard_tech_job_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_app_role() IS DISTINCT FROM 'tech' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'Cancelled' AND OLD.status IS DISTINCT FROM 'Cancelled' THEN
    RAISE EXCEPTION 'Technicians cannot cancel jobs' USING ERRCODE = '42501';
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.priority IS DISTINCT FROM OLD.priority
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
     OR NEW.property_id IS DISTINCT FROM OLD.property_id
     OR NEW.property_name IS DISTINCT FROM OLD.property_name
     OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     OR NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id
     OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for
     OR NEW.scheduled_start_at IS DISTINCT FROM OLD.scheduled_start_at
     OR NEW.scheduled_end_at IS DISTINCT FROM OLD.scheduled_end_at
     OR NEW.location IS DISTINCT FROM OLD.location
     OR NEW.summary IS DISTINCT FROM OLD.summary
     OR NEW.contractor_ids IS DISTINCT FROM OLD.contractor_ids
  THEN
    RAISE EXCEPTION 'Technicians cannot edit job details' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_tech_job_update ON public.jobs;
CREATE TRIGGER guard_tech_job_update
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_tech_job_update();
