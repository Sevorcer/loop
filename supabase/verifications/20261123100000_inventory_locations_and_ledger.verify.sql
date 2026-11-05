-- Verify: 20261123100000_inventory_locations_and_ledger
-- Read-only assertions; run after the migration is applied.

-- Tables + RLS (ENABLE and FORCE)
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicles'), 'vehicles must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'vehicles' AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be ENABLED and FORCED on vehicles';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_locations'), 'inventory_locations must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'inventory_locations' AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be ENABLED and FORCED on inventory_locations';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_stock_levels'), 'inventory_stock_levels must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'inventory_stock_levels' AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be ENABLED and FORCED on inventory_stock_levels';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_transactions'), 'inventory_transactions must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'inventory_transactions' AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be ENABLED and FORCED on inventory_transactions';
END; $$;

-- Key columns
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'name' AND data_type = 'text' AND is_nullable = 'NO'
  ), 'vehicles.name must be text (nullable=NO)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'status' AND data_type = 'text' AND is_nullable = 'NO'
  ), 'vehicles.status must be text (nullable=NO)';
END; $$;
DO $$ BEGIN
  ASSERT NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'crew_id'
  ), 'vehicles.crew_id must not exist: the crew link is crews.vehicle_id (single source)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_locations' AND column_name = 'type' AND data_type = 'text' AND is_nullable = 'NO'
  ), 'inventory_locations.type must be text (nullable=NO)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_locations' AND column_name = 'vehicle_id' AND data_type = 'uuid' AND is_nullable = 'YES'
  ), 'inventory_locations.vehicle_id must be uuid (nullable=YES)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_locations' AND column_name = 'job_id' AND data_type = 'uuid' AND is_nullable = 'YES'
  ), 'inventory_locations.job_id must be uuid (nullable=YES)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_stock_levels' AND column_name = 'on_hand' AND data_type = 'numeric' AND is_nullable = 'NO'
  ), 'inventory_stock_levels.on_hand must be numeric (nullable=NO)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_stock_levels' AND column_name = 'min_qty' AND data_type = 'numeric' AND is_nullable = 'YES'
  ), 'inventory_stock_levels.min_qty must be numeric (nullable=YES)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_stock_levels' AND column_name = 'max_qty' AND data_type = 'numeric' AND is_nullable = 'YES'
  ), 'inventory_stock_levels.max_qty must be numeric (nullable=YES)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'txn_type' AND data_type = 'text' AND is_nullable = 'NO'
  ), 'inventory_transactions.txn_type must be text (nullable=NO)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'qty_delta' AND data_type = 'numeric' AND is_nullable = 'NO'
  ), 'inventory_transactions.qty_delta must be numeric (nullable=NO)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'reverses_transaction_id' AND data_type = 'uuid' AND is_nullable = 'YES'
  ), 'inventory_transactions.reverses_transaction_id must be uuid (nullable=YES)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'transfer_group_id' AND data_type = 'uuid' AND is_nullable = 'YES'
  ), 'inventory_transactions.transfer_group_id must be uuid (nullable=YES)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'created_by' AND data_type = 'uuid' AND is_nullable = 'NO'
  ), 'inventory_transactions.created_by must be uuid (nullable=NO)';
END; $$;

-- Policies
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vehicles' AND policyname = 'vehicles: read for staff'),
    'vehicles: policy "vehicles: read for staff" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vehicles' AND policyname = 'vehicles: insert for office+'),
    'vehicles: policy "vehicles: insert for office+" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vehicles' AND policyname = 'vehicles: update for office+'),
    'vehicles: policy "vehicles: update for office+" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vehicles' AND policyname = 'vehicles: delete for owner'),
    'vehicles: policy "vehicles: delete for owner" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_locations' AND policyname = 'inventory_locations: read for ops'),
    'inventory_locations: policy "inventory_locations: read for ops" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_locations' AND policyname = 'inventory_locations: insert for office+'),
    'inventory_locations: policy "inventory_locations: insert for office+" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_locations' AND policyname = 'inventory_locations: update for office+'),
    'inventory_locations: policy "inventory_locations: update for office+" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_locations' AND policyname = 'inventory_locations: delete for owner'),
    'inventory_locations: policy "inventory_locations: delete for owner" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_stock_levels' AND policyname = 'inventory_stock_levels: read for ops'),
    'inventory_stock_levels: policy "inventory_stock_levels: read for ops" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_transactions' AND policyname = 'inventory_transactions: read for ops'),
    'inventory_transactions: policy "inventory_transactions: read for ops" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_transactions' AND policyname = 'inventory_transactions: insert for office+'),
    'inventory_transactions: policy "inventory_transactions: insert for office+" must exist';
END; $$;

-- Stock cache: SELECT only. Ledger: no UPDATE / DELETE policy.
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_stock_levels' AND cmd = 'INSERT'),
    'inventory_stock_levels must have NO INSERT policy';
END; $$;
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_stock_levels' AND cmd = 'UPDATE'),
    'inventory_stock_levels must have NO UPDATE policy';
END; $$;
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_stock_levels' AND cmd = 'DELETE'),
    'inventory_stock_levels must have NO DELETE policy';
END; $$;
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_transactions' AND cmd = 'UPDATE'),
    'inventory_transactions must have NO UPDATE policy';
END; $$;
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_transactions' AND cmd = 'DELETE'),
    'inventory_transactions must have NO DELETE policy';
END; $$;

-- Privileges: authenticated has no write on the cache and no UPDATE/DELETE on the ledger.
DO $$ BEGIN
  ASSERT NOT has_table_privilege('authenticated', 'public.inventory_stock_levels', 'INSERT'), 'authenticated must not INSERT into inventory_stock_levels';
  ASSERT NOT has_table_privilege('authenticated', 'public.inventory_stock_levels', 'UPDATE'), 'authenticated must not UPDATE inventory_stock_levels';
  ASSERT NOT has_table_privilege('authenticated', 'public.inventory_stock_levels', 'DELETE'), 'authenticated must not DELETE from inventory_stock_levels';
  ASSERT NOT has_table_privilege('authenticated', 'public.inventory_transactions', 'UPDATE'), 'authenticated must not UPDATE inventory_transactions';
  ASSERT NOT has_table_privilege('authenticated', 'public.inventory_transactions', 'DELETE'), 'authenticated must not DELETE from inventory_transactions';
  ASSERT NOT has_table_privilege('anon', 'public.inventory_transactions', 'SELECT'), 'anon must not read inventory_transactions';
END; $$;

-- Ledger insert policy pins created_by to the caller; no WITH CHECK (true) anywhere.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inventory_transactions'
      AND policyname = 'inventory_transactions: insert for office+' AND with_check ~ 'created_by'
  ), 'ledger insert policy must require created_by = auth.uid()';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('vehicles','inventory_locations','inventory_stock_levels','inventory_transactions')
      AND (with_check = 'true' OR qual ~ 'portal' OR with_check ~ 'portal')
  ), 'no WITH CHECK (true) and no portal grant on inventory tables';
END; $$;

-- Ledger triggers
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.inventory_transactions'::regclass AND t.tgname = 'trg_inventory_txn_guard' AND NOT t.tgisinternal
  ), 'trigger trg_inventory_txn_guard must exist on inventory_transactions';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.inventory_transactions'::regclass AND t.tgname = 'trg_inventory_txn_apply' AND NOT t.tgisinternal
  ), 'trigger trg_inventory_txn_apply must exist on inventory_transactions';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.inventory_transactions'::regclass AND t.tgname = 'trg_inventory_txn_no_update_delete' AND NOT t.tgisinternal
  ), 'trigger trg_inventory_txn_no_update_delete must exist on inventory_transactions';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.inventory_transactions'::regclass AND t.tgname = 'trg_inventory_txn_no_truncate' AND NOT t.tgisinternal
  ), 'trigger trg_inventory_txn_no_truncate must exist on inventory_transactions';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.vehicles'::regclass AND t.tgname = 'trg_vehicles_updated_at' AND NOT t.tgisinternal
  ), 'trigger trg_vehicles_updated_at must exist on vehicles';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.inventory_locations'::regclass AND t.tgname = 'trg_inventory_locations_updated_at' AND NOT t.tgisinternal
  ), 'trigger trg_inventory_locations_updated_at must exist on inventory_locations';
END; $$;

-- Functions exist; guard/apply are SECURITY DEFINER with a pinned search_path, and the apply
-- function's owner can write the cache under FORCE RLS (superuser or BYPASSRLS).
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND p.proname = 'fn_inventory_txn_immutable'), 'fn_inventory_txn_immutable must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND p.proname = 'fn_inventory_txn_guard' AND p.prosecdef
                   AND p.proconfig::text ~ 'search_path'), 'fn_inventory_txn_guard must be SECURITY DEFINER with search_path';
  ASSERT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 JOIN pg_roles r ON r.oid = p.proowner
                 WHERE n.nspname = 'public' AND p.proname = 'fn_inventory_txn_apply' AND p.prosecdef
                   AND p.proconfig::text ~ 'search_path' AND (r.rolsuper OR r.rolbypassrls)),
    'fn_inventory_txn_apply must be SECURITY DEFINER, search_path pinned, owned by a role that bypasses RLS';
END; $$;

-- Ledger constraints
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM pg_constraint
          WHERE conrelid = 'public.inventory_transactions'::regclass AND contype = 'c'
            AND conname IN ('inventory_transactions_sign_matches_type','inventory_transactions_transfer_has_group',
                            'inventory_transactions_reversal_links_original','inventory_transactions_reason_required')) = 4,
    'inventory_transactions CHECK constraints must all exist';
  ASSERT (SELECT count(*) FROM pg_constraint
          WHERE conrelid = 'public.inventory_locations'::regclass AND contype = 'c'
            AND conname IN ('inventory_locations_van_has_vehicle','inventory_locations_job_has_job')) = 2,
    'inventory_locations van/job CHECK constraints must exist';
END; $$;

-- Indexes
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'inventory_transactions' AND indexname = 'inventory_transactions_reverses_uidx'),
    'index inventory_transactions_reverses_uidx must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'inventory_transactions' AND indexname = 'inventory_transactions_org_created_idx'),
    'index inventory_transactions_org_created_idx must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'inventory_transactions' AND indexname = 'inventory_transactions_item_idx'),
    'index inventory_transactions_item_idx must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'inventory_transactions' AND indexname = 'inventory_transactions_location_idx'),
    'index inventory_transactions_location_idx must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'inventory_locations' AND indexname = 'inventory_locations_org_name_uidx'),
    'index inventory_locations_org_name_uidx must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'inventory_locations' AND indexname = 'inventory_locations_vehicle_uidx'),
    'index inventory_locations_vehicle_uidx must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'inventory_locations' AND indexname = 'inventory_locations_job_uidx'),
    'index inventory_locations_job_uidx must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'vehicles' AND indexname = 'vehicles_org_name_uidx'),
    'index vehicles_org_name_uidx must exist';
END; $$;

-- No vehicles are auto-created from legacy free-text (Collin adds vans himself).
-- (Informational: this migration performs no INSERT into vehicles.)
