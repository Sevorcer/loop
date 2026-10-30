-- Asserts job_assignees and the org-wide job_tasks policy.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'job_assignees'
  ), 'job_assignees must exist';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_assignees' AND column_name = 'job_id'), 'job_assignees.job_id must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_assignees' AND column_name = 'user_id'), 'job_assignees.user_id must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_assignees' AND column_name = 'org_id'), 'job_assignees.org_id must exist';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'job_assignees' AND c.relrowsecurity = true
  ), 'RLS must be enabled on job_assignees';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_assignees' AND policyname = 'job_assignees: org read'), 'job_assignees: org read must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_assignees' AND policyname = 'job_assignees: org insert'), 'job_assignees: org insert must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_assignees' AND policyname = 'job_assignees: org delete'), 'job_assignees: org delete must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_tasks' AND policyname = 'job_tasks: org all'), 'job_tasks: org all must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'jobs' AND policyname = 'jobs: tech reads own assigned jobs'), 'jobs: tech reads own assigned jobs must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'jobs' AND policyname = 'jobs: tech updates own assigned jobs'), 'jobs: tech updates own assigned jobs must exist';
END; $$;
