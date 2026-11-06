-- Verify: 20261127000000_inventory_vehicle_operators
-- Read-only assertions. Run after the migration is applied.

-- Table + RLS (ENABLE and FORCE)
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vehicle_operators'
  ), 'vehicle_operators must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'vehicle_operators'
      AND c.relrowsecurity
      AND c.relforcerowsecurity
  ), 'RLS must be ENABLED and FORCED on vehicle_operators';
END; $$;

-- Columns
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_operators'
      AND column_name = 'vehicle_id' AND data_type = 'uuid' AND is_nullable = 'NO'
  ), 'vehicle_operators.vehicle_id must be uuid (nullable=NO)';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_operators'
      AND column_name = 'user_id' AND data_type = 'uuid' AND is_nullable = 'NO'
  ), 'vehicle_operators.user_id must be uuid (nullable=NO)';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_operators'
      AND column_name = 'is_home' AND data_type = 'boolean' AND is_nullable = 'NO'
  ), 'vehicle_operators.is_home must be boolean (nullable=NO)';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_operators'
      AND column_name = 'org_id' AND data_type = 'uuid' AND is_nullable = 'NO'
  ), 'vehicle_operators.org_id must be uuid (nullable=NO)';
END; $$;

-- Indexes named in the plan
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'vehicle_operators'
      AND indexname = 'vehicle_operators_one_home_uidx'
  ), 'vehicle_operators_one_home_uidx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'vehicle_operators'
      AND indexname = 'vehicle_operators_org_user_idx'
  ), 'vehicle_operators_org_user_idx (org_id, user_id) must exist';
END; $$;

-- Policies by exact name
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vehicle_operators'
      AND policyname = 'vehicle_operators: read for ops and self' AND cmd = 'SELECT'
  ), 'vehicle_operators: read for ops and self must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vehicle_operators'
      AND policyname = 'vehicle_operators: insert for office+' AND cmd = 'INSERT'
  ), 'vehicle_operators: insert for office+ must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vehicle_operators'
      AND policyname = 'vehicle_operators: update for office+' AND cmd = 'UPDATE'
  ), 'vehicle_operators: update for office+ must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vehicle_operators'
      AND policyname = 'vehicle_operators: delete for owner' AND cmd = 'DELETE'
  ), 'vehicle_operators: delete for owner must exist';
END; $$;

-- Helper exists. Stock cache writes stay revoked (unchanged from Lane 1).
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'fn_inventory_visible_vehicle_ids'
      AND p.prosecdef
      AND 'search_path=public' = ANY (p.proconfig)
  ), 'fn_inventory_visible_vehicle_ids must exist as SECURITY DEFINER with search_path=public';
  ASSERT has_function_privilege('authenticated', 'public.fn_inventory_visible_vehicle_ids()', 'EXECUTE'),
    'authenticated must be able to execute fn_inventory_visible_vehicle_ids';
  ASSERT NOT has_function_privilege('anon', 'public.fn_inventory_visible_vehicle_ids()', 'EXECUTE'),
    'anon must not execute fn_inventory_visible_vehicle_ids';
  ASSERT NOT has_table_privilege('authenticated', 'public.inventory_stock_levels', 'INSERT'),
    'authenticated must not INSERT into inventory_stock_levels';
  ASSERT NOT has_table_privilege('authenticated', 'public.inventory_stock_levels', 'UPDATE'),
    'authenticated must not UPDATE inventory_stock_levels';
  ASSERT NOT has_table_privilege('authenticated', 'public.inventory_stock_levels', 'DELETE'),
    'authenticated must not DELETE from inventory_stock_levels';
  ASSERT NOT has_table_privilege('anon', 'public.vehicle_operators', 'SELECT'),
    'anon must not read vehicle_operators';
END; $$;
