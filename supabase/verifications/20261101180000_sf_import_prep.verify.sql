-- Read-only checks for the Service Fusion import migration.
-- Run after applying 20261101180000_sf_import_prep.sql. This file changes nothing.

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'parent_customer_id'
  ), 'customers.parent_customer_id must exist';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'state'
  ), 'customers.state must exist';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'sf_id'
  ), 'customers.sf_id must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'customers_org_sf_id_uidx'
  ), 'customer Service Fusion ids must be unique per company';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'zip'
  ), 'properties.zip must exist';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'state'
  ), 'properties.state must exist';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'sf_status'
  ), 'jobs.sf_status must keep the original Service Fusion status';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'sf_tech_names'
  ), 'jobs.sf_tech_names must keep unmatched technician names';
END $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'customer_contacts'
  ), 'customer_contacts must exist';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'job_line_items'
  ), 'job_line_items must exist';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'invoices'
  ), 'invoices must exist';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payments'
  ), 'payments must exist';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'estimates'
  ), 'estimates must exist';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'estimate_line_items'
  ), 'estimate_line_items must exist';
END $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'job_line_items' AND relrowsecurity AND relforcerowsecurity
  ), 'job line items must force row security';
  ASSERT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'invoices' AND relrowsecurity AND relforcerowsecurity
  ), 'invoices must force row security';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_line_items'
      AND policyname = 'job_line_items: finance read'
      AND qual ILIKE '%''sales''%'
      AND qual NOT ILIKE '%portal%'
  ), 'sales can read line items, portal cannot';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_line_items'
      AND policyname = 'job_line_items: tech reads assigned'
      AND cmd = 'SELECT'
      AND qual ILIKE '%''tech''%'
  ), 'a technician can read line items on an assigned job';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_line_items'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
      AND (
        coalesce(qual, '') ILIKE '%''tech''%'
        OR coalesce(with_check, '') ILIKE '%''tech''%'
      )
  ), 'a technician cannot edit line items';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices'
      AND policyname = 'invoices: finance read'
      AND cmd = 'SELECT'
      AND qual ILIKE '%''office''%'
      AND qual NOT ILIKE '%portal%'
  ), 'office can read invoices';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('invoices', 'payments', 'estimates', 'estimate_line_items')
      AND (
        coalesce(qual, '') ILIKE '%''tech''%'
        OR coalesce(with_check, '') ILIKE '%''tech''%'
        OR coalesce(qual, '') ILIKE '%portal%'
        OR coalesce(with_check, '') ILIKE '%portal%'
      )
  ), 'technicians and portal users cannot see invoices, payments, or estimates';
  ASSERT NOT has_table_privilege('anon', 'public.invoices', 'SELECT'),
    'anon must not read invoices';
  ASSERT NOT has_function_privilege('anon', 'public.sf_import_apply_batch(jsonb)', 'EXECUTE'),
    'anon must not run the importer';
  ASSERT NOT has_function_privilege('authenticated', 'public.sf_import_apply_batch(jsonb)', 'EXECUTE'),
    'a signed-in user must not run the importer directly';
END $$;
