-- Read-only checks for the attestation-excuses-startup-QA gate change.
-- Run after 20261127500000_closeout_attestation_startup_qa.sql. Changes nothing.

DO $$
DECLARE
  fn_def text;
  attestation_refs int;
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'guard_job_completion_gate'
      AND pronamespace = 'public'::regnamespace
  ), 'function public.guard_job_completion_gate() must exist';

  fn_def := pg_get_functiondef('public.guard_job_completion_gate()'::regprocedure);

  ASSERT position('startupVerificationComplete' IN fn_def) > 0,
    'gate must still reference startupVerificationComplete for real install visits';

  ASSERT position('missing installed systems' IN fn_def) > 0,
    'gate must still name the installed-systems blocker when required';

  -- The attestation must be referenced at least twice: once for the
  -- installed-system gate (20261122100000) and once for the startup-QA
  -- excuse added by 20261127500000.
  attestation_refs :=
    (length(fn_def) - length(replace(fn_def, 'no_system_installed', '')))
    / length('no_system_installed');
  ASSERT attestation_refs >= 2,
    'gate must honor the no-system-installed attestation in both the systems gate and the QA branch';
END $$;
