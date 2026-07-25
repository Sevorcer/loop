-- ---------------------------------------------------------------------------
-- Sprint 29 — Organizations soft-delete support
--
-- Adds a nullable `deleted_at` timestamptz column to organizations so that
-- delete operations can be soft-deletes (preserve row, stamp timestamp)
-- rather than hard-deletes.  A partial index ensures efficient filtering
-- of live (non-deleted) records.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP INDEX IF EXISTS organizations_deleted_at_idx;
--   ALTER TABLE organizations DROP COLUMN IF EXISTS deleted_at;
-- ---------------------------------------------------------------------------

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS organizations_deleted_at_idx
  ON organizations (deleted_at)
  WHERE deleted_at IS NULL;
