-- =============================================================================
-- Policy 001 — RLS Baseline: Deny-by-Default
-- Sprint 24
--
-- Enables Row Level Security on every core table and adds a FORCE guard so
-- that even the table owner is subject to policy evaluation.
--
-- DEFAULT POSTURE: no row is accessible unless a subsequent ALLOW policy
-- explicitly permits it. Unauthenticated (anon) requests match nothing and
-- are fully blocked.
--
-- Apply after: migrations/001_core_schema.sql
-- Apply before: policies/002_role_policies.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: resolve current user's org_id
-- Used by all policy expressions to scope rows to the caller's organisation.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT org_id
  FROM user_profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

-- ---------------------------------------------------------------------------
-- Helper: resolve current user's app_role
-- Used by policy expressions to check role membership.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT app_role
  FROM user_profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

-- ---------------------------------------------------------------------------
-- organizations — RLS
-- Internal users see only their own org row.
-- ---------------------------------------------------------------------------

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

-- deny-by-default: no SELECT/INSERT/UPDATE/DELETE unless an ALLOW policy matches
-- (no permissive policy added here — added in 002_role_policies.sql)

-- ---------------------------------------------------------------------------
-- user_profiles — RLS
-- ---------------------------------------------------------------------------

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- customers — RLS
-- ---------------------------------------------------------------------------

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- properties — RLS
-- ---------------------------------------------------------------------------

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- contractors — RLS
-- ---------------------------------------------------------------------------

ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- jobs — RLS
-- ---------------------------------------------------------------------------

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- job_activity — RLS
-- ---------------------------------------------------------------------------

ALTER TABLE job_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_activity FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- portal_users — RLS
-- ---------------------------------------------------------------------------

ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- portal_memberships — RLS
-- ---------------------------------------------------------------------------

ALTER TABLE portal_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_memberships FORCE ROW LEVEL SECURITY;
