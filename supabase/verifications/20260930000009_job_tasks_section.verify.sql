-- Asserts job_tasks.section. The migration file was renamed from
-- 20260930000003_job_tasks_section.sql because that version prefix was
-- already used by job_number_unique. The column itself is unchanged.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_tasks'
      AND column_name = 'section' AND data_type = 'text' AND is_nullable = 'NO'
  ), 'job_tasks.section must be a NOT NULL text column';
END; $$;
