-- Read-only checks for the any-role Full-mode photo gate migration.
-- Run after 20261112000000_completion_gate_any_role_photo.sql. Changes nothing.
--
-- Structural assertions (house style): the shared function still backs both
-- triggers, the Full-mode photo check no longer requires a tech uploader, and
-- everything else about the gate is unchanged. Behavioural coverage lives in
-- the Vitest suite (jobs-closeout-mode, jobs-signature-photo-gate).

DO $$
DECLARE
  fn_def text;
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'guard_job_completion_gate'
      AND pronamespace = 'public'::regnamespace
  ), 'function public.guard_job_completion_gate() must exist';

  -- Both triggers still bound to the shared function.
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'guard_job_completion_gate'
      AND tgrelid = 'public.jobs'::regclass
      AND NOT tgisinternal AND (tgtype & 2) <> 0 AND (tgtype & 16) <> 0
  ), 'BEFORE UPDATE trigger guard_job_completion_gate must still exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'guard_job_completion_gate_insert'
      AND tgrelid = 'public.jobs'::regclass
      AND NOT tgisinternal AND (tgtype & 2) <> 0 AND (tgtype & 4) <> 0
  ), 'BEFORE INSERT trigger guard_job_completion_gate_insert must still exist';

  fn_def := pg_get_functiondef('public.guard_job_completion_gate()'::regprocedure);

  -- The photo gate is now role-agnostic: no user_profiles join, no uploader
  -- app_role = 'tech' condition. (The tech closeout_mode lock uses v_role, not
  -- app_role, so this does not false-positive on that.)
  ASSERT position('user_profiles' IN fn_def) = 0,
    'photo gate must no longer join user_profiles (any-role uploader)';
  ASSERT position('app_role = ''tech''' IN fn_def) = 0,
    'photo gate must no longer require the uploader app_role = tech';

  -- Signatures still excluded and an image is still required.
  ASSERT position('job-signatures' IN fn_def) > 0
     AND position('image/%' IN fn_def) > 0,
    'photo gate must still exclude signatures and require an image';

  -- Rest of the gate matrix unchanged.
  ASSERT position('linked_workflow_ids' IN fn_def) > 0,
    'full closeout must still require a linked installed system';
  ASSERT position('startupVerificationComplete' IN fn_def) > 0
     AND position('safetyReviewComplete' IN fn_def) > 0
     AND position('workAreaCleaned' IN fn_def) > 0,
    'full closeout must still require the three required QA items';
  ASSERT position('America/Los_Angeles' IN fn_def) > 0
     AND position('final scheduled day' IN fn_def) > 0,
    'B1 multi-day block must remain';
  ASSERT position('TG_OP = ''INSERT''' IN fn_def) > 0
     AND position('TG_OP = ''UPDATE''' IN fn_def) > 0,
    'function must remain TG_OP-aware';
  ASSERT position('v_role IS NULL' IN fn_def) > 0,
    'service-role / importer no-op must remain';
  ASSERT position('OLD.status IS DISTINCT FROM ''Completed''' IN fn_def) > 0
     AND position('NEW.status = ''Completed''' IN fn_def) > 0,
    'entry-into-Completed test must remain';

  -- Sanity: S1 untouched.
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'guard_tech_job_update'
      AND tgrelid = 'public.jobs'::regclass AND NOT tgisinternal
  ), 'S1 trigger guard_tech_job_update must still exist';
END $$;
