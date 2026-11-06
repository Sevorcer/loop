-- Read-only checks for 20261127700000_tech_no_system_attestation.sql.
-- Run after the migration. This file changes nothing.

DO $$
DECLARE
  fn_def text;
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'guard_tech_job_update'
      AND tgrelid = 'public.jobs'::regclass
      AND NOT tgisinternal
  ), 'trigger guard_tech_job_update on public.jobs must exist';

  fn_def := pg_get_functiondef('public.guard_tech_job_update()'::regprocedure);

  -- Still an allowlist, still blocks cancelling.
  ASSERT position('to_jsonb(NEW)' IN fn_def) > 0,
    'guard must still compare the whole row (allowlist)';
  ASSERT position('cannot cancel jobs' IN fn_def) > 0,
    'guard must still block technician cancellations';

  -- The three attestation columns are exempt and checked for honesty.
  ASSERT position('no_system_installed_by' IN fn_def) > 0
     AND position('no_system_installed_at' IN fn_def) > 0,
    'guard must exempt and validate the attestation stamp columns';
  ASSERT position('auth.uid()' IN fn_def) > 0,
    'guard must require the attestation stamp to be the caller';
END $$;
