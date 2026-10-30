-- Asserts one plan per job, and append-only job_notes with office/tech scope.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'dispatch_plans'
      AND indexname = 'dispatch_plans_one_per_job_uidx'
  ), 'dispatch_plans_one_per_job_uidx must exist';

  ASSERT NOT EXISTS (
    SELECT 1
    FROM public.dispatch_plans
    WHERE job_id IS NOT NULL
    GROUP BY org_id, job_id
    HAVING count(*) > 1
  ), 'each job must have at most one dispatch plan';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'job_notes'
  ), 'job_notes must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_notes' AND column_name = 'body'
  ), 'job_notes.body must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_notes' AND column_name = 'author_id'
  ), 'job_notes.author_id must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_notes' AND column_name = 'author_name'
  ), 'job_notes.author_name must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_notes' AND column_name = 'author_role'
  ), 'job_notes.author_role must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_notes' AND column_name = 'created_at'
  ), 'job_notes.created_at must exist';

  ASSERT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'job_notes'
      AND c.relrowsecurity = true
      AND c.relforcerowsecurity = true
  ), 'RLS must be enabled and forced on job_notes';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_notes'
      AND policyname = 'job_notes: read for owner/manager/dispatch/office/sales'
  ), 'office and sales must be able to read job notes';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_notes'
      AND policyname = 'job_notes: tech reads notes on assigned jobs'
  ), 'techs must read notes only on assigned jobs';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_notes'
      AND policyname = 'job_notes: insert for owner/manager/dispatch/office'
      AND with_check ILIKE '%office%'
  ), 'office must be able to add job notes';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_notes'
      AND policyname = 'job_notes: tech inserts on assigned jobs'
      AND with_check ILIKE '%job_assignees%'
  ), 'techs must add notes only on assigned jobs';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_notes'
      AND cmd IN ('UPDATE', 'DELETE')
  ), 'job_notes must not allow update or delete';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_activity'
      AND policyname = 'job_activity: insert for owner/manager/dispatch/office'
      AND with_check ILIKE '%office%'
  ), 'office must be able to insert job activity';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_activity'
      AND policyname = 'job_activity: tech inserts on own assigned jobs'
      AND with_check ILIKE '%job_assignees%'
  ), 'tech job activity inserts must follow job assignment';
END; $$;
