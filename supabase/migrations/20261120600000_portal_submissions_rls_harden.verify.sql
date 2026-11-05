-- Verify: portal_submissions RLS harden

DO $$
DECLARE
  force_on boolean;
  bad_insert_policies int;
  anon_insert int;
BEGIN
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE relname = 'portal_submissions'),
    'RLS must remain enabled on portal_submissions';

  SELECT relforcerowsecurity INTO force_on
  FROM pg_class WHERE relname = 'portal_submissions';
  ASSERT force_on, 'FORCE RLS must be enabled on portal_submissions';

  SELECT COUNT(*) INTO bad_insert_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'portal_submissions'
    AND cmd = 'INSERT'
    AND with_check = 'true';
  ASSERT bad_insert_policies = 0,
    'No WITH CHECK (true) INSERT policies may remain on portal_submissions';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'portal_submissions'
      AND policyname = 'service_insert_portal_submissions'
  ), 'service_insert_portal_submissions policy must be dropped';

  SELECT COUNT(*) INTO anon_insert
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'portal_submissions'
    AND grantee = 'anon'
    AND privilege_type = 'INSERT';
  ASSERT anon_insert = 0, 'anon must not have INSERT on portal_submissions';

  RAISE NOTICE 'portal_submissions RLS harden verification passed';
END $$;
