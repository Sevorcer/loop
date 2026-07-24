-- =============================================================================
-- Verification — 20240101000000_initial_schema
--
-- Asserts that the Postgres extensions required by all subsequent migrations
-- are installed and available in the database.
-- =============================================================================

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'
  ), 'uuid-ossp extension must be installed';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
  ), 'pgcrypto extension must be installed';
END; $$;
