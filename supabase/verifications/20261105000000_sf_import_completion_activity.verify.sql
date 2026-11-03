-- Read-only checks for the Service Fusion import completion-activity backdate.
-- Run after 20261105000000_sf_import_completion_activity.sql. Changes nothing.

DO $$
DECLARE
  def text := pg_get_functiondef('public.sf_import_apply_batch(jsonb)'::regprocedure);
BEGIN
  -- The importer must write the same completion signal the dashboards prefer
  -- and that native completion writes: type 'status', title 'Job completed'.
  ASSERT position($q$'status', 'Job completed'$q$ IN def) > 0,
    'the importer must emit the native completion activity (type status, title Job completed)';

  -- It must date the event to the real Service Fusion completion time, not now().
  ASSERT position('r.completed_at' IN def) > 0,
    'the completion event must be dated to the real SF completion time (completed_at)';

  -- It must only emit for Completed jobs that actually carry a timestamp — no
  -- fabricated dates.
  ASSERT position($q$r.status = 'Completed'$q$ IN def) > 0,
    'the completion event must be gated on a Completed status';
  ASSERT position('r.completed_at IS NOT NULL' IN def) > 0,
    'a completed job without a real timestamp must emit no event';

  -- Idempotency: a re-import (or a job already completed natively) must not gain
  -- a duplicate completion row.
  ASSERT position('NOT EXISTS' IN def) > 0,
    'the completion event must be guarded against duplicates on re-import';

  -- The jobs upsert must still stamp updated_at = now() (unchanged behavior).
  ASSERT position('updated_at = now()' IN def) > 0,
    'the jobs upsert must keep stamping updated_at = now()';

  -- Access controls from the prior migration must survive the CREATE OR REPLACE.
  ASSERT NOT has_function_privilege('anon', 'public.sf_import_apply_batch(jsonb)', 'EXECUTE'),
    'anon must not run the importer';
  ASSERT NOT has_function_privilege('authenticated', 'public.sf_import_apply_batch(jsonb)', 'EXECUTE'),
    'a signed-in user must not run the importer directly';
END $$;
