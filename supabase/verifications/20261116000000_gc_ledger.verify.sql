-- Verification queries for 20261116000000_gc_ledger.sql
-- Run these after applying the migration to verify it was applied correctly.

-- 1. Verify gc_ledger_entries table exists with correct columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'gc_ledger_entries'
ORDER BY ordinal_position;

-- Expected columns:
--   id            | uuid      | NO  | gen_random_uuid()
--   org_id        | uuid      | NO  |
--   job_id        | uuid      | NO  |
--   estimate_number | text    | NO  | ''::text
--   gc_po_number  | text      | NO  | ''::text
--   date_sent     | date      | YES |
--   date_received | date      | YES |
--   balance_cents | bigint    | NO  | 0
--   retainer_cents| bigint    | NO  | 0
--   notes         | text      | NO  | ''::text
--   created_at    | timestamptz | NO | now()
--   updated_at    | timestamptz | NO | now()

-- 2. Verify gc_change_orders table exists with correct columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'gc_change_orders'
ORDER BY ordinal_position;

-- Expected columns:
--   id                  | uuid      | NO  | gen_random_uuid()
--   org_id              | uuid      | NO  |
--   ledger_entry_id     | uuid      | NO  |
--   change_order_number | text      | NO  | ''::text
--   amount_cents        | bigint    | NO  | 0
--   description         | text      | NO  | ''::text
--   created_at          | timestamptz | NO | now()

-- 3. Verify UNIQUE constraint on gc_ledger_entries.job_id
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'gc_ledger_entries' AND constraint_type = 'UNIQUE';

-- 4. Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('gc_ledger_entries', 'gc_change_orders');

-- Expected: both have rowsecurity = true

-- 5. Verify policies exist
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('gc_ledger_entries', 'gc_change_orders')
ORDER BY tablename, policyname;

-- Expected 8 policies:
--   gc_change_orders  | gc_change_orders_office_insert  | INSERT
--   gc_change_orders  | gc_change_orders_office_update  | UPDATE
--   gc_change_orders  | gc_change_orders_org_select     | SELECT
--   gc_change_orders  | gc_change_orders_owner_delete   | DELETE
--   gc_ledger_entries | gc_ledger_entries_office_insert  | INSERT
--   gc_ledger_entries | gc_ledger_entries_office_update  | UPDATE
--   gc_ledger_entries | gc_ledger_entries_org_select     | SELECT
--   gc_ledger_entries | gc_ledger_entries_owner_delete   | DELETE

-- 6. Verify foreign keys
SELECT tc.constraint_name, tc.table_name, kcu.column_name,
       ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('gc_ledger_entries', 'gc_change_orders');

-- Expected:
--   gc_ledger_entries.org_id -> organizations.id
--   gc_ledger_entries.job_id -> jobs.id (ON DELETE CASCADE)
--   gc_change_orders.org_id -> organizations.id
--   gc_change_orders.ledger_entry_id -> gc_ledger_entries.id (ON DELETE CASCADE)

-- 7. Verify indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('gc_ledger_entries', 'gc_change_orders')
ORDER BY tablename, indexname;
