-- Read-only checks for 20261127800000_guard_tech_search_path_repin.sql.
-- Run after the migration. This file changes nothing.

DO $$
DECLARE
  fn_def text;
BEGIN
  fn_def := pg_get_functiondef('public.guard_tech_job_update()'::regprocedure);

  -- The search_path pin is restored.
  ASSERT position('search_path' IN fn_def) > 0,
    'guard_tech_job_update must carry the search_path pin';

  -- The #475 attestation exemption is still in place.
  ASSERT position('no_system_installed_by' IN fn_def) > 0
     AND position('auth.uid()' IN fn_def) > 0,
    'guard must still exempt and validate the attestation stamp columns';

  -- Still an allowlist, still blocks cancelling.
  ASSERT position('to_jsonb(NEW)' IN fn_def) > 0,
    'guard must still compare the whole row (allowlist)';
  ASSERT position('cannot cancel jobs' IN fn_def) > 0,
    'guard must still block technician cancellations';
END $$;
