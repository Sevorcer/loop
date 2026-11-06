-- Verify: 20261126500000_ledger_material_line_link
-- Read-only assertions; run after the migration is applied.

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_transactions'
      AND column_name = 'material_line_id' AND is_nullable = 'YES'
  ), 'inventory_transactions.material_line_id must exist and be nullable';

  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_transactions_line_same_org_fkey' AND confdeltype = 'r'
  ), 'the line link must be a same-org FK with ON DELETE RESTRICT (the ledger is append-only)';

  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_txn_line_link' AND NOT tgisinternal
  ), 'the line-link guard trigger must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_txn_no_update_delete' AND NOT tgisinternal
  ), 'the ledger immutability trigger must still exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_txn_apply' AND NOT tgisinternal
  ), 'the stock-cache trigger must still exist';

  ASSERT NOT has_table_privilege('authenticated', 'public.inventory_transactions', 'UPDATE'),
    'the ledger stays append-only: no UPDATE';
  ASSERT NOT has_table_privilege('authenticated', 'public.inventory_transactions', 'DELETE'),
    'the ledger stays append-only: no DELETE';

  ASSERT NOT has_function_privilege('authenticated', 'public.fn_inventory_txn_line_link()', 'EXECUTE'),
    'the guard trigger function must not be callable';

  ASSERT has_function_privilege('authenticated', 'public.pull_job_materials(uuid, uuid)', 'EXECUTE'),
    'pull_job_materials must be callable by authenticated';
  ASSERT has_function_privilege('authenticated', 'public.return_pallet_to_shop(uuid, text)', 'EXECUTE'),
    'return_pallet_to_shop must be callable by authenticated';
  ASSERT has_function_privilege('authenticated', 'public.ensure_job_location(uuid)', 'EXECUTE'),
    'ensure_job_location must be callable by authenticated';
  ASSERT NOT has_function_privilege('anon', 'public.pull_job_materials(uuid, uuid)', 'EXECUTE'),
    'anon must not call pull_job_materials';
  ASSERT NOT has_function_privilege('anon', 'public.return_pallet_to_shop(uuid, text)', 'EXECUTE'),
    'anon must not call return_pallet_to_shop';

  -- The functions must run as the caller so RLS applies.
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('pull_job_materials', 'return_pallet_to_shop', 'ensure_job_location', 'remove_material_line')
      AND p.prosecdef
  ), 'pull / return / ensure / remove must be SECURITY INVOKER';

  ASSERT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'inventory_stranded_pallets' AND c.relkind = 'v'
      AND c.reloptions::text LIKE '%security_invoker=true%'
  ), 'inventory_stranded_pallets must be a security_invoker view';
  ASSERT NOT has_table_privilege('anon', 'public.inventory_stranded_pallets', 'SELECT'),
    'anon must not read inventory_stranded_pallets';

  ASSERT (SELECT count(*) FROM public.inventory_transactions WHERE material_line_id IS NOT NULL) >= 0,
    'material_line_id is queryable';
END; $$;
