-- Asserts time off and calendar tasks exist, with org RLS and tech scope.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'time_off'
  ), 'time_off must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'time_off'
      AND column_name IN ('user_id', 'starts_at', 'ends_at', 'all_day', 'reason', 'note')
    HAVING count(*) = 6
  ), 'time_off must store who, when, all-day, reason, and note';

  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'time_off_ends_after_start'
  ), 'time_off must require the end to be after the start';

  ASSERT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'time_off'
      AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be enabled and forced on time_off';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'time_off' AND policyname = 'time_off: office read'
  ), 'office must be able to read time off';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'time_off'
      AND policyname = 'time_off: tech reads own'
      AND qual ILIKE '%auth.uid()%'
  ), 'techs must read only their own time off';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'time_off' AND policyname = 'time_off: office delete'
  ), 'office must be able to delete time off';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'time_off'
      AND policyname ILIKE '%tech%'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ), 'techs must not insert, update, or delete time off';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'calendar_tasks'
  ), 'calendar_tasks must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'calendar_tasks'
      AND column_name IN (
        'title', 'description', 'starts_at', 'ends_at', 'all_day',
        'assign_everyone', 'job_id', 'customer_id', 'done_at'
      )
    HAVING count(*) = 9
  ), 'calendar_tasks must store the schedule, assignment flag, links, and done time';

  ASSERT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'calendar_tasks'
      AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be enabled and forced on calendar_tasks';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calendar_tasks'
      AND policyname = 'calendar_tasks: tech reads assigned'
      AND qual ILIKE '%tech_can_see_calendar_task%'
  ), 'techs must read tasks assigned to them or to everyone';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calendar_tasks'
      AND policyname = 'calendar_tasks: tech marks done'
      AND cmd = 'UPDATE'
  ), 'techs must be able to update an assigned task so they can mark it done';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calendar_tasks'
      AND policyname = 'calendar_tasks: office delete'
  ), 'office must be able to delete calendar tasks';

  ASSERT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'guard_tech_calendar_task_update'
  ), 'tech task updates must be guarded';

  ASSERT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'tech_can_see_calendar_task'
      AND prosecdef
  ), 'tech visibility must be checked without re-entering row security';

  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'guard_tech_calendar_task_update'
      AND tgrelid = 'public.calendar_tasks'::regclass
  ), 'the tech guard trigger must be on calendar_tasks';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'calendar_task_assignees'
  ), 'calendar_task_assignees must exist';

  ASSERT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'calendar_task_assignees'
      AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be enabled and forced on calendar_task_assignees';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calendar_task_assignees'
      AND policyname = 'calendar_task_assignees: tech reads visible'
  ), 'techs must read assignees on tasks they can see';
END $$;
