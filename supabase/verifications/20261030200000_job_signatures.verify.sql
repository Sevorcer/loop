-- Asserts append-only job signatures and technician assignment scope.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'job_signatures'
  ), 'job_signatures must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_signatures' AND column_name = 'signer_name'
  ), 'job_signatures.signer_name must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_signatures' AND column_name = 'captured_by'
  ), 'job_signatures.captured_by must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_signatures' AND column_name = 'captured_at'
  ), 'job_signatures.captured_at must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_signatures' AND column_name = 'job_id'
  ), 'job_signatures.job_id must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_signatures' AND column_name = 'storage_object_id'
  ), 'job_signatures.storage_object_id must exist';

  ASSERT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'job_signatures'
      AND c.relrowsecurity = true
      AND c.relforcerowsecurity = true
  ), 'RLS must be enabled and forced on job_signatures';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_signatures'
      AND policyname = 'job_signatures: read for owner/manager/dispatch/office/sales'
  ), 'office and dispatch must be able to read signatures';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_signatures'
      AND policyname = 'job_signatures: tech reads signatures on assigned jobs'
  ), 'techs must read signatures only on assigned jobs';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_signatures'
      AND policyname = 'job_signatures: insert for owner/manager/office'
      AND with_check ILIKE '%office%'
  ), 'office must be able to capture a signature';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_signatures'
      AND policyname = 'job_signatures: tech inserts on assigned jobs'
      AND with_check ILIKE '%auth.uid()%'
  ), 'techs must capture signatures only on assigned jobs as themselves';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_signatures'
      AND cmd IN ('UPDATE', 'DELETE')
  ), 'job signatures are append-only';

  ASSERT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'job-signatures' AND public = false
  ), 'job-signatures bucket must be private';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'job_signatures_storage_select'
  ), 'signature file reads must be limited to visible jobs';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'job_signatures_storage_insert'
  ), 'signature file uploads must be limited to visible jobs';
END; $$;
