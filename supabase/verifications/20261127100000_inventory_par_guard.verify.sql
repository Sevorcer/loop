-- Verify: 20261127100000_inventory_par_guard
-- Read-only assertions. Run after the migration is applied.

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'fn_inventory_set_par'
      AND p.prosecdef
      AND 'search_path=public' = ANY (p.proconfig)
  ), 'fn_inventory_set_par must exist as SECURITY DEFINER with search_path=public';
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'fn_inventory_stock_levels_guard'
      AND p.prosecdef
  ), 'fn_inventory_stock_levels_guard must exist';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'inventory_stock_levels'
      AND t.tgname = 'trg_inventory_stock_levels_guard'
      AND NOT t.tgisinternal
  ), 'trg_inventory_stock_levels_guard must exist on inventory_stock_levels';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_stock_levels'
      AND column_name = 'min_qty' AND data_type = 'numeric' AND is_nullable = 'YES'
  ), 'inventory_stock_levels.min_qty must still be a nullable numeric';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_stock_levels'
      AND column_name = 'max_qty' AND data_type = 'numeric' AND is_nullable = 'YES'
  ), 'inventory_stock_levels.max_qty must still be a nullable numeric';
END; $$;

DO $$ BEGIN
  ASSERT NOT has_table_privilege('authenticated', 'public.inventory_stock_levels', 'INSERT'),
    'authenticated must not INSERT into inventory_stock_levels';
  ASSERT NOT has_table_privilege('authenticated', 'public.inventory_stock_levels', 'UPDATE'),
    'authenticated must not UPDATE inventory_stock_levels';
  ASSERT NOT has_table_privilege('authenticated', 'public.inventory_stock_levels', 'DELETE'),
    'authenticated must not DELETE from inventory_stock_levels';
  ASSERT NOT has_table_privilege('authenticated', 'public.inventory_stock_levels', 'TRUNCATE'),
    'authenticated must not TRUNCATE inventory_stock_levels';
  ASSERT has_function_privilege('authenticated', 'public.fn_inventory_set_par(uuid, uuid, numeric, numeric)', 'EXECUTE'),
    'authenticated must be able to execute fn_inventory_set_par';
  ASSERT NOT has_function_privilege('anon', 'public.fn_inventory_set_par(uuid, uuid, numeric, numeric)', 'EXECUTE'),
    'anon must not execute fn_inventory_set_par';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'fn_inventory_txn_apply'
      AND p.prosrc ILIKE '%inventory.ledger_apply%'
      AND p.prosrc ILIKE '%on_hand + EXCLUDED.on_hand%'
  ), 'fn_inventory_txn_apply must set inventory.ledger_apply and keep the Lane 1 upsert math';
END; $$;
