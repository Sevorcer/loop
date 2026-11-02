-- Read-only checks for the per-job closeout mode migration.
-- Run after 20261102000000_job_closeout_mode.sql. This file changes nothing.

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'closeout_mode'
  ), 'jobs.closeout_mode must exist';

  ASSERT (
    SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'closeout_mode'
  ) = 'text', 'jobs.closeout_mode must be text';

  ASSERT (
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'closeout_mode'
  ) = 'NO', 'jobs.closeout_mode must be NOT NULL';

  ASSERT (
    SELECT column_default FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'closeout_mode'
  ) LIKE '%''full''%', 'jobs.closeout_mode must default to ''full''';

  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jobs_closeout_mode_check' AND conrelid = 'public.jobs'::regclass
  ), 'jobs_closeout_mode_check constraint must exist';

  ASSERT position(
    '''visit''' IN pg_get_constraintdef('public.jobs'::regclass, 'jobs_closeout_mode_check')
  ) > 0 OR position(
    'visit' IN (
      SELECT pg_get_constraintdef(oid) FROM pg_constraint
      WHERE conname = 'jobs_closeout_mode_check' AND conrelid = 'public.jobs'::regclass
    )
  ) > 0, 'jobs_closeout_mode_check must allow ''visit''';
END $$;
