-- Asserts the owner-or-creator delete rule exists on feedback reports.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback_reports'
      AND policyname = 'feedback_reports_delete_owner_or_creator'
      AND cmd = 'DELETE'
  ), 'feedback_reports_delete_owner_or_creator DELETE policy must exist';
END; $$;
