-- Asserts the job_tasks table from this migration.
-- Named policies created here were replaced by "job_tasks: org all"
-- in 20260930000005_multi_assign_org_tasks.sql, so this file checks the
-- table, columns, indexes, and RLS that are still in place.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'job_tasks'
  ), 'job_tasks must exist';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_tasks' AND column_name = 'org_id'), 'job_tasks.org_id must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_tasks' AND column_name = 'job_id'), 'job_tasks.job_id must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_tasks' AND column_name = 'label'), 'job_tasks.label must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_tasks' AND column_name = 'is_done'), 'job_tasks.is_done must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_tasks' AND column_name = 'sort_order'), 'job_tasks.sort_order must exist';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'job_tasks' AND c.relrowsecurity = true
  ), 'RLS must be enabled on job_tasks';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'job_tasks_job_id_idx'), 'job_tasks_job_id_idx must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'job_tasks_org_id_idx'), 'job_tasks_org_id_idx must exist';
END; $$;
