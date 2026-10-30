-- Asserts price triggers run as their owner and company checks name the right row.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM pg_proc proc
    JOIN pg_namespace ns ON ns.oid = proc.pronamespace
    WHERE ns.nspname = 'private'
      AND proc.proname = 'enforce_job_price_same_company'
      AND proc.prosecdef
      AND proc.proconfig::text ILIKE '%search_path=%'
      AND proc.proconfig::text NOT ILIKE '%public%'
  ), 'the job price trigger must be security definer with an empty search path';

  ASSERT EXISTS (
    SELECT 1
    FROM pg_proc proc
    JOIN pg_namespace ns ON ns.oid = proc.pronamespace
    WHERE ns.nspname = 'private'
      AND proc.proname = 'enforce_calendar_group_member_same_company'
      AND proc.prosecdef
      AND proc.proconfig::text ILIKE '%search_path=%'
      AND proc.proconfig::text NOT ILIKE '%public%'
  ), 'the calendar group trigger must be security definer with an empty search path';

  ASSERT NOT has_function_privilege('anon', 'private.enforce_job_price_same_company()', 'EXECUTE'),
    'anonymous users must not call the job price trigger function';
  ASSERT NOT has_function_privilege('authenticated', 'private.enforce_job_price_same_company()', 'EXECUTE'),
    'signed-in users must not call the job price trigger function directly';
  ASSERT NOT has_function_privilege('anon', 'private.enforce_calendar_group_member_same_company()', 'EXECUTE'),
    'anonymous users must not call the calendar group trigger function';
  ASSERT NOT has_function_privilege('authenticated', 'private.enforce_calendar_group_member_same_company()', 'EXECUTE'),
    'signed-in users must not call the calendar group trigger function directly';

  ASSERT EXISTS (
    SELECT 1
    FROM pg_proc proc
    JOIN pg_namespace ns ON ns.oid = proc.pronamespace
    WHERE ns.nspname = 'public'
      AND proc.proname = 'current_app_role'
      AND pg_get_function_identity_arguments(proc.oid) = ''
      AND proc.proconfig::text ILIKE '%search_path=public%'
  ), 'current_app_role() must resolve user_profiles on the public search path';

  ASSERT EXISTS (
    SELECT 1
    FROM pg_proc proc
    JOIN pg_namespace ns ON ns.oid = proc.pronamespace
    WHERE ns.nspname = 'public'
      AND proc.proname = 'current_org_id'
      AND pg_get_function_identity_arguments(proc.oid) = ''
      AND proc.proconfig::text ILIKE '%search_path=public%'
  ), 'current_org_id() must resolve user_profiles on the public search path';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_financials'
      AND policyname = 'job_financials: finance insert'
      AND with_check ILIKE '%priced_job.org_id = job_financials.org_id%'
      AND with_check ILIKE '%owner%'
  ), 'an owner insert must compare the price row company to the job company';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'calendar_saved_group_members'
      AND policyname = 'calendar_saved_group_members: office insert'
      AND with_check ILIKE '%member_profile.org_id = calendar_saved_group_members.org_id%'
  ), 'a group member company must be the member row company, not the profile column compared to itself';
END; $$;
