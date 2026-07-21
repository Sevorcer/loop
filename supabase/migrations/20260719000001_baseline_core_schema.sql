-- =============================================================================
-- Baseline — Core Schema, Helper Functions, RLS, and Role Policies
--
-- This migration consolidates the authoritative schema from:
--   database/migrations/001_core_schema.sql
--   database/policies/001_rls_baseline.sql
--   database/policies/002_role_policies.sql
--
-- After this migration supabase/migrations/ becomes the single source of
-- truth.  The database/ folder is retained as human-readable reference only
-- and must NOT diverge from supabase/migrations/.
--
-- All table DDL uses CREATE … IF NOT EXISTS so the migration is safe to apply
-- against an environment that already has some tables in place.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extension prerequisites
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- organizations
-- Every row in all operational tables belongs to exactly one organization.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- user_profiles
-- Extends auth.users with org membership and the LOOP app role.
-- The `app_role` column drives all RLS policy expressions.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id),
  full_name   text,
  app_role    text NOT NULL CHECK (
                app_role IN ('owner','manager','dispatch','tech','office','sales','portal')
              ),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_profiles_org_id_idx ON user_profiles(id, org_id);

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS customers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id),
  name             text NOT NULL,
  primary_contact  text NOT NULL DEFAULT '',
  email            text NOT NULL DEFAULT '',
  phone            text NOT NULL DEFAULT '',
  city             text NOT NULL DEFAULT '',
  status           text NOT NULL DEFAULT 'Active'
                   CHECK (status IN ('Active','Prospect','Inactive')),
  property_count   integer NOT NULL DEFAULT 0,
  open_jobs        integer NOT NULL DEFAULT 0,
  last_activity    date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_org_id_idx ON customers(org_id);

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS properties (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id),
  customer_id      uuid REFERENCES customers(id),
  name             text NOT NULL,
  address          text NOT NULL DEFAULT '',
  city             text NOT NULL DEFAULT '',
  type             text NOT NULL DEFAULT 'Residential'
                   CHECK (type IN ('Residential','Commercial','Multi-Family')),
  status           text NOT NULL DEFAULT 'Active'
                   CHECK (status IN ('Active','Pending','Inactive')),
  primary_system   text NOT NULL DEFAULT '',
  open_jobs        integer NOT NULL DEFAULT 0,
  last_visit       date,
  latitude         numeric,
  longitude        numeric,
  formatted_address text,
  place_id         text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS properties_org_id_idx ON properties(org_id);
CREATE INDEX IF NOT EXISTS properties_customer_id_idx ON properties(customer_id);

-- ---------------------------------------------------------------------------
-- contractors
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contractors (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id),
  company_name   text NOT NULL,
  contact_name   text NOT NULL DEFAULT '',
  email          text NOT NULL DEFAULT '',
  phone          text NOT NULL DEFAULT '',
  trade          text NOT NULL DEFAULT ''
                 CHECK (trade IN ('HVAC','Electrical','Plumbing','Roofing','General','Other','')),
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contractors_org_id_idx ON contractors(org_id);

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS jobs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organizations(id),
  job_number           text NOT NULL,
  estimate_id          text,
  equipment_bundle_id  text,
  title                text NOT NULL,
  type                 text NOT NULL
                       CHECK (type IN ('Install','Service','Maintenance','Inspection')),
  status               text NOT NULL DEFAULT 'Scheduled'
                       CHECK (status IN ('Scheduled','In Progress','On Hold','Completed','Cancelled')),
  priority             text NOT NULL DEFAULT 'Medium'
                       CHECK (priority IN ('Low','Medium','High')),
  customer_id          uuid REFERENCES customers(id),
  customer_name        text NOT NULL DEFAULT '',
  property_id          uuid REFERENCES properties(id),
  property_name        text NOT NULL DEFAULT '',
  assigned_to          text NOT NULL DEFAULT '',
  assigned_user_id     uuid REFERENCES auth.users(id),
  scheduled_for        date,
  summary              text NOT NULL DEFAULT '',
  location             text NOT NULL DEFAULT '',
  notes                text NOT NULL DEFAULT '',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jobs_org_id_idx ON jobs(org_id);
CREATE INDEX IF NOT EXISTS jobs_assigned_user_id_idx ON jobs(assigned_user_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);

-- ---------------------------------------------------------------------------
-- job_activity
-- Immutable log of state transitions and events for each job.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS job_activity (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  job_id       uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  actor_id     uuid REFERENCES auth.users(id),
  type         text NOT NULL,
  title        text NOT NULL DEFAULT '',
  description  text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_activity_job_id_idx ON job_activity(job_id);
CREATE INDEX IF NOT EXISTS job_activity_org_id_idx ON job_activity(org_id);

-- ---------------------------------------------------------------------------
-- portal_users
-- External (customer-facing) portal accounts, entirely separate from
-- internal `auth.users` / `user_profiles` tables.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS portal_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  auth_uid    uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT '',
  email       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_users_org_id_idx ON portal_users(org_id);
CREATE INDEX IF NOT EXISTS portal_users_auth_uid_idx ON portal_users(auth_uid);

-- ---------------------------------------------------------------------------
-- portal_memberships
-- Links a portal_user to an org with a set of portal roles.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS portal_memberships (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id),
  portal_user_id   uuid NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  roles            text[] NOT NULL DEFAULT '{}',
  is_revoked       boolean NOT NULL DEFAULT false,
  invite_expires_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_memberships_portal_user_id_idx ON portal_memberships(portal_user_id);
CREATE INDEX IF NOT EXISTS portal_memberships_org_id_idx ON portal_memberships(org_id);

-- =============================================================================
-- RLS BASELINE — Helper Functions + Deny-by-Default
-- Source: database/policies/001_rls_baseline.sql
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
-- Enable RLS — deny-by-default on every core table.
-- No row is accessible unless an explicit ALLOW policy below matches.
-- ---------------------------------------------------------------------------

ALTER TABLE organizations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations      FORCE  ROW LEVEL SECURITY;

ALTER TABLE user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles      FORCE  ROW LEVEL SECURITY;

ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers          FORCE  ROW LEVEL SECURITY;

ALTER TABLE properties         ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties         FORCE  ROW LEVEL SECURITY;

ALTER TABLE contractors        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors        FORCE  ROW LEVEL SECURITY;

ALTER TABLE jobs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs               FORCE  ROW LEVEL SECURITY;

ALTER TABLE job_activity       ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_activity       FORCE  ROW LEVEL SECURITY;

ALTER TABLE portal_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users       FORCE  ROW LEVEL SECURITY;

ALTER TABLE portal_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_memberships FORCE  ROW LEVEL SECURITY;

-- =============================================================================
-- ROLE POLICIES — Per-role allow policies
-- Source: database/policies/002_role_policies.sql
--
-- All policies are PERMISSIVE (additive).  The deny-by-default from RLS
-- enablement above remains in force — only rows matching at least one ALLOW
-- policy below are returned.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------

CREATE POLICY "org: owner/manager can read own org"
  ON organizations FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager')
    AND id = current_org_id()
  );

CREATE POLICY "org: owner can update own org"
  ON organizations FOR UPDATE
  USING (
    current_app_role() = 'owner'
    AND id = current_org_id()
  );

-- ---------------------------------------------------------------------------
-- user_profiles
-- ---------------------------------------------------------------------------

CREATE POLICY "user_profiles: internal roles can read own org"
  ON user_profiles FOR SELECT
  USING (
    current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
    AND org_id = current_org_id()
  );

CREATE POLICY "user_profiles: user reads own row"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "user_profiles: owner can insert"
  ON user_profiles FOR INSERT
  WITH CHECK (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );

CREATE POLICY "user_profiles: owner can update"
  ON user_profiles FOR UPDATE
  USING (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );

CREATE POLICY "user_profiles: owner can delete"
  ON user_profiles FOR DELETE
  USING (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------

CREATE POLICY "customers: read for internal operational roles"
  ON customers FOR SELECT
  USING (
    current_app_role() IN ('owner','manager','dispatch','office','sales')
    AND org_id = current_org_id()
  );

CREATE POLICY "customers: insert for owner/manager/office/sales"
  ON customers FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner','manager','office','sales')
    AND org_id = current_org_id()
  );

CREATE POLICY "customers: update for owner/manager/office/sales"
  ON customers FOR UPDATE
  USING (
    current_app_role() IN ('owner','manager','office','sales')
    AND org_id = current_org_id()
  );

CREATE POLICY "customers: delete for owner only"
  ON customers FOR DELETE
  USING (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------

CREATE POLICY "properties: read for internal operational roles"
  ON properties FOR SELECT
  USING (
    current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
    AND org_id = current_org_id()
  );

CREATE POLICY "properties: insert for owner/manager/office/sales"
  ON properties FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner','manager','office','sales')
    AND org_id = current_org_id()
  );

CREATE POLICY "properties: update for owner/manager/office/sales"
  ON properties FOR UPDATE
  USING (
    current_app_role() IN ('owner','manager','office','sales')
    AND org_id = current_org_id()
  );

CREATE POLICY "properties: delete for owner only"
  ON properties FOR DELETE
  USING (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );

-- ---------------------------------------------------------------------------
-- contractors
-- ---------------------------------------------------------------------------

CREATE POLICY "contractors: read for operational roles"
  ON contractors FOR SELECT
  USING (
    current_app_role() IN ('owner','manager','dispatch','tech')
    AND org_id = current_org_id()
  );

CREATE POLICY "contractors: insert for owner/manager"
  ON contractors FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner','manager')
    AND org_id = current_org_id()
  );

CREATE POLICY "contractors: update for owner/manager"
  ON contractors FOR UPDATE
  USING (
    current_app_role() IN ('owner','manager')
    AND org_id = current_org_id()
  );

CREATE POLICY "contractors: delete for owner only"
  ON contractors FOR DELETE
  USING (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------

CREATE POLICY "jobs: read for owner/manager/dispatch/office/sales"
  ON jobs FOR SELECT
  USING (
    current_app_role() IN ('owner','manager','dispatch','office','sales')
    AND org_id = current_org_id()
  );

CREATE POLICY "jobs: tech reads own assigned jobs"
  ON jobs FOR SELECT
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND assigned_user_id = auth.uid()
  );

CREATE POLICY "jobs: insert for owner/manager/office"
  ON jobs FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner','manager','office')
    AND org_id = current_org_id()
  );

CREATE POLICY "jobs: update for owner/manager/dispatch"
  ON jobs FOR UPDATE
  USING (
    current_app_role() IN ('owner','manager','dispatch')
    AND org_id = current_org_id()
  );

CREATE POLICY "jobs: tech updates own assigned jobs"
  ON jobs FOR UPDATE
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND assigned_user_id = auth.uid()
  );

CREATE POLICY "jobs: delete for owner only"
  ON jobs FOR DELETE
  USING (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );

-- ---------------------------------------------------------------------------
-- job_activity
-- ---------------------------------------------------------------------------

CREATE POLICY "job_activity: read for owner/manager/dispatch/office"
  ON job_activity FOR SELECT
  USING (
    current_app_role() IN ('owner','manager','dispatch','office')
    AND org_id = current_org_id()
  );

CREATE POLICY "job_activity: tech reads own job activity"
  ON job_activity FOR SELECT
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND job_id IN (
      SELECT id FROM jobs
      WHERE assigned_user_id = auth.uid()
      AND org_id = current_org_id()
    )
  );

CREATE POLICY "job_activity: insert for owner/manager/dispatch"
  ON job_activity FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner','manager','dispatch')
    AND org_id = current_org_id()
  );

CREATE POLICY "job_activity: tech inserts on own assigned jobs"
  ON job_activity FOR INSERT
  WITH CHECK (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND actor_id = auth.uid()
    AND job_id IN (
      SELECT id FROM jobs
      WHERE assigned_user_id = auth.uid()
      AND org_id = current_org_id()
    )
  );

-- ---------------------------------------------------------------------------
-- portal_users
-- ---------------------------------------------------------------------------

CREATE POLICY "portal_users: owner/manager can read"
  ON portal_users FOR SELECT
  USING (
    current_app_role() IN ('owner','manager')
    AND org_id = current_org_id()
  );

CREATE POLICY "portal_users: portal user reads own row"
  ON portal_users FOR SELECT
  USING (auth_uid = auth.uid());

CREATE POLICY "portal_users: owner/manager can insert"
  ON portal_users FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner','manager')
    AND org_id = current_org_id()
  );

CREATE POLICY "portal_users: owner/manager can update"
  ON portal_users FOR UPDATE
  USING (
    current_app_role() IN ('owner','manager')
    AND org_id = current_org_id()
  );

CREATE POLICY "portal_users: portal user updates own row"
  ON portal_users FOR UPDATE
  USING (auth_uid = auth.uid());

CREATE POLICY "portal_users: owner can delete"
  ON portal_users FOR DELETE
  USING (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );

-- ---------------------------------------------------------------------------
-- portal_memberships
-- ---------------------------------------------------------------------------

CREATE POLICY "portal_memberships: owner/manager can read"
  ON portal_memberships FOR SELECT
  USING (
    current_app_role() IN ('owner','manager')
    AND org_id = current_org_id()
  );

CREATE POLICY "portal_memberships: portal user reads own membership"
  ON portal_memberships FOR SELECT
  USING (
    portal_user_id IN (
      SELECT id FROM portal_users WHERE auth_uid = auth.uid()
    )
  );

CREATE POLICY "portal_memberships: owner/manager can insert"
  ON portal_memberships FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner','manager')
    AND org_id = current_org_id()
  );

CREATE POLICY "portal_memberships: owner/manager can update"
  ON portal_memberships FOR UPDATE
  USING (
    current_app_role() IN ('owner','manager')
    AND org_id = current_org_id()
  );

CREATE POLICY "portal_memberships: owner can delete"
  ON portal_memberships FOR DELETE
  USING (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );
