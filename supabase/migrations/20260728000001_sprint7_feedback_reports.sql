-- =============================================================================
-- Sprint 7 — Feedback Reports table
--
-- Captures in-app feedback submissions from operational users during the pilot.
-- Supports the "Report Feedback" mini-epic: staff can report friction with
-- auto-captured context metadata; managers/owners can triage via /ops/feedback.
--
-- Permission model (mirrors TypeScript authorization.ts):
--   INSERT:  all operational staff (owner, manager, dispatch, tech, office, sales)
--   SELECT:  owner, manager only
--   UPDATE:  owner, manager only (triage status + notes)
--   DELETE:  owner only
--
-- DOWN (rollback):
--   DROP TABLE IF EXISTS feedback_reports;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS feedback_reports (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organizations(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by_user_id   uuid REFERENCES auth.users(id),
  created_by_role      text NOT NULL,
  severity             text NOT NULL CHECK (severity IN ('P0', 'P1', 'P2', 'P3')),
  intended_action      text NOT NULL,
  actual_result        text NOT NULL,
  route_path           text NOT NULL,
  context_job_id       uuid NULL,
  context_customer_id  uuid NULL,
  context_property_id  uuid NULL,
  screenshot_url       text NULL,
  status               text NOT NULL DEFAULT 'new'
                         CHECK (status IN ('new', 'triaged', 'in_progress', 'resolved', 'wontfix')),
  triage_notes         text NULL
);

CREATE INDEX IF NOT EXISTS feedback_reports_org_id_idx
  ON feedback_reports(org_id);

CREATE INDEX IF NOT EXISTS feedback_reports_severity_status_idx
  ON feedback_reports(org_id, severity, status);

CREATE INDEX IF NOT EXISTS feedback_reports_created_at_idx
  ON feedback_reports(org_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE feedback_reports ENABLE ROW LEVEL SECURITY;

-- Staff (any operational role) may insert feedback for their own org.
CREATE POLICY feedback_reports_insert_staff
  ON feedback_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner', 'manager', 'dispatch', 'tech', 'office', 'sales')
  );

-- Only manager/owner may view feedback reports.
CREATE POLICY feedback_reports_select_manager
  ON feedback_reports
  FOR SELECT
  TO authenticated
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner', 'manager')
  );

-- Only manager/owner may triage (update status + notes).
CREATE POLICY feedback_reports_update_manager
  ON feedback_reports
  FOR UPDATE
  TO authenticated
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner', 'manager')
  );

-- Only owner may delete feedback reports.
CREATE POLICY feedback_reports_delete_owner
  ON feedback_reports
  FOR DELETE
  TO authenticated
  USING (
    org_id = current_org_id()
    AND current_app_role() = 'owner'
  );
