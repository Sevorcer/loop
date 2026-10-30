-- Asserts checklist completion stamp columns and index.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_tasks'
      AND column_name = 'completed_at' AND data_type = 'timestamp with time zone'
  ), 'job_tasks.completed_at must be timestamptz';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_tasks'
      AND column_name = 'completed_by'
  ), 'job_tasks.completed_by must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_job_tasks_completed_at'
  ), 'idx_job_tasks_completed_at must exist';
END; $$;
