-- Verify: job_bids table, index, RLS, and trigger exist.

DO $$
BEGIN
  -- Table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'job_bids'
  ) THEN
    RAISE EXCEPTION 'job_bids table does not exist';
  END IF;

  -- Required columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_bids' AND column_name = 'amount_cents'
  ) THEN
    RAISE EXCEPTION 'job_bids.amount_cents column missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_bids' AND column_name = 'is_current'
  ) THEN
    RAISE EXCEPTION 'job_bids.is_current column missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_bids' AND column_name = 'file_id'
  ) THEN
    RAISE EXCEPTION 'job_bids.file_id column missing';
  END IF;

  -- Index exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'job_bids'
      AND indexname = 'job_bids_org_job_current_idx'
  ) THEN
    RAISE EXCEPTION 'job_bids_org_job_current_idx index missing';
  END IF;

  -- RLS enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'job_bids' AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on job_bids';
  END IF;

  -- Same-company trigger
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table = 'job_bids'
      AND trigger_name = 'job_bids_same_company'
  ) THEN
    RAISE EXCEPTION 'job_bids_same_company trigger missing';
  END IF;

  RAISE NOTICE 'job_bids verification passed';
END;
$$;
