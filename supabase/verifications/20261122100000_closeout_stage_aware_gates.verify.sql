-- Read-only checks for stage-aware closeout gates.
-- Run after 20261122100000_closeout_stage_aware_gates.sql. Changes nothing.

DO $$
DECLARE
  fn_def text;
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'guard_job_completion_gate'
      AND pronamespace = 'public'::regnamespace
  ), 'function public.guard_job_completion_gate() must exist';

  fn_def := pg_get_functiondef('public.guard_job_completion_gate()'::regprocedure);

  ASSERT position('v_requires_install' IN fn_def) > 0,
    'gate must compute v_requires_install for stage-aware closeout';

  ASSERT position('\yprep\y' IN fn_def) > 0
     OR position('prep' IN fn_def) > 0,
    'gate must detect prep visits';

  ASSERT position('startupVerificationComplete' IN fn_def) > 0,
    'gate must still reference startupVerificationComplete for full install visits';

  ASSERT position('missing installed systems' IN fn_def) > 0,
    'gate must still name the installed-systems blocker when required';
END $$;
