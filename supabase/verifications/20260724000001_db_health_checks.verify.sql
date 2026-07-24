-- =============================================================================
-- Verification — 20260724000001_db_health_checks
--
-- Asserts that the DB health check tables exist, RLS is enabled, and
-- owner/manager select policies are present.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tables exist
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'db_health_check_runs'),    'db_health_check_runs table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'db_health_check_results'), 'db_health_check_results table must exist';
END; $$;

-- ---------------------------------------------------------------------------
-- Required columns
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'db_health_check_runs'    AND column_name = 'overall_status'), 'db_health_check_runs.overall_status must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'db_health_check_runs'    AND column_name = 'trigger'),         'db_health_check_runs.trigger must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'db_health_check_results' AND column_name = 'run_id'),          'db_health_check_results.run_id must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'db_health_check_results' AND column_name = 'check_name'),      'db_health_check_results.check_name must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'db_health_check_results' AND column_name = 'status'),          'db_health_check_results.status must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'db_health_check_results' AND column_name = 'severity'),        'db_health_check_results.severity must exist';
END; $$;

-- ---------------------------------------------------------------------------
-- RLS enabled
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'db_health_check_runs'    AND c.rowsecurity = true), 'RLS must be enabled on db_health_check_runs';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'db_health_check_results' AND c.rowsecurity = true), 'RLS must be enabled on db_health_check_results';
END; $$;

-- ---------------------------------------------------------------------------
-- Owner/manager select policies present
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'db_health_check_runs'    AND policyname = 'runs_select_owner_manager'),    'runs_select_owner_manager policy must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'db_health_check_results' AND policyname = 'results_select_owner_manager'), 'results_select_owner_manager policy must exist';
END; $$;

-- ---------------------------------------------------------------------------
-- Indexes present
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'db_health_check_runs'    AND indexname = 'db_health_check_runs_run_at_idx'),    'db_health_check_runs_run_at_idx index must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'db_health_check_results' AND indexname = 'db_health_check_results_run_id_idx'), 'db_health_check_results_run_id_idx index must exist';
END; $$;
