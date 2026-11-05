-- Verify: job_change_orders table creation
-- Expect: table exists with correct columns, RLS enabled, org_isolation policy,
-- two indexes on job_id and org_id.

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'job_change_orders'
ORDER BY ordinal_position;

SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'job_change_orders'
ORDER BY policyname;

SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'job_change_orders';

SELECT indexname
FROM pg_indexes
WHERE tablename = 'job_change_orders'
ORDER BY indexname;
