DROP POLICY IF EXISTS "feedback_reports_delete_owner_or_creator" ON public.feedback_reports;
CREATE POLICY "feedback_reports_delete_owner_or_creator" ON public.feedback_reports
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND (public.current_app_role() = 'owner' OR created_by_user_id = auth.uid()));
