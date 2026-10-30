-- Asserts the partial unique index on jobs.job_number.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'jobs' AND indexname = 'jobs_job_number_unique'
  ), 'jobs_job_number_unique must exist';
END; $$;
