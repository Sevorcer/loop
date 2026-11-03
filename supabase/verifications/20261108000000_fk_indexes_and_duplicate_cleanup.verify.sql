-- Asserts every advisor-flagged FK now has a covering index and the two
-- duplicate feedback_reports indexes are down to the one kept copy.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'calendar_saved_group_members' AND indexname = 'calendar_saved_group_members_group_id_org_id_idx'
  ), 'calendar_saved_group_members_group_id_org_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'calendar_saved_group_members' AND indexname = 'calendar_saved_group_members_user_id_idx'
  ), 'calendar_saved_group_members_user_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'calendar_saved_groups' AND indexname = 'calendar_saved_groups_created_by_idx'
  ), 'calendar_saved_groups_created_by_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'calendar_task_assignees' AND indexname = 'calendar_task_assignees_user_id_idx'
  ), 'calendar_task_assignees_user_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'calendar_tasks' AND indexname = 'calendar_tasks_created_by_idx'
  ), 'calendar_tasks_created_by_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'calendar_tasks' AND indexname = 'calendar_tasks_customer_id_idx'
  ), 'calendar_tasks_customer_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'calendar_tasks' AND indexname = 'calendar_tasks_done_by_idx'
  ), 'calendar_tasks_done_by_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'calendar_tasks' AND indexname = 'calendar_tasks_job_id_idx'
  ), 'calendar_tasks_job_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'crew_assignments' AND indexname = 'crew_assignments_crew_id_idx'
  ), 'crew_assignments_crew_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'crew_assignments' AND indexname = 'crew_assignments_job_id_idx'
  ), 'crew_assignments_job_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'customer_contacts' AND indexname = 'customer_contacts_customer_id_idx'
  ), 'customer_contacts_customer_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'dispatch_plans' AND indexname = 'dispatch_plans_job_id_idx'
  ), 'dispatch_plans_job_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'estimate_line_items' AND indexname = 'estimate_line_items_estimate_id_idx'
  ), 'estimate_line_items_estimate_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'estimates' AND indexname = 'estimates_customer_id_idx'
  ), 'estimates_customer_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'estimates' AND indexname = 'estimates_property_id_idx'
  ), 'estimates_property_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'feedback_reports' AND indexname = 'feedback_reports_context_customer_id_idx'
  ), 'feedback_reports_context_customer_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'feedback_reports' AND indexname = 'feedback_reports_context_property_id_idx'
  ), 'feedback_reports_context_property_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'gc_issue_attachments' AND indexname = 'gc_issue_attachments_org_id_idx'
  ), 'gc_issue_attachments_org_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'gc_issue_requests' AND indexname = 'gc_issue_requests_assigned_to_idx'
  ), 'gc_issue_requests_assigned_to_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'gc_issue_requests' AND indexname = 'gc_issue_requests_submitted_by_idx'
  ), 'gc_issue_requests_submitted_by_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'installed_systems' AND indexname = 'installed_systems_job_id_idx'
  ), 'installed_systems_job_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'installed_systems' AND indexname = 'installed_systems_property_id_idx'
  ), 'installed_systems_property_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'installed_systems' AND indexname = 'installed_systems_technical_profile_id_idx'
  ), 'installed_systems_technical_profile_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'invoices' AND indexname = 'invoices_customer_id_idx'
  ), 'invoices_customer_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'invoices' AND indexname = 'invoices_job_id_idx'
  ), 'invoices_job_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'job_activity' AND indexname = 'job_activity_actor_id_idx'
  ), 'job_activity_actor_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'job_callbacks' AND indexname = 'job_callbacks_created_by_idx'
  ), 'job_callbacks_created_by_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'job_callbacks' AND indexname = 'job_callbacks_original_job_id_idx'
  ), 'job_callbacks_original_job_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'job_financials' AND indexname = 'job_financials_updated_by_idx'
  ), 'job_financials_updated_by_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'job_financials_history' AND indexname = 'job_financials_history_changed_by_idx'
  ), 'job_financials_history_changed_by_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'job_financials_history' AND indexname = 'job_financials_history_job_id_idx'
  ), 'job_financials_history_job_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'job_line_items' AND indexname = 'job_line_items_job_id_idx'
  ), 'job_line_items_job_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'job_notes' AND indexname = 'job_notes_author_id_idx'
  ), 'job_notes_author_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'job_notes' AND indexname = 'job_notes_job_id_idx'
  ), 'job_notes_job_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'job_signatures' AND indexname = 'job_signatures_captured_by_idx'
  ), 'job_signatures_captured_by_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'job_signatures' AND indexname = 'job_signatures_job_id_idx'
  ), 'job_signatures_job_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'job_signatures' AND indexname = 'job_signatures_storage_object_id_idx'
  ), 'job_signatures_storage_object_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'payments' AND indexname = 'payments_customer_id_idx'
  ), 'payments_customer_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'payments' AND indexname = 'payments_estimate_id_idx'
  ), 'payments_estimate_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'payments' AND indexname = 'payments_invoice_id_idx'
  ), 'payments_invoice_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'payments' AND indexname = 'payments_job_id_idx'
  ), 'payments_job_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'property_documents' AND indexname = 'property_documents_property_id_idx'
  ), 'property_documents_property_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'property_photos' AND indexname = 'property_photos_property_id_idx'
  ), 'property_photos_property_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'schedule_blocks' AND indexname = 'schedule_blocks_crew_assignment_id_idx'
  ), 'schedule_blocks_crew_assignment_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'schedule_blocks' AND indexname = 'schedule_blocks_dispatch_plan_id_idx'
  ), 'schedule_blocks_dispatch_plan_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'schedule_blocks' AND indexname = 'schedule_blocks_job_id_idx'
  ), 'schedule_blocks_job_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'storage_objects' AND indexname = 'storage_objects_uploaded_by_idx'
  ), 'storage_objects_uploaded_by_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'time_off' AND indexname = 'time_off_created_by_idx'
  ), 'time_off_created_by_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'time_off' AND indexname = 'time_off_user_id_idx'
  ), 'time_off_user_id_idx must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'user_profiles' AND indexname = 'user_profiles_org_idx'
  ), 'user_profiles_org_idx must exist';

  -- Duplicate pair 1: keep feedback_reports_org_created_at_idx, drop the twin.
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'feedback_reports'
      AND indexname = 'feedback_reports_org_created_at_idx'
  ), 'feedback_reports_org_created_at_idx (kept) must exist';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'feedback_reports'
      AND indexname = 'idx_feedback_reports_org_created'
  ), 'idx_feedback_reports_org_created (dropped duplicate) must be gone';

  -- Duplicate pair 2: keep feedback_reports_org_severity_status_idx, drop the twin.
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'feedback_reports'
      AND indexname = 'feedback_reports_org_severity_status_idx'
  ), 'feedback_reports_org_severity_status_idx (kept) must exist';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'feedback_reports'
      AND indexname = 'idx_feedback_reports_org_severity_status'
  ), 'idx_feedback_reports_org_severity_status (dropped duplicate) must be gone';
END; $$;
