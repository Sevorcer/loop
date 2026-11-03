-- Read-only checks for the INSERT-path completion gate migration.
-- Run after 20261111000000_job_completion_gate_insert.sql. This file changes nothing.
--
-- Structural assertions (matching the house verify style): both triggers are
-- bound to the shared function, and the function is TG_OP-aware so the INSERT
-- path is covered. Behavioural coverage of the gate matrix lives in the Vitest
-- suite; this proves the wiring.

DO $$
DECLARE
  fn_def text;
BEGIN
  -- Shared function still exists.
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'guard_job_completion_gate'
      AND pronamespace = 'public'::regnamespace
  ), 'function public.guard_job_completion_gate() must exist';

  -- The BEFORE UPDATE trigger from 20261110000000 must still be present.
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'guard_job_completion_gate'
      AND tgrelid = 'public.jobs'::regclass
      AND NOT tgisinternal
      AND (tgtype & 2) <> 0    -- BEFORE
      AND (tgtype & 16) <> 0   -- UPDATE
  ), 'BEFORE UPDATE trigger guard_job_completion_gate must still exist';

  -- The new BEFORE INSERT trigger must exist and be bound to the same function.
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgname = 'guard_job_completion_gate_insert'
      AND t.tgrelid = 'public.jobs'::regclass
      AND NOT t.tgisinternal
      AND (t.tgtype & 2) <> 0  -- BEFORE
      AND (t.tgtype & 4) <> 0  -- INSERT
      AND p.proname = 'guard_job_completion_gate'
  ), 'BEFORE INSERT trigger guard_job_completion_gate_insert must exist and use the shared function';

  fn_def := pg_get_functiondef('public.guard_job_completion_gate()'::regprocedure);

  -- TG_OP-aware: INSERT reads the schedule from NEW, UPDATE from OLD.
  ASSERT position('TG_OP = ''INSERT''' IN fn_def) > 0,
    'function must branch on TG_OP for the INSERT schedule path';
  ASSERT position('NEW.scheduled_start_at' IN fn_def) > 0
     AND position('OLD.scheduled_start_at' IN fn_def) > 0,
    'B1 must read NEW schedule on INSERT and OLD schedule on UPDATE';

  -- The tech closeout_mode lock is UPDATE-scoped (INSERT-safe).
  ASSERT position('TG_OP = ''UPDATE''' IN fn_def) > 0
     AND position('closeout mode' IN fn_def) > 0,
    'tech closeout_mode lock must be scoped to UPDATE';

  -- Importer / service-role safety preserved.
  ASSERT position('v_role IS NULL' IN fn_def) > 0,
    'gate must still no-op when current_app_role() is NULL';

  -- Entry-into-Completed test preserved (works for INSERT via OLD = NULL).
  ASSERT position('OLD.status IS DISTINCT FROM ''Completed''' IN fn_def) > 0
     AND position('NEW.status = ''Completed''' IN fn_def) > 0,
    'gate must fire on entry into Completed (INSERT or UPDATE)';

  -- Gate matrix still intact (same checks as 20261110000000).
  ASSERT position('job-signatures' IN fn_def) > 0
     AND position('image/%' IN fn_def) > 0
     AND position('app_role = ''tech''' IN fn_def) > 0,
    'full closeout photo gate must require a non-signature tech image';
  ASSERT position('linked_workflow_ids' IN fn_def) > 0,
    'full closeout must require a linked installed system';
  ASSERT position('startupVerificationComplete' IN fn_def) > 0
     AND position('safetyReviewComplete' IN fn_def) > 0
     AND position('workAreaCleaned' IN fn_def) > 0,
    'full closeout must require the three required QA items';
  ASSERT position('America/Los_Angeles' IN fn_def) > 0
     AND position('final scheduled day' IN fn_def) > 0,
    'B1 multi-day block must remain in the company timezone';

  -- Sanity: S1 untouched.
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'guard_tech_job_update'
      AND tgrelid = 'public.jobs'::regclass
      AND NOT tgisinternal
  ), 'S1 trigger guard_tech_job_update must still exist';
END $$;
