-- Feedback submit fixes (production-applied 2026-10-01)
-- Root causes:
-- 1) Storage bucket "feedback-screenshots" did not exist, so screenshot
--    uploads failed with "Bucket not found".
-- 2) feedback_reports INSERT policies were satisfiable by techs, but the
--    repository inserts with .select() (INSERT ... RETURNING) and the only
--    SELECT policies were owner/manager, so tech submissions failed with
--    "new row violates row-level security policy for table feedback_reports".
-- Fix: create the private bucket with authenticated storage policies
-- (modeled on job-files), replace the INSERT policies with a single
-- org-scoped org-member policy, and let a submitter read back their own
-- report. Manager/owner triage read/update policies are unchanged.
-- RLS stays enabled; nothing is opened to anon.

INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-screenshots', 'feedback-screenshots', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "feedback_screenshots_insert_authenticated" ON storage.objects;
CREATE POLICY "feedback_screenshots_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feedback-screenshots');

DROP POLICY IF EXISTS "feedback_screenshots_select_authenticated" ON storage.objects;
CREATE POLICY "feedback_screenshots_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'feedback-screenshots');

DROP POLICY IF EXISTS "feedback_screenshots_update_authenticated" ON storage.objects;
CREATE POLICY "feedback_screenshots_update_authenticated" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'feedback-screenshots')
  WITH CHECK (bucket_id = 'feedback-screenshots');

DROP POLICY IF EXISTS "feedback_screenshots_delete_authenticated" ON storage.objects;
CREATE POLICY "feedback_screenshots_delete_authenticated" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'feedback-screenshots');

DROP POLICY IF EXISTS "feedback_insert_ops_roles" ON public.feedback_reports;
DROP POLICY IF EXISTS "feedback_reports_insert_staff" ON public.feedback_reports;
DROP POLICY IF EXISTS "feedback_reports_insert_org_member" ON public.feedback_reports;
CREATE POLICY "feedback_reports_insert_org_member" ON public.feedback_reports
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS "feedback_reports_select_own" ON public.feedback_reports;
CREATE POLICY "feedback_reports_select_own" ON public.feedback_reports
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND created_by_user_id = auth.uid());
