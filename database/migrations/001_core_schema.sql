-- =============================================================================
-- Migration 001 — Core Schema
-- Sprint 24
--
-- Creates the core operational tables required for LOOP's first-pass Supabase
-- integration. All tables include:
--   - org_id  for multi-tenant row isolation
--   - id      as a UUID primary key
--   - standard audit timestamps
--
-- Every table's `org_id` references the `organizations` table (also defined
-- here) so that RLS policies can scope rows to the authenticated user's org.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extension prerequisites
-- ---------------------------------------------------------------------------

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

-- Index: org lookup used by every policy expression
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
-- External (customer-facing) portal accounts, entirely separate from the
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
-- Invitation expiry and revocation are enforced here.
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
