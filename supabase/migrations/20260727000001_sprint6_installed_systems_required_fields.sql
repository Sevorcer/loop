-- =============================================================================
-- Sprint 6 — Installed Systems required field additions
--
-- Adds manufacturer, model_number, and warranty_expiry to the installed_systems
-- table to support Epic 5 operational completion requirements.
--
-- All columns default to '' so existing rows are preserved without data loss.
--
-- DOWN (rollback):
--   ALTER TABLE installed_systems
--     DROP COLUMN IF EXISTS manufacturer,
--     DROP COLUMN IF EXISTS model_number,
--     DROP COLUMN IF EXISTS warranty_expiry;
-- =============================================================================

ALTER TABLE installed_systems
  ADD COLUMN IF NOT EXISTS manufacturer    text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS model_number    text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS warranty_expiry text NOT NULL DEFAULT '';
