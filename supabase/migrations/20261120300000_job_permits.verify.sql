-- Verification queries for job_permits migration.
-- Run after applying the migration to confirm correctness.

-- 1. Table exists with expected columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'job_permits'
ORDER BY ordinal_position;

-- 2. RLS is enabled
SELECT relrowsecurity, relforcerowsecurity
FROM pg_class WHERE relname = 'job_permits';

-- 3. Policies exist
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'job_permits';

-- 4. Indexes exist
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'job_permits';

-- 5. Enum values
SELECT enumlabel FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'permit_status'
ORDER BY enumsortorder;
