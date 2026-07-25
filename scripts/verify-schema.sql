-- =============================================================================
-- Schema Verification (Drift Guard)
-- scripts/verify-schema.sql
--
-- Run this script after applying migrations to confirm the expected schema
-- contract is satisfied.  It does NOT modify any data — read-only queries only.
--
-- Usage:
--   Supabase SQL Editor: paste and run
--   psql:  psql "$DATABASE_URL" -f scripts/verify-schema.sql
--
-- Exit interpretation:
--   If any row in the "tables_check" or "columns_check" results shows
--   status = 'MISSING', the schema is out of sync and the relevant migration
--   should be re-applied (or the new migration should be authored).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Required tables
-- ---------------------------------------------------------------------------

WITH required_tables (table_name) AS (
  VALUES
    -- core schema (20260719000001)
    ('organizations'),
    ('user_profiles'),
    ('customers'),
    ('properties'),
    ('contractors'),
    ('jobs'),
    ('job_activity'),
    ('portal_users'),
    ('portal_memberships'),
    -- wave 2 domain tables (20260720000001)
    ('daily_plan_notes'),
    ('daily_plan_activations'),
    ('daily_plan_job_overrides'),
    ('crews'),
    ('dispatch_plans'),
    ('crew_assignments'),
    ('schedule_blocks'),
    ('dispatch_events'),
    ('technical_profiles'),
    ('installed_systems'),
    -- property artifacts (20260721014500)
    ('property_documents'),
    ('property_photos'),
    -- sprint 27 platform services (20260721060000)
    ('storage_objects'),
    ('gc_issue_requests'),
    ('gc_issue_attachments'),
    ('knowledge_items'),
    ('knowledge_relationships'),
    ('knowledge_usage'),
    ('portal_projects'),
    ('portal_milestones'),
    ('portal_documents'),
    ('portal_photos'),
    ('performance_models')
)
SELECT
  r.table_name,
  CASE WHEN t.table_name IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM required_tables r
LEFT JOIN information_schema.tables t
  ON  t.table_schema = 'public'
  AND t.table_name   = r.table_name
ORDER BY status DESC, r.table_name;

-- ---------------------------------------------------------------------------
-- 2. Required columns on high-impact tables
-- ---------------------------------------------------------------------------

WITH required_columns (table_name, column_name) AS (
  VALUES
    -- organizations
    ('organizations', 'id'),
    ('organizations', 'name'),
    ('organizations', 'created_at'),
    ('organizations', 'updated_at'),
    ('organizations', 'deleted_at'),         -- added by 20260721023800
    -- user_profiles
    ('user_profiles', 'id'),
    ('user_profiles', 'org_id'),
    ('user_profiles', 'full_name'),
    ('user_profiles', 'app_role'),
    ('user_profiles', 'created_at'),
    ('user_profiles', 'updated_at'),
    -- customers
    ('customers', 'id'),
    ('customers', 'org_id'),
    ('customers', 'name'),
    ('customers', 'primary_contact'),
    ('customers', 'email'),
    ('customers', 'phone'),
    ('customers', 'city'),
    ('customers', 'status'),
    ('customers', 'created_at'),
    ('customers', 'updated_at'),
    -- properties
    ('properties', 'id'),
    ('properties', 'org_id'),
    ('properties', 'customer_id'),
    ('properties', 'name'),
    ('properties', 'address'),
    ('properties', 'city'),
    ('properties', 'type'),
    ('properties', 'status'),
    ('properties', 'created_at'),
    ('properties', 'updated_at'),
    -- jobs
    ('jobs', 'id'),
    ('jobs', 'org_id'),
    ('jobs', 'job_number'),
    ('jobs', 'title'),
    ('jobs', 'type'),
    ('jobs', 'status'),
    ('jobs', 'priority'),
    ('jobs', 'customer_id'),
    ('jobs', 'property_id'),
    ('jobs', 'assigned_user_id'),
    ('jobs', 'scheduled_for'),
    ('jobs', 'created_at'),
    ('jobs', 'updated_at'),
    -- contractors
    ('contractors', 'id'),
    ('contractors', 'org_id'),
    ('contractors', 'company_name'),
    ('contractors', 'active'),
    ('contractors', 'created_at'),
    ('contractors', 'updated_at'),
    -- job_activity
    ('job_activity', 'id'),
    ('job_activity', 'org_id'),
    ('job_activity', 'job_id'),
    ('job_activity', 'actor_id'),
    ('job_activity', 'type'),
    ('job_activity', 'created_at'),
    -- portal_users
    ('portal_users', 'id'),
    ('portal_users', 'org_id'),
    ('portal_users', 'auth_uid'),
    ('portal_users', 'email'),
    -- portal_memberships
    ('portal_memberships', 'id'),
    ('portal_memberships', 'org_id'),
    ('portal_memberships', 'portal_user_id'),
    ('portal_memberships', 'roles'),
    ('portal_memberships', 'is_revoked')
)
SELECT
  r.table_name,
  r.column_name,
  CASE WHEN c.column_name IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM required_columns r
LEFT JOIN information_schema.columns c
  ON  c.table_schema = 'public'
  AND c.table_name   = r.table_name
  AND c.column_name  = r.column_name
ORDER BY status DESC, r.table_name, r.column_name;

-- ---------------------------------------------------------------------------
-- 3. RLS enabled on all required tables
-- ---------------------------------------------------------------------------

WITH required_rls (table_name) AS (
  VALUES
    ('organizations'),
    ('user_profiles'),
    ('customers'),
    ('properties'),
    ('contractors'),
    ('jobs'),
    ('job_activity'),
    ('portal_users'),
    ('portal_memberships'),
    ('daily_plan_notes'),
    ('daily_plan_activations'),
    ('daily_plan_job_overrides'),
    ('crews'),
    ('dispatch_plans'),
    ('crew_assignments'),
    ('schedule_blocks'),
    ('dispatch_events'),
    ('technical_profiles'),
    ('installed_systems'),
    ('property_documents'),
    ('property_photos'),
    ('storage_objects'),
    ('gc_issue_requests'),
    ('gc_issue_attachments'),
    ('knowledge_items'),
    ('knowledge_relationships'),
    ('knowledge_usage'),
    ('portal_projects'),
    ('portal_milestones'),
    ('portal_documents'),
    ('portal_photos'),
    ('performance_models')
)
SELECT
  r.table_name,
  CASE
    WHEN pt.rowsecurity  THEN 'RLS_ENABLED'
    WHEN pt.relname IS NULL THEN 'TABLE_MISSING'
    ELSE 'RLS_DISABLED'
  END AS rls_status
FROM required_rls r
LEFT JOIN pg_class    pt  ON pt.relname     = r.table_name
LEFT JOIN pg_namespace pn ON pn.oid         = pt.relnamespace
                         AND pn.nspname     = 'public'
ORDER BY
  CASE
    WHEN pt.rowsecurity  THEN 2
    WHEN pt.relname IS NULL THEN 0
    ELSE 1
  END,
  r.table_name;

-- ---------------------------------------------------------------------------
-- 4. Helper functions present
-- ---------------------------------------------------------------------------

SELECT
  routine_name,
  'OK' AS status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('current_org_id', 'current_app_role')
ORDER BY routine_name;

-- ---------------------------------------------------------------------------
-- 5. Required PostgreSQL extensions present
-- ---------------------------------------------------------------------------

WITH required_extensions (extname) AS (
  VALUES
    ('uuid-ossp'),
    ('pgcrypto')
)
SELECT
  r.extname,
  CASE WHEN e.extname IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM required_extensions r
LEFT JOIN pg_extension e ON e.extname = r.extname
ORDER BY status DESC, r.extname;

-- ---------------------------------------------------------------------------
-- 6. Required indexes present
-- ---------------------------------------------------------------------------

WITH required_indexes (tablename, indexname) AS (
  VALUES
    -- baseline core schema (20260719000001)
    ('user_profiles',        'user_profiles_org_id_idx'),
    ('customers',            'customers_org_id_idx'),
    ('properties',           'properties_org_id_idx'),
    ('properties',           'properties_customer_id_idx'),
    ('contractors',          'contractors_org_id_idx'),
    ('jobs',                 'jobs_org_id_idx'),
    ('jobs',                 'jobs_assigned_user_id_idx'),
    ('jobs',                 'jobs_status_idx'),
    ('job_activity',         'job_activity_job_id_idx'),
    ('job_activity',         'job_activity_org_id_idx'),
    ('portal_users',         'portal_users_org_id_idx'),
    ('portal_users',         'portal_users_auth_uid_idx'),
    ('portal_memberships',   'portal_memberships_portal_user_id_idx'),
    ('portal_memberships',   'portal_memberships_org_id_idx'),
    -- wave 2 domains (20260720000001)
    ('daily_plan_notes',        'daily_plan_notes_org_date_idx'),
    ('daily_plan_activations',  'daily_plan_activations_org_date_idx'),
    ('dispatch_plans',          'dispatch_plans_org_date_idx'),
    ('installed_systems',       'installed_systems_property_id_idx'),
    -- organizations soft-delete (20260721023800)
    ('organizations',        'organizations_deleted_at_idx'),
    -- db health checks (20260724000001)
    ('db_health_check_runs',    'db_health_check_runs_run_at_idx'),
    ('db_health_check_results', 'db_health_check_results_run_id_idx')
)
SELECT
  r.tablename,
  r.indexname,
  CASE WHEN i.indexname IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM required_indexes r
LEFT JOIN pg_indexes i
  ON  i.schemaname = 'public'
  AND i.tablename  = r.tablename
  AND i.indexname  = r.indexname
ORDER BY status DESC, r.tablename, r.indexname;
