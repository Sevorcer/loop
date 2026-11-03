-- Read-only checks for the job completion-gate trigger migration.
-- Run after 20261110000000_job_completion_gate.sql. This file changes nothing.
--
-- These are structural assertions (function + trigger wiring and the presence
-- of each gate in the function source), matching the house verify style. The
-- behavioural coverage of the gate matrix lives in the Vitest suite
-- (src/services/__tests__/jobs-closeout-mode, jobs-signature-photo-gate,
-- jobs-multiday-completion), which pins the same app-layer rules this trigger
-- mirrors.

DO $$
DECLARE
  fn_def text;
BEGIN
  -- Function and trigger must exist and be a BEFORE UPDATE row trigger on jobs.
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'guard_job_completion_gate'
      AND pronamespace = 'public'::regnamespace
  ), 'function public.guard_job_completion_gate() must exist';

  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'guard_job_completion_gate'
      AND tgrelid = 'public.jobs'::regclass
      AND NOT tgisinternal
      -- tgtype bit 0 = BEFORE (row-level BEFORE triggers have bit 0 set).
      AND (tgtype & 2) <> 0
      -- tgtype bit 4 = UPDATE.
      AND (tgtype & 16) <> 0
  ), 'trigger guard_job_completion_gate must be a BEFORE UPDATE trigger on public.jobs';

  fn_def := pg_get_functiondef('public.guard_job_completion_gate()'::regprocedure);

  -- Importer / service-role safety: skip when there is no signed-in app role.
  ASSERT position('current_app_role()' IN fn_def) > 0
     AND position('v_role IS NULL' IN fn_def) > 0,
    'gate must no-op when current_app_role() is NULL (service role / importer)';

  -- Only the transition INTO Completed is gated; out-of-Completed is not.
  ASSERT position('OLD.status IS DISTINCT FROM ''Completed''' IN fn_def) > 0
     AND position('NEW.status = ''Completed''' IN fn_def) > 0,
    'gate must fire only on the non-Completed -> Completed transition';

  -- Defense-in-depth tech closeout_mode guard.
  ASSERT position('closeout mode' IN fn_def) > 0
     AND position('v_role = ''tech''' IN fn_def) > 0,
    'gate must block technicians from changing closeout_mode';

  -- B1 multi-day: company timezone + final scheduled day.
  ASSERT position('America/Los_Angeles' IN fn_def) > 0
     AND position('final scheduled day' IN fn_def) > 0,
    'gate must enforce the B1 multi-day completion block in the company timezone';

  -- Visit mode gates on the note alone.
  ASSERT position('''visit''' IN fn_def) > 0
     AND position('missing job notes' IN fn_def) > 0,
    'visit closeout must gate on a job note';

  -- Note definition: job_notes OR a non-empty notes column.
  ASSERT position('job_notes' IN fn_def) > 0,
    'note gate must consult job_notes';

  -- Full-mode photo gate: non-signature image uploaded by a technician.
  ASSERT position('storage_objects' IN fn_def) > 0
     AND position('job-signatures' IN fn_def) > 0
     AND position('image/%' IN fn_def) > 0
     AND position('app_role = ''tech''' IN fn_def) > 0,
    'full closeout photo gate must require a non-signature tech image';

  -- Full-mode installed-system gate: direct job_id or linked_workflow_ids.
  ASSERT position('installed_systems' IN fn_def) > 0
     AND position('linked_workflow_ids' IN fn_def) > 0,
    'full closeout must require an installed system linked to the job';

  -- Full-mode required-QA gate: the three required checklist keys.
  ASSERT position('startupVerificationComplete' IN fn_def) > 0
     AND position('safetyReviewComplete' IN fn_def) > 0
     AND position('workAreaCleaned' IN fn_def) > 0,
    'full closeout must require the three required QA items';

  -- The full-mode "still missing" messages must mirror the app's blockers.
  ASSERT position('missing at least one photo' IN fn_def) > 0
     AND position('missing installed systems' IN fn_def) > 0
     AND position('incomplete required QA items' IN fn_def) > 0,
    'full closeout blockers must mirror the app wording';

  -- Sanity: S1 and the importer are untouched by this migration.
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'guard_tech_job_update'
      AND tgrelid = 'public.jobs'::regclass
      AND NOT tgisinternal
  ), 'S1 trigger guard_tech_job_update must still exist';
END $$;
