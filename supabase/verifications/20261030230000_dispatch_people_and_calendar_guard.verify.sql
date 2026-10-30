-- People assignment snapshot and calendar-task security.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'crews'
  ), 'crews table must stay';

  ASSERT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'crew_assignments'
  ), 'crew_assignments table must stay';

  ASSERT NOT EXISTS (
    SELECT 1
    FROM pg_proc proc
    JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'public'
      AND proc.proname = 'tech_can_see_calendar_task'
  ), 'tech_can_see_calendar_task must leave the exposed public schema';

  ASSERT EXISTS (
    SELECT 1
    FROM pg_proc proc
    JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'private'
      AND proc.proname = 'tech_can_see_calendar_task'
      AND proc.prosecdef
  ), 'tech visibility helper must live in private as security definer';

  ASSERT NOT has_function_privilege('anon', 'private.tech_can_see_calendar_task(uuid)', 'EXECUTE'),
    'anon must not execute the calendar visibility helper';

  ASSERT NOT has_function_privilege('public', 'private.tech_can_see_calendar_task(uuid)', 'EXECUTE'),
    'public must not execute the calendar visibility helper';

  ASSERT has_function_privilege('authenticated', 'private.tech_can_see_calendar_task(uuid)', 'EXECUTE'),
    'signed-in users need execute so row security can call the helper';

  ASSERT EXISTS (
    SELECT 1
    FROM pg_proc proc
    JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'private'
      AND proc.proname = 'guard_tech_calendar_task_update'
      AND pg_get_functiondef(proc.oid) ILIKE '%NEW.done_by := auth.uid()%'
  ), 'a tech marking a task done must be recorded as auth.uid()';

  ASSERT NOT EXISTS (
    SELECT 1
    FROM pg_proc proc
    JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'public'
      AND proc.proname = 'guard_tech_calendar_task_update'
  ), 'the tech guard must not stay in the exposed public schema';

  ASSERT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'calendar_tasks'
      AND policyname = 'calendar_tasks: tech reads assigned'
      AND qual ILIKE '%private.tech_can_see_calendar_task%'
  ), 'tech task reads must call the private helper';

  ASSERT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'job_completion_team'
  ), 'job_completion_team must exist';

  ASSERT EXISTS (
    SELECT 1
    FROM pg_class class
    JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'public'
      AND class.relname = 'job_completion_team'
      AND class.relrowsecurity
      AND class.relforcerowsecurity
  ), 'RLS must be enabled and forced on job_completion_team';

  ASSERT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_completion_team'
      AND policyname = 'job_completion_team: read'
      AND qual ILIKE '%tech%'
  ), 'techs must have a scoped read of the completion team';

  ASSERT NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_completion_team'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ), 'clients must not write the completion snapshot';

  ASSERT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'snapshot_job_completion_team'
      AND tgrelid = 'public.jobs'::regclass
  ), 'completing a job must snapshot its team';

  ASSERT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'job_completion_team_job_user_uidx'
  ), 'a person is snapshotted once per job';
END $$;
