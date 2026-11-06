-- Verify: 20261126300000_expected_arrivals
-- Read-only assertions; run after the migration is applied.

DO $$
BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_expected_arrivals'),
    'inventory_expected_arrivals must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'inventory_expected_arrivals' AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be ENABLED and FORCED on inventory_expected_arrivals';
  ASSERT NOT has_table_privilege('anon', 'public.inventory_expected_arrivals', 'SELECT'), 'anon must have no access';
  ASSERT NOT has_table_privilege('authenticated', 'public.inventory_expected_arrivals', 'TRUNCATE'), 'authenticated must not TRUNCATE';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inventory_expected_arrivals'
      AND (coalesce(qual, '') = 'true' OR coalesce(with_check, '') = 'true')
  ), 'inventory_expected_arrivals must have no unconditional policy';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'inventory_expected_arrivals' AND column_name = 'po_line_id'),
    'po_line_id (Lane 5 hand-off) must exist';
  -- No vendor / price / invoice columns (amendment 5)
  ASSERT NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'inventory_expected_arrivals'
                       AND (column_name LIKE '%price%' OR column_name LIKE '%cost%' OR column_name LIKE '%vendor%' OR column_name LIKE '%invoice%')),
    'no vendor, price, cost or invoice columns';
  ASSERT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND p.proname = 'receive_expected_arrival' AND NOT p.prosecdef),
    'receive_expected_arrival must exist and be SECURITY INVOKER';
  ASSERT NOT has_function_privilege('anon', 'public.receive_expected_arrival(uuid)', 'EXECUTE'),
    'anon must not execute receive_expected_arrival';
  ASSERT (SELECT count(*) FROM public.inventory_expected_arrivals) = 0, 'no arrivals are seeded';
END; $$;
