-- Migration: job_share_links
-- GC Portal — Task 1: Per-job share links for builder portal access
--
-- Each job can have at most one active (non-revoked) share link.
-- The raw token is shown once on creation; only the SHA-256 hash is stored.

CREATE TABLE IF NOT EXISTS job_share_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id      uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  created_by  uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz
);

-- Only one active (non-revoked) link per job per org
CREATE UNIQUE INDEX uq_job_share_links_active
  ON job_share_links (org_id, job_id)
  WHERE revoked_at IS NULL;

-- Fast lookup by token hash (portal resolution path)
CREATE INDEX idx_job_share_links_token_hash
  ON job_share_links (token_hash)
  WHERE revoked_at IS NULL;

-- RLS: org-scoped access
ALTER TABLE job_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_job_share_links"
  ON job_share_links
  FOR ALL
  USING (org_id = (
    SELECT org_id FROM user_profiles WHERE id = auth.uid()
  ));
