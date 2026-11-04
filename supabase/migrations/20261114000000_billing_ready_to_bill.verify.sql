-- Verification: 20261114000000_billing_ready_to_bill
-- Run after migration to confirm columns and constraints exist.

-- 1. Columns exist with correct types
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'jobs'
  AND column_name IN ('billing_status', 'billing_eligible', 'qb_invoice_number', 'billed_at', 'billed_by')
ORDER BY column_name;

-- Expected:
--  billed_at          | date    | YES | null
--  billed_by          | uuid    | YES | null
--  billing_eligible   | boolean | NO  | false
--  billing_status     | text    | NO  | 'unbilled'::text
--  qb_invoice_number  | text    | YES | null

-- 2. CHECK constraint exists
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'jobs'::regclass
  AND conname = 'jobs_billing_status_check';

-- Expected: jobs_billing_status_check | CHECK ((billing_status = ANY (ARRAY['unbilled'::text, 'billed'::text, 'excluded'::text])))

-- 3. Index exists
SELECT indexname
FROM pg_indexes
WHERE tablename = 'jobs'
  AND indexname = 'idx_jobs_billing_ready';

-- Expected: idx_jobs_billing_ready

-- 4. Historical jobs default to not eligible (spot check)
SELECT count(*) AS historical_eligible
FROM jobs
WHERE billing_eligible = true;

-- Expected: 0 (no existing rows should be eligible after migration)
