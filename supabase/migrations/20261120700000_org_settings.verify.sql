-- Verify: org_settings
-- Expect: table exists with PK (org_id, key); RLS enabled; one org-isolation
-- policy. Run after 20261120700000_org_settings.sql.

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'org_settings';

SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'org_settings';

SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'org_settings';
