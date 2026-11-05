-- Verify: 20261121200000_technical_profiles_write_roles (read-only)
DO $$
DECLARE
  n integer;
BEGIN
  -- the old org-wide FOR ALL policy is gone
  SELECT count(*) INTO n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'technical_profiles' AND cmd = 'ALL';
  IF n <> 0 THEN RAISE EXCEPTION 'technical_profiles still has a FOR ALL policy (%)', n; END IF;

  -- exactly one policy per write command, each limited to office-type roles
  SELECT count(*) INTO n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'technical_profiles'
     AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
     AND roles = '{authenticated}'
     AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%office%'
     AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%dispatch%'
     AND (coalesce(qual, '') || coalesce(with_check, '')) NOT LIKE '%tech%';
  IF n <> 3 THEN RAISE EXCEPTION 'expected 3 office-only write policies on technical_profiles, found %', n; END IF;

  SELECT count(*) INTO n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'technical_profiles' AND cmd = 'DELETE'
     AND coalesce(qual, '') NOT LIKE '%current_app_role%';
  IF n <> 0 THEN RAISE EXCEPTION 'technical_profiles DELETE must check the role'; END IF;

  -- read policy untouched
  SELECT count(*) INTO n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'technical_profiles' AND cmd = 'SELECT';
  IF n <> 1 THEN RAISE EXCEPTION 'technical_profiles read policy missing (%)', n; END IF;

  IF has_table_privilege('anon', 'public.technical_profiles', 'DELETE')
     OR has_table_privilege('anon', 'public.technical_profiles', 'INSERT') THEN
    RAISE EXCEPTION 'anon still has write privileges on technical_profiles';
  END IF;

  RAISE NOTICE 'technical_profiles_write_roles verify OK';
END $$;
