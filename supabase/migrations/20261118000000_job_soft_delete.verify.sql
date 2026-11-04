-- Verify: deleted_at column exists on jobs.
DO $$
BEGIN
  PERFORM column_name
    FROM information_schema.columns
   WHERE table_name = 'jobs'
     AND column_name = 'deleted_at';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'jobs.deleted_at column not found';
  END IF;
END $$;

-- Verify: partial index exists.
DO $$
BEGIN
  PERFORM indexname
    FROM pg_indexes
   WHERE tablename = 'jobs'
     AND indexname = 'idx_jobs_active_org';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'idx_jobs_active_org index not found';
  END IF;
END $$;
