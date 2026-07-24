-- =============================================================================
-- Sprint 28 — DB Health Check Tables and Helper Functions
--
-- Issue #114: Implement daily DB health check job
-- Issue #116: Build DB health dashboard + alert routing
--
-- Tables:
--   db_health_check_runs    — one row per execution (daily, manual, pre-deploy)
--   db_health_check_results — individual check outcomes within a run
--
-- SQL helper functions (SECURITY DEFINER, callable via supabase.rpc()):
--   dbhc_null_org_id()        — required non-null org_id in core tables
--   dbhc_orphan_fk()          — orphan foreign-key references
--   dbhc_required_indexes()   — required indexes present
--   dbhc_rls_coverage()       — RLS enabled on core tables
--   dbhc_migration_count()    — count of applied migrations
--
-- RLS: service_role may insert; owner/manager roles may select.
--      No sensitive DB details are returned — only counts and boolean flags.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- db_health_check_runs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS db_health_check_runs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at         timestamptz NOT NULL DEFAULT now(),
  trigger        text        NOT NULL DEFAULT 'scheduled'
                             CHECK (trigger IN ('scheduled','manual','pre_deploy')),
  overall_status text        NOT NULL DEFAULT 'unknown'
                             CHECK (overall_status IN ('pass','fail','partial','unknown')),
  check_count    int         NOT NULL DEFAULT 0,
  pass_count     int         NOT NULL DEFAULT 0,
  fail_count     int         NOT NULL DEFAULT 0,
  duration_ms    int,
  ci_run_url     text,
  git_sha        text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS db_health_check_runs_run_at_idx ON db_health_check_runs(run_at DESC);

-- ---------------------------------------------------------------------------
-- db_health_check_results
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS db_health_check_results (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         uuid        NOT NULL REFERENCES db_health_check_runs(id) ON DELETE CASCADE,
  check_name     text        NOT NULL,
  check_category text        NOT NULL
                             CHECK (check_category IN ('schema','integrity','indexes','rls','migrations')),
  status         text        NOT NULL
                             CHECK (status IN ('pass','fail','skip')),
  severity       text        NOT NULL DEFAULT 'warning'
                             CHECK (severity IN ('critical','warning','info')),
  owner          text        NOT NULL DEFAULT 'platform-team',
  message        text,
  detail         jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS db_health_check_results_run_id_idx ON db_health_check_results(run_id);
CREATE INDEX IF NOT EXISTS db_health_check_results_status_idx ON db_health_check_results(run_id, status);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE db_health_check_runs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_health_check_results ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (for CI writes).

-- Authenticated platform users with owner or manager roles may read runs.
CREATE POLICY "runs_select_owner_manager"
  ON db_health_check_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.app_role IN ('owner', 'manager')
    )
  );

-- Authenticated platform users with owner or manager roles may read results.
CREATE POLICY "results_select_owner_manager"
  ON db_health_check_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.app_role IN ('owner', 'manager')
    )
  );

-- ---------------------------------------------------------------------------
-- Health-check helper functions
-- All use SECURITY DEFINER so the service role may call them without
-- worrying about table-level grants. They return only counts and boolean
-- flags — no raw row data that could expose sensitive information.
-- ---------------------------------------------------------------------------

-- Check 1: Required non-null columns in core tables (schema integrity)
-- Returns one row per table/column combination that violates the expectation.
-- A null_count > 0 means data exists that should not be there.
CREATE OR REPLACE FUNCTION dbhc_null_org_id()
RETURNS TABLE(table_name text, null_count bigint)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 'customers'::text,  COUNT(*) FROM customers  WHERE org_id IS NULL
  UNION ALL
  SELECT 'properties'::text, COUNT(*) FROM properties WHERE org_id IS NULL
  UNION ALL
  SELECT 'jobs'::text,       COUNT(*) FROM jobs       WHERE org_id IS NULL;
$$;

-- Check 2: Orphan foreign-key references (data integrity)
-- Returns one row per FK relationship checked.
-- orphan_count > 0 means there are rows referencing deleted parents.
CREATE OR REPLACE FUNCTION dbhc_orphan_fk()
RETURNS TABLE(relationship text, orphan_count bigint)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    'jobs.customer_id → customers'::text,
    COUNT(*)
  FROM jobs j
  LEFT JOIN customers c ON c.id = j.customer_id
  WHERE j.customer_id IS NOT NULL AND c.id IS NULL
  UNION ALL
  SELECT
    'properties.customer_id → customers'::text,
    COUNT(*)
  FROM properties p
  LEFT JOIN customers c ON c.id = p.customer_id
  WHERE p.customer_id IS NOT NULL AND c.id IS NULL
  UNION ALL
  SELECT
    'jobs.property_id → properties'::text,
    COUNT(*)
  FROM jobs j
  LEFT JOIN properties pr ON pr.id = j.property_id
  WHERE j.property_id IS NOT NULL AND pr.id IS NULL;
$$;

-- Check 3: Required indexes are present (performance)
-- Returns one row per expected index: index_exists = true when present.
CREATE OR REPLACE FUNCTION dbhc_required_indexes()
RETURNS TABLE(index_name text, index_exists boolean)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH required(idx) AS (
    VALUES
      ('customers_org_id_idx'),
      ('properties_org_id_idx'),
      ('jobs_org_id_idx'),
      ('user_profiles_org_id_idx'),
      ('db_health_check_runs_run_at_idx'),
      ('db_health_check_results_run_id_idx')
  )
  SELECT
    r.idx::text,
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = r.idx
    )
  FROM required r;
$$;

-- Check 4: RLS enabled on core tables (security)
-- Returns one row per core table: rls_enabled = true when RLS is on.
CREATE OR REPLACE FUNCTION dbhc_rls_coverage()
RETURNS TABLE(table_name text, rls_enabled boolean)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    relname::text,
    relrowsecurity
  FROM pg_class
  WHERE relnamespace = 'public'::regnamespace
    AND relname IN (
      'customers', 'properties', 'jobs', 'organizations',
      'user_profiles', 'installed_systems', 'knowledge_items',
      'portal_projects', 'db_health_check_runs', 'db_health_check_results'
    )
  ORDER BY relname;
$$;

-- Check 5: Migration history consistency
-- Returns the count of migrations recorded in the Supabase schema migrations
-- tracking table. Compare against the expected count to detect drift.
CREATE OR REPLACE FUNCTION dbhc_migration_count()
RETURNS TABLE(applied_count bigint)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::bigint
  FROM supabase_migrations.schema_migrations;
$$;
