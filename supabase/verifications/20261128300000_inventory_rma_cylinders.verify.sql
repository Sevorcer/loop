-- Read-only checks for 20261128300000_inventory_rma_cylinders.sql.
-- Run after the migration. This file changes nothing.

DO $$
DECLARE
  def text;
  f text;
BEGIN
  -- cylinder foreign key on the refrigerant log ---------------------------------------
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'refrigerant_log_serial_unit_same_org_fkey'
      AND conrelid = 'public.refrigerant_log_entries'::regclass
      AND contype = 'f'
      AND confrelid = 'public.inventory_serial_units'::regclass
      AND confdeltype = 'r'
  ), 'refrigerant_log_entries.serial_unit_id must have the same-org FK to units, ON DELETE RESTRICT';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'refrigerant_log_entries_serial_unit_idx'
  ), 'the cylinder index must exist';

  -- reconcile_job_materials: replaced, still locked down, cylinder-aware -------------------
  f := 'public.reconcile_job_materials(uuid, jsonb)';
  def := pg_get_functiondef(f::regprocedure);
  ASSERT position('cylinder_unit_id' IN def) > 0, 'reconcile_job_materials must read cylinder_unit_id';
  ASSERT position('SET search_path' IN def) > 0, 'reconcile_job_materials must pin search_path';
  ASSERT has_function_privilege('authenticated', f, 'EXECUTE'), 'authenticated must be able to run closeout reconciliation';
  ASSERT NOT has_function_privilege('anon', f, 'EXECUTE'), 'anon must not run closeout reconciliation';

  -- refrigerant log stays append-only and closed to direct writes -----------------------
  ASSERT NOT has_table_privilege('authenticated', 'public.refrigerant_log_entries', 'INSERT'),
    'the refrigerant log is written only through reconciliation';
  ASSERT NOT has_table_privilege('authenticated', 'public.refrigerant_log_entries', 'UPDATE'),
    'the refrigerant log is append-only';
  ASSERT NOT has_table_privilege('authenticated', 'public.refrigerant_log_entries', 'DELETE'),
    'the refrigerant log is append-only';

  -- RMA transition guard ----------------------------------------------------------------
  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_serial_unit_rma_guard'
                 AND tgrelid = 'public.inventory_serial_units'::regclass AND NOT tgisinternal),
    'the RMA transition guard trigger must exist';

  FOREACH f IN ARRAY ARRAY[
    'public.fn_inventory_serial_unit_rma_guard()',
    'public.rma_serial_unit(uuid, text, uuid, text)'
  ] LOOP
    def := pg_get_functiondef(f::regprocedure);
    ASSERT position('SET search_path' IN def) > 0, f || ' must pin search_path';
    ASSERT (SELECT prosecdef FROM pg_proc WHERE oid = f::regprocedure), f || ' must be SECURITY DEFINER';
    ASSERT NOT has_function_privilege('anon', f, 'EXECUTE'), f || ' must not be executable by anon';
  END LOOP;

  ASSERT NOT has_function_privilege('authenticated', 'public.fn_inventory_serial_unit_rma_guard()', 'EXECUTE'),
    'the guard function is trigger-only';
  ASSERT has_function_privilege('authenticated', 'public.rma_serial_unit(uuid, text, uuid, text)', 'EXECUTE'),
    'authenticated calls rma_serial_unit (the function checks owner / manager / office itself)';

  def := pg_get_functiondef('public.rma_serial_unit(uuid, text, uuid, text)'::regprocedure);
  ASSERT position('''owner'', ''manager'', ''office''' IN def) > 0, 'rma_serial_unit must restrict to owner, manager and office';
  ASSERT position('loop.rma' IN def) > 0, 'rma_serial_unit must set the RMA flag';
  ASSERT position('loop.rma' IN pg_get_functiondef('public.fn_inventory_serial_unit_rma_guard()'::regprocedure)) > 0,
    'the guard must read the RMA flag';
END $$;
