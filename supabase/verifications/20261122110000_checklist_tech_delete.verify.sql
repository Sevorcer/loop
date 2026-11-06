-- Read-only checks for tech checklist delete (R1).

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_tasks'
      AND policyname = 'job_tasks: delete for office and above'
      AND cmd = 'DELETE'
  ), 'office/manager/owner delete policy must exist';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_tasks'
      AND policyname = 'job_tasks: tech deletes tasks on assigned jobs'
      AND cmd = 'DELETE'
  ), 'tech assigned-job delete policy must exist';
END $$;
