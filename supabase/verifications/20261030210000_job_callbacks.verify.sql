-- Asserts callback links and the narrow dispatch insert for return visits.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'job_callbacks'
  ), 'job_callbacks must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_callbacks' AND column_name = 'job_id'
  ), 'job_callbacks.job_id must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_callbacks' AND column_name = 'original_job_id'
  ), 'job_callbacks.original_job_id must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_callbacks' AND column_name = 'reason'
  ), 'job_callbacks.reason must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_callbacks' AND column_name = 'created_by'
  ), 'job_callbacks.created_by must exist';

  ASSERT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'job_callbacks'
      AND c.relrowsecurity = true
      AND c.relforcerowsecurity = true
  ), 'RLS must be enabled and forced on job_callbacks';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_callbacks'
      AND policyname = 'job_callbacks: read for owner/manager/dispatch/office/sales'
  ), 'office and dispatch must be able to read callback links';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_callbacks'
      AND policyname = 'job_callbacks: tech reads callbacks on assigned jobs'
  ), 'techs must read callback links only for assigned jobs';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_callbacks'
      AND policyname = 'job_callbacks: insert for owner/manager/dispatch/office'
      AND with_check ILIKE '%dispatch%'
      AND with_check ILIKE '%office%'
  ), 'office and dispatch must be able to create callback links';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_callbacks'
      AND cmd IN ('UPDATE', 'DELETE')
  ), 'callback links are append-only';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs'
      AND policyname = 'jobs: dispatch inserts callback jobs'
      AND with_check ILIKE '%Callback%'
  ), 'dispatch may insert only Callback jobs';
END; $$;
