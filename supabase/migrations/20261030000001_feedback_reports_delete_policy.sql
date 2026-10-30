-- Let the company owner delete any feedback report, and let the person who
-- wrote a report delete their own. Everyone else stays blocked.
-- Not applied to production yet. Timestamp sorts after 20261029000001.

DROP POLICY IF EXISTS "feedback_reports_delete_owner_or_creator" ON public.feedback_reports;
CREATE POLICY "feedback_reports_delete_owner_or_creator" ON public.feedback_reports
  FOR DELETE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (
      public.current_app_role() = 'owner'
      OR created_by_user_id = auth.uid()
    )
  );

-- DOWN
-- Remove the owner-or-creator delete rule. Existing feedback reports stay.
--   DROP POLICY IF EXISTS "feedback_reports_delete_owner_or_creator" ON public.feedback_reports;
