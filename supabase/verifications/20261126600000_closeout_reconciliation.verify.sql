-- Verify: 20261126600000_closeout_reconciliation
-- Read-only assertions; run after the migration is applied.

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'job_material_lines'
            AND column_name IN ('used_qty', 'returned_qty', 'recovered_qty', 'variance_reason')) = 4,
    'job_material_lines must have the four reconciliation columns';

  -- RLS on both new tables, forced.
  ASSERT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relname IN ('job_material_reconciliations', 'refrigerant_log_entries')
            AND c.relrowsecurity AND c.relforcerowsecurity) = 2,
    'RLS must be enabled and forced on both tables';

  -- Append-only.
  ASSERT NOT has_table_privilege('authenticated', 'public.job_material_reconciliations', 'UPDATE'),
    'reconciliations are insert-only: no UPDATE';
  ASSERT NOT has_table_privilege('authenticated', 'public.job_material_reconciliations', 'DELETE'),
    'reconciliations are insert-only: no DELETE';
  ASSERT NOT has_table_privilege('authenticated', 'public.refrigerant_log_entries', 'INSERT'),
    'the refrigerant log is written only by reconcile_job_materials';
  ASSERT NOT has_table_privilege('authenticated', 'public.refrigerant_log_entries', 'UPDATE'),
    'the refrigerant log is append-only: no UPDATE';
  ASSERT NOT has_table_privilege('authenticated', 'public.refrigerant_log_entries', 'DELETE'),
    'the refrigerant log is append-only: no DELETE';
  ASSERT NOT has_table_privilege('anon', 'public.job_material_reconciliations', 'SELECT'),
    'anon must not read reconciliations';
  ASSERT NOT has_table_privilege('anon', 'public.refrigerant_log_entries', 'SELECT'),
    'anon must not read the refrigerant log';

  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reconciliation_guard' AND NOT tgisinternal),
    'the reconciliation append-only guard must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_refrigerant_log_guard' AND NOT tgisinternal),
    'the refrigerant log append-only guard must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_guard_tech_job_material_update' AND NOT tgisinternal),
    'the tech column guard must still exist';

  ASSERT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_material_reconciliations_job_key'),
    'one reconciliation row per job';

  -- Function exposure.
  ASSERT has_function_privilege('authenticated', 'public.reconcile_job_materials(uuid, jsonb)', 'EXECUTE'),
    'reconcile_job_materials must be callable by authenticated';
  ASSERT has_function_privilege('authenticated', 'public.override_material_reconciliation(uuid, text)', 'EXECUTE'),
    'override_material_reconciliation must be callable by authenticated';
  ASSERT NOT has_function_privilege('anon', 'public.reconcile_job_materials(uuid, jsonb)', 'EXECUTE'),
    'anon must not call reconcile_job_materials';
  ASSERT NOT has_function_privilege('anon', 'public.override_material_reconciliation(uuid, text)', 'EXECUTE'),
    'anon must not call override_material_reconciliation';
  ASSERT NOT has_function_privilege('authenticated', 'public.fn_reconciliation_stamp()', 'EXECUTE'),
    'trigger functions must not be callable';
  ASSERT NOT has_function_privilege('authenticated', 'public.fn_refrigerant_log_stamp()', 'EXECUTE'),
    'trigger functions must not be callable';

  -- reconcile is definer (a tech must be able to submit); override runs as the caller.
  ASSERT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.reconcile_job_materials(uuid, jsonb)'::regprocedure),
    'reconcile_job_materials must be SECURITY DEFINER';
  ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.override_material_reconciliation(uuid, text)'::regprocedure),
    'override_material_reconciliation must be SECURITY INVOKER';
  ASSERT (SELECT proconfig::text LIKE '%search_path=public%'
          FROM pg_proc WHERE oid = 'public.reconcile_job_materials(uuid, jsonb)'::regprocedure),
    'the definer function must pin search_path';

  ASSERT (SELECT count(*) FROM public.job_material_reconciliations) >= 0, 'reconciliations are queryable';
  ASSERT (SELECT count(*) FROM public.refrigerant_log_entries) >= 0, 'the refrigerant log is queryable';
END; $$;
