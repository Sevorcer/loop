-- Verification queries for job_inspections + inspection_corrections migration.

-- 1. job_inspections table columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'job_inspections'
ORDER BY ordinal_position;

-- 2. inspection_corrections table columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'inspection_corrections'
ORDER BY ordinal_position;

-- 3. RLS enabled on both tables
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class WHERE relname IN ('job_inspections', 'inspection_corrections');

-- 4. Policies on both tables
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('job_inspections', 'inspection_corrections')
ORDER BY tablename, policyname;

-- 5. Enum values
SELECT enumlabel FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'inspection_result'
ORDER BY enumsortorder;

-- 6. Indexes
SELECT tablename, indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('job_inspections', 'inspection_corrections')
ORDER BY tablename, indexname;

-- 7. Check constraints
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.job_inspections'::regclass
  AND contype = 'c';
