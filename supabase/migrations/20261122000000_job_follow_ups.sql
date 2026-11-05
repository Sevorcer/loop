-- Migration: 20261122000000_job_follow_ups
-- Purpose: let the office mark a job "follow-up needed" (part on order, return
-- visit required) and work that list separately from Needs Attention.
--
-- follow_up_needed     boolean, NOT NULL default false - the flag.
-- follow_up_note       text, nullable - why (e.g. "waiting on blower motor").
-- follow_up_marked_at  timestamptz, nullable - stamped when marked, cleared on unmark.
-- follow_up_marked_by  uuid, nullable - user who marked it, cleared on unmark.
--
-- Column-only change on an existing table: no new RLS surface. The existing
-- jobs policies already govern who can read/update these columns. A completed
-- job may be marked (finished, waiting on a part is the normal case).
--
-- DOWN (manual rollback - ship as a new forward migration):
--   DROP INDEX IF EXISTS idx_jobs_follow_up_open;
--   ALTER TABLE jobs
--     DROP COLUMN IF EXISTS follow_up_marked_by,
--     DROP COLUMN IF EXISTS follow_up_marked_at,
--     DROP COLUMN IF EXISTS follow_up_note,
--     DROP COLUMN IF EXISTS follow_up_needed;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS follow_up_needed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS follow_up_note text,
  ADD COLUMN IF NOT EXISTS follow_up_marked_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_marked_by uuid;

-- The follow-ups list reads only open rows, newest mark first.
CREATE INDEX IF NOT EXISTS idx_jobs_follow_up_open
  ON jobs (org_id, follow_up_marked_at DESC)
  WHERE follow_up_needed;
