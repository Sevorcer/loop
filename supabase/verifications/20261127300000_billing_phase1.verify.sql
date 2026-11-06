-- Verify: 20261127300000_billing_phase1
-- Read-only assertions; run after the migration is applied.

DO $$
BEGIN
  -- New tables exist with RLS enabled and forced; existing money tables still have it.
  ASSERT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relname IN ('tax_rates', 'customer_billing_settings', 'invoice_number_counters',
                              'invoice_lines', 'invoices', 'payments')
            AND c.relrowsecurity AND c.relforcerowsecurity) = 6,
    'RLS must be enabled and forced on all six billing tables';

  -- Invoices: new columns, and every pre-existing row is the Service Fusion import.
  ASSERT (SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'invoices'
            AND column_name IN ('source', 'status', 'issued_at', 'due_date', 'terms_days', 'tax_rate_id',
                                'tax_rate_percent', 'subtotal_cents', 'tax_cents', 'bill_to_customer_id',
                                'created_by', 'voided_at', 'void_reason')) = 13,
    'invoices must have the thirteen billing columns';
  ASSERT NOT EXISTS (SELECT 1 FROM public.invoices WHERE sf_id IS NOT NULL AND source <> 'sf_import'),
    'every imported invoice must be source sf_import';
  ASSERT NOT EXISTS (SELECT 1 FROM public.invoices WHERE source = 'sf_import' AND status <> 'issued'),
    'every imported invoice must be issued';
  ASSERT (SELECT column_default FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'source') LIKE '%loop%',
    'new invoices default to source loop';
  ASSERT (SELECT column_default FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'status') LIKE '%draft%',
    'new invoices default to status draft';

  ASSERT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_org_id_id_key'),
    'invoices needs (org_id, id) for the same-company line FK';
  ASSERT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_lines_invoice_fkey'),
    'invoice lines reference their invoice in the same company';
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'invoices_loop_number_uidx'),
    'a LOOP invoice number is used once per company';

  -- Payments: new columns, imported rows untouched.
  ASSERT (SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'payments'
            AND column_name IN ('source', 'reverses_payment_id', 'reason', 'created_by')) = 4,
    'payments must have the four new columns';
  ASSERT NOT EXISTS (SELECT 1 FROM public.payments WHERE sf_id IS NOT NULL AND source <> 'sf_import'),
    'every imported payment must be source sf_import';
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'payments_reverses_uidx'),
    'a payment can be reversed once';

  -- Privileges: payments are append-only; imported history cannot be rewritten by the app.
  ASSERT has_table_privilege('authenticated', 'public.payments', 'INSERT'),
    'office roles append payments through RLS';
  ASSERT NOT has_table_privilege('authenticated', 'public.payments', 'UPDATE'),
    'payments are append-only: no UPDATE';
  ASSERT NOT has_table_privilege('authenticated', 'public.payments', 'DELETE'),
    'payments are append-only: no DELETE';
  ASSERT NOT has_table_privilege('authenticated', 'public.tax_rates', 'DELETE'),
    'tax rates are deactivated, not deleted';
  ASSERT NOT has_table_privilege('authenticated', 'public.customer_billing_settings', 'DELETE'),
    'billing settings are edited, not deleted';
  ASSERT NOT has_table_privilege('authenticated', 'public.invoice_number_counters', 'DELETE'),
    'the number counter is never deleted by the app';

  ASSERT NOT has_table_privilege('anon', 'public.invoices', 'SELECT'), 'anon must not read invoices';
  ASSERT NOT has_table_privilege('anon', 'public.payments', 'SELECT'), 'anon must not read payments';
  ASSERT NOT has_table_privilege('anon', 'public.invoice_lines', 'SELECT'), 'anon must not read invoice lines';
  ASSERT NOT has_table_privilege('anon', 'public.tax_rates', 'SELECT'), 'anon must not read tax rates';
  ASSERT NOT has_table_privilege('anon', 'public.invoice_balances', 'SELECT'), 'anon must not read invoice balances';
  ASSERT has_table_privilege('authenticated', 'public.invoice_balances', 'SELECT'),
    'authenticated reads invoice balances through the caller''s RLS';

  -- The view must run as the caller, not the owner.
  ASSERT (SELECT reloptions::text LIKE '%security_invoker=true%'
          FROM pg_class WHERE oid = 'public.invoice_balances'::regclass),
    'invoice_balances must be security_invoker';

  -- Guards and triggers.
  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_invoices_guard' AND NOT tgisinternal),
    'the invoice guard must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_invoice_lines_guard' AND NOT tgisinternal),
    'the invoice lines guard must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_invoice_lines_touch' AND NOT tgisinternal),
    'the invoice totals recompute trigger must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payments_guard' AND NOT tgisinternal),
    'the payments guard must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payments_apply' AND NOT tgisinternal),
    'the paid-status trigger must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'customer_billing_settings_same_company' AND NOT tgisinternal),
    'billing settings must stay in one company';

  -- Function exposure.
  ASSERT has_function_privilege('authenticated', 'public.issue_invoice(uuid, text)', 'EXECUTE'),
    'issue_invoice must be callable by authenticated';
  ASSERT has_function_privilege('authenticated', 'public.void_invoice(uuid, text)', 'EXECUTE'),
    'void_invoice must be callable by authenticated';
  ASSERT has_function_privilege('authenticated', 'public.next_invoice_number()', 'EXECUTE'),
    'next_invoice_number must be callable by authenticated';
  ASSERT NOT has_function_privilege('anon', 'public.issue_invoice(uuid, text)', 'EXECUTE'),
    'anon must not issue invoices';
  ASSERT NOT has_function_privilege('anon', 'public.void_invoice(uuid, text)', 'EXECUTE'),
    'anon must not void invoices';
  ASSERT NOT has_function_privilege('anon', 'public.next_invoice_number()', 'EXECUTE'),
    'anon must not take invoice numbers';
  ASSERT NOT has_function_privilege('authenticated', 'public.fn_invoices_guard()', 'EXECUTE'),
    'trigger functions must not be callable';
  ASSERT NOT has_function_privilege('authenticated', 'public.fn_payments_guard()', 'EXECUTE'),
    'trigger functions must not be callable';
  ASSERT NOT has_function_privilege('authenticated', 'public.fn_payments_apply()', 'EXECUTE'),
    'trigger functions must not be callable';

  -- next_invoice_number is the one definer function; the others run as the caller.
  ASSERT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.next_invoice_number()'::regprocedure),
    'next_invoice_number must be SECURITY DEFINER';
  ASSERT (SELECT proconfig::text LIKE '%search_path=%'
          FROM pg_proc WHERE oid = 'public.next_invoice_number()'::regprocedure),
    'the definer function must pin search_path';
  ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.issue_invoice(uuid, text)'::regprocedure),
    'issue_invoice must be SECURITY INVOKER';
  ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.void_invoice(uuid, text)'::regprocedure),
    'void_invoice must be SECURITY INVOKER';

  -- Ships disabled and empty: nothing seeded, no automatic numbering until the owner turns it on.
  ASSERT NOT EXISTS (SELECT 1 FROM public.invoice_number_counters WHERE enabled),
    'the invoice counter must ship disabled';
  ASSERT (SELECT count(*) FROM public.tax_rates) >= 0, 'tax rates are queryable';
  ASSERT (SELECT count(*) FROM public.customer_billing_settings) >= 0, 'billing settings are queryable';
  ASSERT (SELECT count(*) FROM public.invoice_balances) >= 0, 'invoice balances are queryable';
END; $$;
