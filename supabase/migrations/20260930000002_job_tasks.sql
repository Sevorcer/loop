-- Round-2 feedback: per-job office checklist tasks (install permits, warranty
-- registration, equipment entry, …). One row per task; the app seeds the
-- install template on demand. Safe to re-run (mirrors baseline conventions).
--
-- MUST be applied to the production database before deploying the code that
-- reads/writes job_tasks (SQL editor in the Supabase dashboard).

CREATE TABLE IF NOT EXISTS public.job_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id),
  job_id      uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  label       text NOT NULL,
  is_done     boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_tasks_job_id_idx ON public.job_tasks(job_id);
CREATE INDEX IF NOT EXISTS job_tasks_org_id_idx ON public.job_tasks(org_id);

ALTER TABLE public.job_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_tasks FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_tasks'
      AND policyname = 'job_tasks: read for owner/manager/dispatch/office/sales'
  ) THEN
    CREATE POLICY "job_tasks: read for owner/manager/dispatch/office/sales"
      ON public.job_tasks FOR SELECT
      USING (
        current_app_role() IN ('owner','manager','dispatch','office','sales')
        AND org_id = current_org_id()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_tasks'
      AND policyname = 'job_tasks: tech reads tasks for assigned jobs'
  ) THEN
    CREATE POLICY "job_tasks: tech reads tasks for assigned jobs"
      ON public.job_tasks FOR SELECT
      USING (
        current_app_role() = 'tech'
        AND org_id = current_org_id()
        AND job_id IN (
          SELECT id FROM public.jobs
          WHERE assigned_user_id = auth.uid()
            AND org_id = current_org_id()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_tasks'
      AND policyname = 'job_tasks: insert for owner/manager/office'
  ) THEN
    CREATE POLICY "job_tasks: insert for owner/manager/office"
      ON public.job_tasks FOR INSERT
      WITH CHECK (
        current_app_role() IN ('owner','manager','office')
        AND org_id = current_org_id()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_tasks'
      AND policyname = 'job_tasks: update for owner/manager/dispatch'
  ) THEN
    CREATE POLICY "job_tasks: update for owner/manager/dispatch"
      ON public.job_tasks FOR UPDATE
      USING (
        current_app_role() IN ('owner','manager','dispatch')
        AND org_id = current_org_id()
      )
      WITH CHECK (org_id = current_org_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_tasks'
      AND policyname = 'job_tasks: tech updates tasks for assigned jobs'
  ) THEN
    CREATE POLICY "job_tasks: tech updates tasks for assigned jobs"
      ON public.job_tasks FOR UPDATE
      USING (
        current_app_role() = 'tech'
        AND org_id = current_org_id()
        AND job_id IN (
          SELECT id FROM public.jobs
          WHERE assigned_user_id = auth.uid()
            AND org_id = current_org_id()
        )
      )
      WITH CHECK (org_id = current_org_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_tasks'
      AND policyname = 'job_tasks: delete for owner'
  ) THEN
    CREATE POLICY "job_tasks: delete for owner"
      ON public.job_tasks FOR DELETE
      USING (
        current_app_role() = 'owner'
        AND org_id = current_org_id()
      );
  END IF;
END $$;
