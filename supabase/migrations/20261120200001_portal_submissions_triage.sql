-- Migration: portal_submissions triage queue
-- Adds status tracking and submitter company to portal submissions.
--
-- status: unreviewed (default), accepted, dismissed
-- submitter_company: required company name from the person submitting

-- Add status column with default 'unreviewed'
ALTER TABLE portal_submissions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'unreviewed'
    CHECK (status IN ('unreviewed', 'accepted', 'dismissed'));

-- Add submitter_company column (required for new submissions, existing rows get '')
ALTER TABLE portal_submissions
  ADD COLUMN IF NOT EXISTS submitter_company text NOT NULL DEFAULT '';

-- Add reviewed_at and reviewed_by for audit trail
ALTER TABLE portal_submissions
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

-- Index for filtering by status (office triage queue view)
CREATE INDEX IF NOT EXISTS idx_portal_submissions_status
  ON portal_submissions (org_id, status, created_at DESC);
