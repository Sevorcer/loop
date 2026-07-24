-- =============================================================================
-- Verification — 20260719000001_baseline_core_schema
--
-- Asserts that all core tables, helper functions, and RLS are present after
-- the baseline migration is applied.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Core tables exist
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations'),      'organizations table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles'),      'user_profiles table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers'),           'customers table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'properties'),          'properties table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contractors'),         'contractors table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs'),                'jobs table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_activity'),        'job_activity table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portal_users'),        'portal_users table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portal_memberships'),  'portal_memberships table must exist';
END; $$;

-- ---------------------------------------------------------------------------
-- Required columns on high-impact tables
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'org_id'),    'user_profiles.org_id must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'app_role'),   'user_profiles.app_role must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers'     AND column_name = 'org_id'),      'customers.org_id must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'properties'    AND column_name = 'org_id'),      'properties.org_id must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs'          AND column_name = 'org_id'),      'jobs.org_id must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs'          AND column_name = 'assigned_user_id'), 'jobs.assigned_user_id must exist';
END; $$;

-- ---------------------------------------------------------------------------
-- Helper functions present
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'current_org_id'
  ), 'current_org_id() function must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'current_app_role'
  ), 'current_app_role() function must exist';
END; $$;

-- ---------------------------------------------------------------------------
-- RLS enabled on all core tables
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'organizations'     AND c.rowsecurity = true), 'RLS must be enabled on organizations';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'user_profiles'      AND c.rowsecurity = true), 'RLS must be enabled on user_profiles';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'customers'          AND c.rowsecurity = true), 'RLS must be enabled on customers';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'properties'         AND c.rowsecurity = true), 'RLS must be enabled on properties';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'contractors'        AND c.rowsecurity = true), 'RLS must be enabled on contractors';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'jobs'               AND c.rowsecurity = true), 'RLS must be enabled on jobs';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'job_activity'       AND c.rowsecurity = true), 'RLS must be enabled on job_activity';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'portal_users'       AND c.rowsecurity = true), 'RLS must be enabled on portal_users';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'portal_memberships' AND c.rowsecurity = true), 'RLS must be enabled on portal_memberships';
END; $$;

-- ---------------------------------------------------------------------------
-- Org-scoped read policies present on key tables
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customers' AND policyname = 'customers: org members read'),
    'customers: org members read policy must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'jobs' AND policyname = 'jobs: org members read'),
    'jobs: org members read policy must exist';
END; $$;
