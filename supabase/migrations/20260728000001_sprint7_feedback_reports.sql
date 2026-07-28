-- =============================================================================
-- Sprint 7 — Feedback Reports table
--
-- Captures in-app feedback submissions from operational users during the pilot.
-- Supports the "Report Feedback" mini-epic: staff can report friction with
-- auto-captured context metadata; managers/owners can triage via /ops/feedback.
--
-- Permission model (mirrors TypeScript authorization.ts):
--   INSERT:  all operational staff (owner, manager, dispatch, tech, office, sales)
--            enforces created_by_user_id = auth.uid()
--   SELECT:  owner, manager only
--   UPDATE:  owner, manager only (triage status + notes)
--   DELETE:  denied for MVP
--
-- DOWN (rollback):
--   DROP TRIGGER IF EXISTS trg_feedback_reports_updated_at ON feedback_reports;
--   DROP TABLE IF EXISTS feedback_reports;
--   DROP FUNCTION IF EXISTS fn_set_updated_at();
-- =============================================================================

-- ---------------------------------------------------------------------------
-- updated_at trigger helper (safe to create idempotently)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS feedback_reports (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organizations(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by_user_id   uuid NOT NULL REFERENCES auth.users(id),
  created_by_role      text NOT NULL
                         CHECK (created_by_role IN ('owner', 'manager', 'dispatch', 'tech', 'office', 'sales', 'portal')),
  severity             text NOT NULL CHECK (severity IN ('P0', 'P1', 'P2', 'P3')),
  intended_action      text NOT NULL DEFAULT '',
  actual_result        text NOT NULL DEFAULT '',
  route_path           text NOT NULL DEFAULT '',
  context_job_id       uuid NULL REFERENCES jobs(id) ON DELETE SET NULL,
  context_customer_id  uuid NULL REFERENCES customers(id) ON DELETE SET NULL,
  context_property_id  uuid NULL REFERENCES properties(id) ON DELETE SET NULL,
  screenshot_url       text NULL,
  status               text NOT NULL DEFAULT 'new'
                         CHECK (status IN ('new', 'triaged', 'in_progress', 'resolved', 'wontfix')),
  triage_notes         text NOT NULL DEFAULT ''
);

CREATE TRIGGER trg_feedback_reports_updated_at
  BEFORE UPDATE ON feedback_reports
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX IF NOT EXISTS feedback_reports_org_created_at_idx
  ON feedback_reports(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS feedback_reports_org_severity_status_idx
  ON feedback_reports(org_id, severity, status);

CREATE INDEX IF NOT EXISTS feedback_reports_context_job_id_idx
  ON feedback_reports(context_job_id)
  WHERE context_job_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE feedback_reports ENABLE ROW LEVEL SECURITY;

-- Staff (any operational role) may insert feedback for their own org.
-- Enforces that the submitter can only set themselves as the author.
CREATE POLICY feedback_reports_insert_staff
  ON feedback_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner', 'manager', 'dispatch', 'tech', 'office', 'sales')
    AND created_by_user_id = auth.uid()
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
  )
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner', 'manager')
  );
