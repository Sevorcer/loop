-- Asserts the feedback screenshot bucket and the submit policies.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'feedback-screenshots' AND public = false
  ), 'feedback-screenshots bucket must exist and stay private';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'feedback_screenshots_insert_authenticated'), 'feedback screenshot insert policy must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'feedback_screenshots_select_authenticated'), 'feedback screenshot select policy must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'feedback_reports' AND policyname = 'feedback_reports_insert_org_member'), 'feedback_reports_insert_org_member must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'feedback_reports' AND policyname = 'feedback_reports_select_own'), 'feedback_reports_select_own must exist';
END; $$;
