-- Migration: portal_submissions
-- GC Portal — Task 4: Issue/request submissions from builder portal
--
-- Stores submissions from GC share-link visitors. Each submission is
-- stamped with the job from the token — cannot submit against another job.

CREATE TABLE IF NOT EXISTS portal_submissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id      uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  share_link_id uuid NOT NULL REFERENCES job_share_links(id) ON DELETE CASCADE,
  name        text NOT NULL,
  contact     text NOT NULL DEFAULT '',
  message     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for office viewing submissions per job
CREATE INDEX idx_portal_submissions_job_id
  ON portal_submissions (job_id, created_at DESC);

-- RLS: org-scoped access for internal staff
ALTER TABLE portal_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_portal_submissions"
  ON portal_submissions
  FOR ALL
  USING (org_id = (
    SELECT org_id FROM user_profiles WHERE id = auth.uid()
  ));

-- Allow inserts from service_role (used by the public submission API)
CREATE POLICY "service_insert_portal_submissions"
  ON portal_submissions
  FOR INSERT
  WITH CHECK (true);
