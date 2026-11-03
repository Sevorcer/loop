-- Asserts the four flagged trigger functions carry a pinned search_path and
-- that handle_new_user() is no longer EXECUTE-able by public/anon/authenticated.
DO $$ BEGIN
  -- All four functions must have a non-empty proconfig search_path.
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc proc
    JOIN pg_namespace ns ON ns.oid = proc.pronamespace
    WHERE ns.nspname = 'public' AND proc.proname = 'set_updated_at'
      AND pg_get_function_identity_arguments(proc.oid) = ''
      AND proc.proconfig::text ILIKE '%search_path=public%'
  ), 'set_updated_at() must have search_path pinned to public';

  ASSERT EXISTS (
    SELECT 1 FROM pg_proc proc
    JOIN pg_namespace ns ON ns.oid = proc.pronamespace
    WHERE ns.nspname = 'public' AND proc.proname = 'fn_set_updated_at'
      AND pg_get_function_identity_arguments(proc.oid) = ''
      AND proc.proconfig::text ILIKE '%search_path=public%'
  ), 'fn_set_updated_at() must have search_path pinned to public';

  ASSERT EXISTS (
    SELECT 1 FROM pg_proc proc
    JOIN pg_namespace ns ON ns.oid = proc.pronamespace
    WHERE ns.nspname = 'public' AND proc.proname = 'guard_tech_job_update'
      AND pg_get_function_identity_arguments(proc.oid) = ''
      AND proc.proconfig::text ILIKE '%search_path=public%'
  ), 'guard_tech_job_update() must have search_path pinned to public';

  ASSERT EXISTS (
    SELECT 1 FROM pg_proc proc
    JOIN pg_namespace ns ON ns.oid = proc.pronamespace
    WHERE ns.nspname = 'public' AND proc.proname = 'guard_tech_installed_system_warranty'
      AND pg_get_function_identity_arguments(proc.oid) = ''
      AND proc.proconfig::text ILIKE '%search_path=public%'
  ), 'guard_tech_installed_system_warranty() must have search_path pinned to public';

  -- handle_new_user() must not be callable as an RPC.
  ASSERT NOT has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE'),
    'anonymous users must not be able to execute handle_new_user()';
  ASSERT NOT has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'),
    'signed-in users must not be able to execute handle_new_user()';
  ASSERT NOT has_function_privilege('public', 'public.handle_new_user()', 'EXECUTE'),
    'PUBLIC must not be able to execute handle_new_user()';

  -- current_app_role()/current_org_id() are intentionally still executable.
  ASSERT has_function_privilege('authenticated', 'public.current_app_role()', 'EXECUTE'),
    'current_app_role() must stay executable for the app/RLS';
  ASSERT has_function_privilege('authenticated', 'public.current_org_id()', 'EXECUTE'),
    'current_org_id() must stay executable for the app/RLS';
END; $$;
