-- Read-only checks for the technician job-update allowlist migration.
-- Run after 20261103000000_tech_job_update_allowlist.sql. This file changes nothing.

DO $$
DECLARE
  fn_def text;
BEGIN
  -- The guard function must still exist and be wired to the jobs trigger.
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'guard_tech_job_update'
      AND pronamespace = 'public'::regnamespace
  ), 'function public.guard_tech_job_update() must exist';

  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'guard_tech_job_update'
      AND tgrelid = 'public.jobs'::regclass
      AND NOT tgisinternal
  ), 'trigger guard_tech_job_update on public.jobs must exist';

  fn_def := pg_get_functiondef('public.guard_tech_job_update()'::regprocedure);

  -- It must be the allowlist implementation (row-minus-keys comparison),
  -- not the old denylist that listed individual columns.
  ASSERT position('to_jsonb(NEW)' IN fn_def) > 0,
    'guard_tech_job_update must compare the whole row (allowlist), not a denylist';

  ASSERT position('''status''' IN fn_def) > 0 AND position('''updated_at''' IN fn_def) > 0,
    'guard_tech_job_update allowlist must exempt status and updated_at';

  -- Technicians must still be blocked from cancelling.
  ASSERT position('cannot cancel jobs' IN fn_def) > 0,
    'guard_tech_job_update must still block technician cancellations';
END $$;
