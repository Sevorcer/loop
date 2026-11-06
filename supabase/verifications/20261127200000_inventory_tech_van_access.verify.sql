-- Verify: 20261127200000_inventory_tech_van_access
-- Read-only assertions. Run after the migration is applied.

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inventory_locations'
      AND policyname = 'inventory_locations: read own van and shop for tech'
      AND cmd = 'SELECT'
      AND qual ILIKE '%fn_inventory_visible_vehicle_ids%'
      AND qual ILIKE '%warehouse%'
  ), 'inventory_locations: read own van and shop for tech must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inventory_stock_levels'
      AND policyname = 'inventory_stock_levels: read own van and shop for tech'
      AND cmd = 'SELECT'
      AND qual ILIKE '%warehouse%'
  ), 'inventory_stock_levels: read own van and shop for tech must exist';
END; $$;

-- No tech grant on the ledger. The policy set stays the Lane 1 pair.
DO $$ BEGIN
  ASSERT (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inventory_transactions'
  ) = 2, 'inventory_transactions must still have exactly two policies';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inventory_transactions'
      AND policyname = 'inventory_transactions: read for ops'
  ), 'inventory_transactions: read for ops must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inventory_transactions'
      AND policyname = 'inventory_transactions: insert for office+'
  ), 'inventory_transactions: insert for office+ must exist';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inventory_transactions'
      AND (
        coalesce(qual, '') ILIKE '%tech%'
        OR coalesce(with_check, '') ILIKE '%tech%'
      )
  ), 'no inventory_transactions policy may grant tech';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'fn_inventory_my_van_activity'
      AND p.prosecdef
      AND 'search_path=public' = ANY (p.proconfig)
      AND p.prosrc NOT ILIKE '%unit_cost_cents%'
  ), 'fn_inventory_my_van_activity must exist and must not read unit_cost_cents';
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'fn_inventory_post_van_entries'
      AND p.prosecdef
      AND 'search_path=public' = ANY (p.proconfig)
  ), 'fn_inventory_post_van_entries must exist as SECURITY DEFINER';
  ASSERT has_function_privilege('authenticated', 'public.fn_inventory_my_van_activity(integer)', 'EXECUTE'),
    'authenticated must be able to execute fn_inventory_my_van_activity';
  ASSERT NOT has_function_privilege('anon', 'public.fn_inventory_my_van_activity(integer)', 'EXECUTE'),
    'anon must not execute fn_inventory_my_van_activity';
  ASSERT has_function_privilege('authenticated', 'public.fn_inventory_post_van_entries(jsonb)', 'EXECUTE'),
    'authenticated must be able to execute fn_inventory_post_van_entries';
  ASSERT NOT has_function_privilege('anon', 'public.fn_inventory_post_van_entries(jsonb)', 'EXECUTE'),
    'anon must not execute fn_inventory_post_van_entries';
  ASSERT NOT has_function_privilege('public', 'public.fn_inventory_post_van_entries(jsonb)', 'EXECUTE'),
    'PUBLIC must not execute fn_inventory_post_van_entries';
END; $$;

-- Activity columns are the cost-free list. job_id and transfer_group_id stay off it.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.parameters
    WHERE specific_schema = 'public'
      AND parameter_name = 'qty_delta'
      AND specific_name IN (
        SELECT specific_name FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'fn_inventory_my_van_activity'
      )
  ), 'fn_inventory_my_van_activity must return qty_delta';
  ASSERT NOT EXISTS (
    SELECT 1 FROM information_schema.parameters
    WHERE specific_schema = 'public'
      AND parameter_name IN ('unit_cost_cents', 'job_id', 'transfer_group_id')
      AND specific_name IN (
        SELECT specific_name FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'fn_inventory_my_van_activity'
      )
  ), 'fn_inventory_my_van_activity must not return cost, job, or transfer group';
END; $$;

-- Private helpers are not callable by anon or authenticated.
DO $$ BEGIN
  ASSERT NOT has_function_privilege('anon', 'private.inventory_post_van_own_van(uuid, uuid)', 'EXECUTE'),
    'anon must not execute private.inventory_post_van_own_van';
  ASSERT NOT has_function_privilege('authenticated', 'private.inventory_post_van_own_van(uuid, uuid)', 'EXECUTE'),
    'authenticated must not execute private.inventory_post_van_own_van';
  ASSERT NOT has_function_privilege('authenticated', 'private.inventory_post_van_reject_privileged(jsonb)', 'EXECUTE'),
    'authenticated must not execute private.inventory_post_van_reject_privileged';
END; $$;

-- catalog_item_costs policies are unchanged: still no tech SELECT.
DO $$ BEGIN
  ASSERT (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'catalog_item_costs'
  ) = 4, 'catalog_item_costs must still have exactly four policies';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'catalog_item_costs'
      AND policyname = 'catalog_item_costs: read for office+'
  ), 'catalog_item_costs: read for office+ must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'catalog_item_costs'
      AND policyname = 'catalog_item_costs: insert for office+'
  ), 'catalog_item_costs: insert for office+ must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'catalog_item_costs'
      AND policyname = 'catalog_item_costs: update for office+'
  ), 'catalog_item_costs: update for office+ must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'catalog_item_costs'
      AND policyname = 'catalog_item_costs: delete for owner'
  ), 'catalog_item_costs: delete for owner must exist';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'catalog_item_costs'
      AND (
        coalesce(qual, '') ILIKE '%tech%'
        OR coalesce(with_check, '') ILIKE '%tech%'
      )
  ), 'catalog_item_costs must still have no tech policy';
END; $$;
