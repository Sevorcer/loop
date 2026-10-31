-- Asserts the role lock and the staff write limits. Read policies stay.
DO $$ BEGIN
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname IN ('insert own profile', 'read own profile', 'update own profile')
  ), 'dashboard self-service profile policies must be gone';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname = 'user_profiles: user updates own name'
      AND cmd = 'UPDATE'
  ), 'a person may still update their own profile row';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname = 'user_profiles: manager can update'
      AND qual ILIKE '%manager%'
  ), 'a manager may update a profile in their company';

  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'guard_user_profile_write'
      AND NOT tgisinternal
  ), 'user profile writes must pass the guard trigger';

  ASSERT NOT has_table_privilege('anon', 'public.user_profiles', 'SELECT'),
    'anon must not read user_profiles';
  ASSERT NOT has_table_privilege('anon', 'public.user_profiles', 'INSERT'),
    'anon must not insert user_profiles';
  ASSERT NOT has_table_privilege('anon', 'public.user_profiles', 'UPDATE'),
    'anon must not update user_profiles';
  ASSERT NOT has_column_privilege('authenticated', 'public.user_profiles', 'app_role', 'UPDATE'),
    'a signed-in user must not have column update on app_role';
  ASSERT NOT has_column_privilege('authenticated', 'public.user_profiles', 'org_id', 'UPDATE'),
    'a signed-in user must not have column update on org_id';
  ASSERT has_column_privilege('authenticated', 'public.user_profiles', 'full_name', 'UPDATE'),
    'a signed-in user may still update full_name';
  ASSERT NOT has_table_privilege('authenticated', 'public.user_profiles', 'INSERT'),
    'a signed-in user must not insert a profile directly';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_assignees'
      AND policyname = 'job_assignees: org insert'
      AND with_check ILIKE '%''office''%'
      AND with_check ILIKE '%''dispatch''%'
      AND with_check NOT ILIKE '%''sales''%'
      AND with_check NOT ILIKE '%''tech''%'
  ), 'only office roles may add a job assignee';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_assignees'
      AND policyname = 'job_assignees: org delete'
      AND qual ILIKE '%''office''%'
      AND qual NOT ILIKE '%''sales''%'
      AND qual NOT ILIKE '%''tech''%'
  ), 'only office roles may remove a job assignee';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_assignees'
      AND policyname = 'job_assignees: org read'
  ), 'job assignee read access must remain';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_tasks'
      AND policyname = 'job_tasks: org all'
      AND cmd = 'SELECT'
      AND qual ILIKE '%current_org_id()%'
  ), 'job_tasks org all must be read-only';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_tasks'
      AND policyname = 'job_tasks: insert for owner/manager/office'
      AND with_check ILIKE '%''dispatch''%'
      AND with_check NOT ILIKE '%''tech''%'
      AND with_check NOT ILIKE '%''sales''%'
  ), 'office roles including dispatch may add a task';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_tasks'
      AND policyname = 'job_tasks: tech updates tasks on assigned jobs'
      AND cmd = 'UPDATE'
      AND qual ILIKE '%caller_is_assigned_to_job%'
  ), 'a technician may update a task only on an assigned job';

  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'guard_tech_job_task_update'
      AND NOT tgisinternal
  ), 'technician task updates must be limited to checking the item off';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dispatch_plans'
      AND policyname = 'dispatch_plans: org read'
  ), 'dispatch plan read access must remain';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dispatch_plans'
      AND policyname = 'dispatch_plans: org write'
      AND with_check ILIKE '%''office''%'
      AND with_check ILIKE '%''dispatch''%'
      AND with_check NOT ILIKE '%''tech''%'
      AND with_check NOT ILIKE '%''sales''%'
  ), 'office roles write dispatch plans';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dispatch_plans'
      AND policyname = 'dispatch_plans: tech updates assigned job status'
      AND cmd = 'UPDATE'
      AND qual ILIKE '%caller_is_assigned_to_job%'
  ), 'a technician may update dispatch status on an assigned job';

  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'guard_tech_dispatch_plan_update'
      AND NOT tgisinternal
  ), 'technician dispatch updates must be limited to status';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'installed_systems'
      AND policyname = 'installed_systems: org read'
  ), 'installed system read access must remain';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'installed_systems'
      AND policyname = 'installed_systems: org write'
      AND with_check ILIKE '%''office''%'
      AND with_check NOT ILIKE '%''tech''%'
      AND with_check NOT ILIKE '%''sales''%'
  ), 'office roles write installed systems';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'installed_systems'
      AND policyname = 'installed_systems: tech inserts field equipment'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%caller_is_assigned_to_job%'
  ), 'a technician may add equipment on an assigned job';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'installed_systems'
      AND policyname = 'installed_systems: tech updates field equipment'
      AND cmd = 'UPDATE'
  ), 'a technician may update field equipment';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'installed_systems'
      AND cmd = 'DELETE'
      AND qual ILIKE '%''tech''%'
  ), 'a technician must not have a delete policy on installed systems';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM pg_proc proc
    JOIN pg_namespace nsp ON nsp.oid = proc.pronamespace
    WHERE nsp.nspname = 'public'
      AND proc.proname = 'dbhc_rls_coverage'
      AND proc.proconfig::text ILIKE '%search_path=public%'
  ), 'dbhc_rls_coverage must pin search_path';

  ASSERT NOT has_function_privilege('anon', 'public.dbhc_rls_coverage()', 'EXECUTE'),
    'anon must not execute dbhc_rls_coverage';
  ASSERT NOT has_function_privilege('anon', 'public.dbhc_null_org_id()', 'EXECUTE'),
    'anon must not execute dbhc_null_org_id';
  ASSERT has_function_privilege('service_role', 'public.dbhc_rls_coverage()', 'EXECUTE'),
    'the service role must still run health checks';
END; $$;
