-- Asserts technician property scope, office dispatch writes, and the job edit guard.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'properties'
      AND policyname = 'properties: tech reads properties on assigned jobs'
  ), 'properties: tech reads properties on assigned jobs must exist';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'properties'
      AND policyname = 'properties: read for internal operational roles'
  ), 'properties read policy must exist';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'properties'
      AND policyname = 'properties: read for internal operational roles'
      AND qual ILIKE '%''tech''%'
  ), 'the broad properties read policy must not include tech';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'crew_assignments'
      AND policyname = 'crew_assignments: org write'
      AND with_check ILIKE '%office%'
  ), 'office must be able to write crew assignments';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'schedule_blocks'
      AND policyname = 'schedule_blocks: org write'
      AND with_check ILIKE '%office%'
  ), 'office must be able to write schedule blocks';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dispatch_events'
      AND policyname = 'dispatch_events: org insert'
      AND with_check ILIKE '%office%'
  ), 'office must be able to insert dispatch events';

  ASSERT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'jobs'
      AND t.tgname = 'guard_tech_job_update'
      AND NOT t.tgisinternal
  ), 'guard_tech_job_update trigger must exist on jobs';
END; $$;
