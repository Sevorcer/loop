-- =============================================================================
-- Migration — <Short description>
-- Sprint <N> PR <Letter> / Issue #<N>
--
-- Summary of what this migration does.
--
-- UP:
--   - <bullet describing structural change 1>
--   - <bullet describing structural change 2>
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   <reverse DDL statements, e.g.:>
--   DROP TABLE IF EXISTS <table>;
--   ALTER TABLE <table> DROP COLUMN IF EXISTS <column>;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- <Section heading — e.g. "Create my_table">
-- <Brief description of intent.>
-- ---------------------------------------------------------------------------

-- <Your DDL here>

-- ---------------------------------------------------------------------------
-- RLS
-- (Required for every new table. Omit this section for column/index-only migrations.)
-- ---------------------------------------------------------------------------

-- ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE <table> FORCE ROW LEVEL SECURITY;

-- CREATE POLICY "<table>: org read"
--   ON <table> FOR SELECT
--   USING (
--     org_id = current_org_id()
--     AND current_app_role() IN ('owner', 'manager', ...)
--   );

-- CREATE POLICY "<table>: org write"
--   ON <table> FOR ALL
--   USING (org_id = current_org_id())
--   WITH CHECK (
--     org_id = current_org_id()
--     AND current_app_role() IN ('owner', 'manager', ...)
--   );

-- =============================================================================
-- POST-MIGRATION CHECKLIST
--
-- After authoring this file:
--
--   1. Create the companion verification file:
--      supabase/verifications/<TIMESTAMP>_<description>.verify.sql
--      (same timestamp + description as this file, extension = .verify.sql)
--
--   2. Add assertions for every structural and security outcome:
--      - Table exists
--      - Required columns exist
--      - RLS is enabled (for new tables)
--      - Expected policies are present (for new/changed policies)
--      - Expected indexes are present (for new indexes)
--
--   3. Update docs/architecture/security/rls-role-matrix.md if a new table
--      was added.
--
--   4. Run local hygiene check (no database credentials needed):
--        bash scripts/verify-migrations.sh
--
--   See docs/migration-verification-standard.md for the full standard.
-- =============================================================================
