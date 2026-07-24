-- =============================================================================
-- Verification — 20260720000001_wave2_domains
--
-- Asserts that all Wave 2 domain tables (Daily Plans, Dispatch, Installed
-- Systems) exist and have RLS enabled, and that read policies are present.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Wave 2 tables exist
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_plan_notes'),          'daily_plan_notes table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_plan_activations'),     'daily_plan_activations table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_plan_job_overrides'),   'daily_plan_job_overrides table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'crews'),                      'crews table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dispatch_plans'),             'dispatch_plans table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'crew_assignments'),           'crew_assignments table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schedule_blocks'),            'schedule_blocks table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dispatch_events'),            'dispatch_events table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'technical_profiles'),         'technical_profiles table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'installed_systems'),          'installed_systems table must exist';
END; $$;

-- ---------------------------------------------------------------------------
-- RLS enabled on all Wave 2 tables
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'daily_plan_notes'         AND c.rowsecurity = true), 'RLS must be enabled on daily_plan_notes';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'daily_plan_activations'    AND c.rowsecurity = true), 'RLS must be enabled on daily_plan_activations';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'daily_plan_job_overrides'  AND c.rowsecurity = true), 'RLS must be enabled on daily_plan_job_overrides';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'crews'                     AND c.rowsecurity = true), 'RLS must be enabled on crews';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'dispatch_plans'            AND c.rowsecurity = true), 'RLS must be enabled on dispatch_plans';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'crew_assignments'          AND c.rowsecurity = true), 'RLS must be enabled on crew_assignments';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'schedule_blocks'           AND c.rowsecurity = true), 'RLS must be enabled on schedule_blocks';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'dispatch_events'           AND c.rowsecurity = true), 'RLS must be enabled on dispatch_events';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'technical_profiles'        AND c.rowsecurity = true), 'RLS must be enabled on technical_profiles';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'installed_systems'         AND c.rowsecurity = true), 'RLS must be enabled on installed_systems';
END; $$;

-- ---------------------------------------------------------------------------
-- Org-scoped read policies present on key tables
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'daily_plan_notes'  AND policyname = 'daily_plan_notes: org read'),  'daily_plan_notes: org read policy must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crews'             AND policyname = 'crews: org read'),              'crews: org read policy must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'dispatch_plans'    AND policyname = 'dispatch_plans: org read'),     'dispatch_plans: org read policy must exist';
END; $$;
