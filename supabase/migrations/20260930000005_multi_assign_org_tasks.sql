-- FIX 1: multiple techs per job, picked individually.
-- New job_assignees join table (job_id -> jobs, user_id -> user_profiles) with
-- org-scoped RLS mirroring the 20260930000004 pattern. Applied to production
-- Supabase (project sygdurkefkasgfefvfcs) 2026-09-30.
CREATE TABLE IF NOT EXISTS public.job_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, user_id)
);
ALTER TABLE public.job_assignees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "job_assignees: org read" ON public.job_assignees;
CREATE POLICY "job_assignees: org read" ON public.job_assignees
  FOR SELECT USING (org_id = current_org_id());
DROP POLICY IF EXISTS "job_assignees: org insert" ON public.job_assignees;
CREATE POLICY "job_assignees: org insert" ON public.job_assignees
  FOR INSERT WITH CHECK (org_id = current_org_id());
DROP POLICY IF EXISTS "job_assignees: org delete" ON public.job_assignees;
CREATE POLICY "job_assignees: org delete" ON public.job_assignees
  FOR DELETE USING (org_id = current_org_id());

-- FIX 1: widen the jobs tech SELECT/UPDATE policies so a tech can see (and
-- update) a job when jobs.assigned_user_id = auth.uid() OR a job_assignees
-- row exists for (job, auth.uid()). Owner/office/dispatch/manager clauses
-- are preserved exactly as they were.
DROP POLICY IF EXISTS "jobs: tech reads own assigned jobs" ON public.jobs;
CREATE POLICY "jobs: tech reads own assigned jobs" ON public.jobs
  FOR SELECT USING (
    (current_app_role() = 'tech')
    AND (org_id = current_org_id())
    AND (
      (assigned_user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.job_assignees ja
        WHERE ja.job_id = jobs.id AND ja.user_id = auth.uid()
      )
    )
  );
DROP POLICY IF EXISTS "jobs: tech updates own assigned jobs" ON public.jobs;
CREATE POLICY "jobs: tech updates own assigned jobs" ON public.jobs
  FOR UPDATE USING (
    (current_app_role() = 'tech')
    AND (org_id = current_org_id())
    AND (
      (assigned_user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.job_assignees ja
        WHERE ja.job_id = jobs.id AND ja.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    (current_app_role() = 'tech')
    AND (org_id = current_org_id())
    AND (
      (assigned_user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.job_assignees ja
        WHERE ja.job_id = jobs.id AND ja.user_id = auth.uid()
      )
    )
  );

-- FIX 1: backfill job_assignees for existing jobs with assigned_user_id set
-- (including JOB-1010 / Antonio Vilchez) so the new mechanism is consistent.
INSERT INTO public.job_assignees (job_id, user_id, org_id)
SELECT id, assigned_user_id, org_id FROM public.jobs
WHERE assigned_user_id IS NOT NULL
ON CONFLICT (job_id, user_id) DO NOTHING;

-- FIX 2: anyone in the org can add checklist items. The job_tasks table has
-- org_id, so recreate the write path as a single org-scoped FOR ALL policy
-- (mirrors 20260930000004 style). Fixes the rehearsal failure:
-- 'new row violates row-level security policy for table "job_tasks"'
-- when Antonio added "load lineset". Org-scoped, no anon access.
DROP POLICY IF EXISTS "job_tasks: delete for owner/manager" ON public.job_tasks;
DROP POLICY IF EXISTS "job_tasks: insert for owner/manager/dispatch" ON public.job_tasks;
DROP POLICY IF EXISTS "job_tasks: read for owner/manager/dispatch/office/sales" ON public.job_tasks;
DROP POLICY IF EXISTS "job_tasks: tech reads tasks for assigned jobs" ON public.job_tasks;
DROP POLICY IF EXISTS "job_tasks: tech updates tasks for assigned jobs" ON public.job_tasks;
DROP POLICY IF EXISTS "job_tasks: update for owner/manager/dispatch" ON public.job_tasks;
DROP POLICY IF EXISTS "job_tasks: org all" ON public.job_tasks;
CREATE POLICY "job_tasks: org all" ON public.job_tasks
  FOR ALL USING (org_id = current_org_id())
  WITH CHECK (org_id = current_org_id());
