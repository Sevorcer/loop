-- Add soft-delete support to jobs table.
-- deleted_at is nullable; NULL means the job is active.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Partial index: the vast majority of queries filter on active (non-deleted) jobs.
-- This index covers the common read path efficiently.
CREATE INDEX IF NOT EXISTS idx_jobs_active_org
  ON jobs (org_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Comment for documentation.
COMMENT ON COLUMN jobs.deleted_at IS 'Soft-delete timestamp. NULL = active; non-NULL = logically deleted.';
