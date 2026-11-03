-- Read-only checks for the B4 office job-update migration.
-- Run after 20261106000100_office_job_update.sql. This file changes nothing.

DO $$
DECLARE
  update_using text;
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs'
      AND policyname = 'jobs: update for owner/manager/dispatch/office'
      AND cmd = 'UPDATE'
  ), 'update policy "jobs: update for owner/manager/dispatch/office" must exist';

  -- The pre-B4 policy name must be gone.
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs'
      AND policyname = 'jobs: update for owner/manager/dispatch'
  ), 'the pre-B4 jobs update policy must be replaced';

  SELECT qual INTO update_using
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'jobs'
    AND policyname = 'jobs: update for owner/manager/dispatch/office';

  ASSERT position('''office''' IN update_using) > 0,
    'office must be able to update jobs (B4)';
  ASSERT position('''owner''' IN update_using) > 0
     AND position('''manager''' IN update_using) > 0
     AND position('''dispatch''' IN update_using) > 0,
    'owner/manager/dispatch must keep job update access';

  -- The tech policy is a separate, still-present policy.
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs'
      AND policyname = 'jobs: tech updates own assigned jobs'
  ), 'tech job-update policy must still exist, untouched';
END $$;
