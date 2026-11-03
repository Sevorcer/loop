-- =============================================================================
-- Migration — Foreign-key covering indexes + duplicate-index cleanup
-- DB cleanup PR B / advisor run 2026-11-02
--
-- The performance advisor flagged 50 foreign keys with no covering index, and
-- 2 pairs of identical indexes on feedback_reports. Unindexed FKs force a
-- sequential scan on the child table for every parent delete/update and for
-- joins on the key; a covering index on exactly the FK column(s) fixes that.
--
-- All existing indexes on these tables lead with org_id (e.g.
-- invoices (org_id, job_id)), so they do NOT cover a FK on job_id alone — the
-- advisor is correct that these 50 are uncovered. Indexes are created plain
-- (no CONCURRENTLY): the database is small and this runs inside the migration
-- transaction via the SQL Editor.
--
-- The duplicate pairs keep the migration-defined, convention-named index
-- (<table>_<cols>_idx) and drop the ad-hoc idx_<table>_<cols> twin.
--
-- UP:
--   - Create 50 covering indexes on the flagged FK columns.
--   - Drop idx_feedback_reports_org_created (dup of feedback_reports_org_created_at_idx).
--   - Drop idx_feedback_reports_org_severity_status
--       (dup of feedback_reports_org_severity_status_idx).
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP INDEX IF EXISTS public.<each index created below>;
--   CREATE INDEX idx_feedback_reports_org_created
--     ON public.feedback_reports (org_id, created_at);
--   CREATE INDEX idx_feedback_reports_org_severity_status
--     ON public.feedback_reports (org_id, severity, status);
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Foreign-key covering indexes
-- One index per advisor-flagged FK, on exactly the FK column(s) in order.
-- user_profiles(org_id) is named user_profiles_org_idx because
-- user_profiles_org_id_idx already exists on (id, org_id) — reusing that name
-- under IF NOT EXISTS would silently skip and leave the FK uncovered.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS calendar_saved_group_members_group_id_org_id_idx
  ON public.calendar_saved_group_members (group_id, org_id);

CREATE INDEX IF NOT EXISTS calendar_saved_group_members_user_id_idx
  ON public.calendar_saved_group_members (user_id);

CREATE INDEX IF NOT EXISTS calendar_saved_groups_created_by_idx
  ON public.calendar_saved_groups (created_by);

CREATE INDEX IF NOT EXISTS calendar_task_assignees_user_id_idx
  ON public.calendar_task_assignees (user_id);

CREATE INDEX IF NOT EXISTS calendar_tasks_created_by_idx
  ON public.calendar_tasks (created_by);

CREATE INDEX IF NOT EXISTS calendar_tasks_customer_id_idx
  ON public.calendar_tasks (customer_id);

CREATE INDEX IF NOT EXISTS calendar_tasks_done_by_idx
  ON public.calendar_tasks (done_by);

CREATE INDEX IF NOT EXISTS calendar_tasks_job_id_idx
  ON public.calendar_tasks (job_id);

CREATE INDEX IF NOT EXISTS crew_assignments_crew_id_idx
  ON public.crew_assignments (crew_id);

CREATE INDEX IF NOT EXISTS crew_assignments_job_id_idx
  ON public.crew_assignments (job_id);

CREATE INDEX IF NOT EXISTS customer_contacts_customer_id_idx
  ON public.customer_contacts (customer_id);

CREATE INDEX IF NOT EXISTS dispatch_plans_job_id_idx
  ON public.dispatch_plans (job_id);

CREATE INDEX IF NOT EXISTS estimate_line_items_estimate_id_idx
  ON public.estimate_line_items (estimate_id);

CREATE INDEX IF NOT EXISTS estimates_customer_id_idx
  ON public.estimates (customer_id);

CREATE INDEX IF NOT EXISTS estimates_property_id_idx
  ON public.estimates (property_id);

CREATE INDEX IF NOT EXISTS feedback_reports_context_customer_id_idx
  ON public.feedback_reports (context_customer_id);

CREATE INDEX IF NOT EXISTS feedback_reports_context_property_id_idx
  ON public.feedback_reports (context_property_id);

CREATE INDEX IF NOT EXISTS gc_issue_attachments_org_id_idx
  ON public.gc_issue_attachments (org_id);

CREATE INDEX IF NOT EXISTS gc_issue_requests_assigned_to_idx
  ON public.gc_issue_requests (assigned_to);

CREATE INDEX IF NOT EXISTS gc_issue_requests_submitted_by_idx
  ON public.gc_issue_requests (submitted_by);

CREATE INDEX IF NOT EXISTS installed_systems_job_id_idx
  ON public.installed_systems (job_id);

CREATE INDEX IF NOT EXISTS installed_systems_property_id_idx
  ON public.installed_systems (property_id);

CREATE INDEX IF NOT EXISTS installed_systems_technical_profile_id_idx
  ON public.installed_systems (technical_profile_id);

CREATE INDEX IF NOT EXISTS invoices_customer_id_idx
  ON public.invoices (customer_id);

CREATE INDEX IF NOT EXISTS invoices_job_id_idx
  ON public.invoices (job_id);

CREATE INDEX IF NOT EXISTS job_activity_actor_id_idx
  ON public.job_activity (actor_id);

CREATE INDEX IF NOT EXISTS job_callbacks_created_by_idx
  ON public.job_callbacks (created_by);

CREATE INDEX IF NOT EXISTS job_callbacks_original_job_id_idx
  ON public.job_callbacks (original_job_id);

CREATE INDEX IF NOT EXISTS job_financials_updated_by_idx
  ON public.job_financials (updated_by);

CREATE INDEX IF NOT EXISTS job_financials_history_changed_by_idx
  ON public.job_financials_history (changed_by);

CREATE INDEX IF NOT EXISTS job_financials_history_job_id_idx
  ON public.job_financials_history (job_id);

CREATE INDEX IF NOT EXISTS job_line_items_job_id_idx
  ON public.job_line_items (job_id);

CREATE INDEX IF NOT EXISTS job_notes_author_id_idx
  ON public.job_notes (author_id);

CREATE INDEX IF NOT EXISTS job_notes_job_id_idx
  ON public.job_notes (job_id);

CREATE INDEX IF NOT EXISTS job_signatures_captured_by_idx
  ON public.job_signatures (captured_by);

CREATE INDEX IF NOT EXISTS job_signatures_job_id_idx
  ON public.job_signatures (job_id);

CREATE INDEX IF NOT EXISTS job_signatures_storage_object_id_idx
  ON public.job_signatures (storage_object_id);

CREATE INDEX IF NOT EXISTS payments_customer_id_idx
  ON public.payments (customer_id);

CREATE INDEX IF NOT EXISTS payments_estimate_id_idx
  ON public.payments (estimate_id);

CREATE INDEX IF NOT EXISTS payments_invoice_id_idx
  ON public.payments (invoice_id);

CREATE INDEX IF NOT EXISTS payments_job_id_idx
  ON public.payments (job_id);

CREATE INDEX IF NOT EXISTS property_documents_property_id_idx
  ON public.property_documents (property_id);

CREATE INDEX IF NOT EXISTS property_photos_property_id_idx
  ON public.property_photos (property_id);

CREATE INDEX IF NOT EXISTS schedule_blocks_crew_assignment_id_idx
  ON public.schedule_blocks (crew_assignment_id);

CREATE INDEX IF NOT EXISTS schedule_blocks_dispatch_plan_id_idx
  ON public.schedule_blocks (dispatch_plan_id);

CREATE INDEX IF NOT EXISTS schedule_blocks_job_id_idx
  ON public.schedule_blocks (job_id);

CREATE INDEX IF NOT EXISTS storage_objects_uploaded_by_idx
  ON public.storage_objects (uploaded_by);

CREATE INDEX IF NOT EXISTS time_off_created_by_idx
  ON public.time_off (created_by);

CREATE INDEX IF NOT EXISTS time_off_user_id_idx
  ON public.time_off (user_id);

CREATE INDEX IF NOT EXISTS user_profiles_org_idx
  ON public.user_profiles (org_id);

-- ---------------------------------------------------------------------------
-- Duplicate-index cleanup (feedback_reports)
-- Keep the migration-defined, convention-named index; drop its identical twin.
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS public.idx_feedback_reports_org_created;
DROP INDEX IF EXISTS public.idx_feedback_reports_org_severity_status;
