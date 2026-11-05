DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_notes'
      AND policyname = 'job_notes: update for staff' AND cmd = 'UPDATE'
  ), 'staff update policy must exist';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_notes'
      AND policyname = 'job_notes: tech updates notes on assigned jobs' AND cmd = 'UPDATE'
  ), 'tech update policy must exist';
END $$;
