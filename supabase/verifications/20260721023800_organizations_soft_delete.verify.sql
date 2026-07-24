-- =============================================================================
-- Verification — 20260721023800_organizations_soft_delete
--
-- Asserts that the deleted_at column was added to organizations and that the
-- partial index for filtering live records is present.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Column exists (column add example)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'organizations'
      AND column_name  = 'deleted_at'
  ), 'organizations.deleted_at column must exist';
END; $$;

-- ---------------------------------------------------------------------------
-- Column is nullable timestamptz (not NOT NULL)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'organizations'
      AND column_name  = 'deleted_at'
      AND is_nullable  = 'YES'
      AND data_type    = 'timestamp with time zone'
  ), 'organizations.deleted_at must be a nullable timestamptz';
END; $$;

-- ---------------------------------------------------------------------------
-- Partial index for live records exists (index add example)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'organizations'
      AND indexname  = 'organizations_deleted_at_idx'
  ), 'organizations_deleted_at_idx partial index must exist';
END; $$;
