-- Asserts jobs.contractor_ids exists as a uuid array.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs'
      AND column_name = 'contractor_ids'
      AND data_type = 'ARRAY'
      AND udt_name = '_uuid'
      AND is_nullable = 'NO'
  ), 'jobs.contractor_ids must be a NOT NULL uuid[] column';
END; $$;
