-- Callback (return visit) jobs.
--
-- Office and dispatch can open a return visit from a completed job. The new
-- job is type Callback. This table links it to the original job and stores
-- the reason. The job pages read the link in both directions.
--
-- Dispatch cannot create ordinary jobs. A separate jobs INSERT policy allows
-- them to insert a row only when type is Callback. The application still
-- rejects POST /api/jobs for dispatch.
--
-- DOWN
--   DROP POLICY IF EXISTS "jobs: dispatch inserts callback jobs" ON public.jobs;
--   DROP TABLE IF EXISTS public.job_callbacks;

CREATE TABLE IF NOT EXISTS public.job_callbacks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id),
  job_id           uuid NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
  original_job_id  uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  reason           text NOT NULL CHECK (char_length(btrim(reason)) > 0),
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (job_id <> original_job_id)
);

CREATE INDEX IF NOT EXISTS job_callbacks_original_job_idx
  ON public.job_callbacks (org_id, original_job_id);

ALTER TABLE public.job_callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_callbacks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_callbacks: read for owner/manager/dispatch/office/sales" ON public.job_callbacks;
CREATE POLICY "job_callbacks: read for owner/manager/dispatch/office/sales"
  ON public.job_callbacks FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "job_callbacks: tech reads callbacks on assigned jobs" ON public.job_callbacks;
CREATE POLICY "job_callbacks: tech reads callbacks on assigned jobs"
  ON public.job_callbacks FOR SELECT
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND (
      job_id IN (
        SELECT j.id
        FROM public.jobs j
        WHERE j.org_id = current_org_id()
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
      OR original_job_id IN (
        SELECT j.id
        FROM public.jobs j
        WHERE j.org_id = current_org_id()
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
    )
  );

DROP POLICY IF EXISTS "job_callbacks: insert for owner/manager/dispatch/office" ON public.job_callbacks;
CREATE POLICY "job_callbacks: insert for owner/manager/dispatch/office"
  ON public.job_callbacks FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "jobs: dispatch inserts callback jobs" ON public.jobs;
CREATE POLICY "jobs: dispatch inserts callback jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (
    current_app_role() = 'dispatch'
    AND org_id = current_org_id()
    AND type = 'Callback'
  );
