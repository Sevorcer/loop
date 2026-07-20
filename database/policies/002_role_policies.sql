-- =============================================================================
-- Policy 002 — Role-Based Allow Policies
-- Sprint 24
--
-- Grants explicit per-role access to core tables.
-- All policies are PERMISSIVE (additive); the baseline deny-by-default from
-- 001_rls_baseline.sql remains in force — only rows that match at least one
-- ALLOW policy below are returned.
--
-- Role reference:
--   owner    — company owner; full read/write on all internal tables
--   manager  — operations manager; full operational r/w, no hard-delete
--   dispatch — dispatcher; read operational data, update job status
--   tech     — field technician; read/update own assigned jobs
--   office   — office staff; create/read customers + properties, read jobs
--   sales    — sales team; manage customers + properties, read jobs
--   portal   — external portal user; isolated from all internal tables
--
-- Apply after: policies/001_rls_baseline.sql
-- =============================================================================

-- =============================================================================
-- ORGANIZATIONS
-- =============================================================================

-- owner, manager — read own org row
CREATE POLICY "org: owner/manager can read own org"
  ON organizations FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager')
    AND id = current_org_id()
  );

-- owner — can update their org record (name etc.)
CREATE POLICY "org: owner can update own org"
  ON organizations FOR UPDATE
  USING (
    current_app_role() = 'owner'
    AND id = current_org_id()
  );

-- =============================================================================
-- USER_PROFILES
-- =============================================================================

-- All internal roles — read profiles within own org
CREATE POLICY "user_profiles: internal roles can read own org"
  ON user_profiles FOR SELECT
  USING (
    current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
    AND org_id = current_org_id()
  );

-- Users can always read their own profile (required for helper functions)
CREATE POLICY "user_profiles: user reads own row"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

-- owner — full management of profiles in own org
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

-- =============================================================================
-- CUSTOMERS
-- =============================================================================

-- SELECT — owner, manager, dispatch, office, sales
CREATE POLICY "customers: read for internal operational roles"
  ON customers FOR SELECT
  USING (
    current_app_role() IN ('owner','manager','dispatch','office','sales')
    AND org_id = current_org_id()
  );

-- INSERT — owner, manager, office, sales can create customers
CREATE POLICY "customers: insert for owner/manager/office/sales"
  ON customers FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner','manager','office','sales')
    AND org_id = current_org_id()
  );

-- UPDATE — owner, manager, office, sales
CREATE POLICY "customers: update for owner/manager/office/sales"
  ON customers FOR UPDATE
  USING (
    current_app_role() IN ('owner','manager','office','sales')
    AND org_id = current_org_id()
  );

-- DELETE — owner only
CREATE POLICY "customers: delete for owner only"
  ON customers FOR DELETE
  USING (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );

-- =============================================================================
-- PROPERTIES
-- =============================================================================

-- SELECT — owner, manager, dispatch, tech, office, sales
CREATE POLICY "properties: read for internal operational roles"
  ON properties FOR SELECT
  USING (
    current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
    AND org_id = current_org_id()
  );

-- INSERT — owner, manager, office, sales
CREATE POLICY "properties: insert for owner/manager/office/sales"
  ON properties FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner','manager','office','sales')
    AND org_id = current_org_id()
  );

-- UPDATE — owner, manager, office, sales
CREATE POLICY "properties: update for owner/manager/office/sales"
  ON properties FOR UPDATE
  USING (
    current_app_role() IN ('owner','manager','office','sales')
    AND org_id = current_org_id()
  );

-- DELETE — owner only
CREATE POLICY "properties: delete for owner only"
  ON properties FOR DELETE
  USING (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );

-- =============================================================================
-- CONTRACTORS
-- =============================================================================

-- SELECT — owner, manager, dispatch, tech (need to know who is assigned)
CREATE POLICY "contractors: read for operational roles"
  ON contractors FOR SELECT
  USING (
    current_app_role() IN ('owner','manager','dispatch','tech')
    AND org_id = current_org_id()
  );

-- INSERT — owner, manager
CREATE POLICY "contractors: insert for owner/manager"
  ON contractors FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner','manager')
    AND org_id = current_org_id()
  );

-- UPDATE — owner, manager
CREATE POLICY "contractors: update for owner/manager"
  ON contractors FOR UPDATE
  USING (
    current_app_role() IN ('owner','manager')
    AND org_id = current_org_id()
  );

-- DELETE — owner only
CREATE POLICY "contractors: delete for owner only"
  ON contractors FOR DELETE
  USING (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );

-- =============================================================================
-- JOBS
-- =============================================================================

-- SELECT — owner, manager, dispatch, office, sales see all org jobs
--          tech sees only their assigned jobs
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

-- INSERT — owner, manager, office can create jobs
CREATE POLICY "jobs: insert for owner/manager/office"
  ON jobs FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner','manager','office')
    AND org_id = current_org_id()
  );

-- UPDATE — owner, manager can update any job
--          dispatch can update status only (enforced at application layer;
--            the RLS policy grants row access, column-level enforcement is
--            documented in rls-role-matrix.md)
--          tech can update their own assigned jobs (status updates)
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

-- DELETE — owner only
CREATE POLICY "jobs: delete for owner only"
  ON jobs FOR DELETE
  USING (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );

-- =============================================================================
-- JOB_ACTIVITY
-- =============================================================================

-- SELECT — owner, manager, dispatch, office see all org activity
--          tech sees activity for their assigned jobs
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

-- INSERT — owner, manager, dispatch, tech (append only; no update/delete)
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

-- No UPDATE or DELETE policies for job_activity — the log is append-only.

-- =============================================================================
-- PORTAL_USERS
-- =============================================================================

-- SELECT — owner, manager can view portal user records
CREATE POLICY "portal_users: owner/manager can read"
  ON portal_users FOR SELECT
  USING (
    current_app_role() IN ('owner','manager')
    AND org_id = current_org_id()
  );

-- Portal user reads their own row (used during portal session init)
CREATE POLICY "portal_users: portal user reads own row"
  ON portal_users FOR SELECT
  USING (auth_uid = auth.uid());

-- INSERT — owner, manager (invite creation)
CREATE POLICY "portal_users: owner/manager can insert"
  ON portal_users FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner','manager')
    AND org_id = current_org_id()
  );

-- UPDATE — owner, manager (admin) or portal user (own row — e.g. name)
CREATE POLICY "portal_users: owner/manager can update"
  ON portal_users FOR UPDATE
  USING (
    current_app_role() IN ('owner','manager')
    AND org_id = current_org_id()
  );

CREATE POLICY "portal_users: portal user updates own row"
  ON portal_users FOR UPDATE
  USING (auth_uid = auth.uid());

-- DELETE — owner only
CREATE POLICY "portal_users: owner can delete"
  ON portal_users FOR DELETE
  USING (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );

-- =============================================================================
-- PORTAL_MEMBERSHIPS
-- =============================================================================

-- SELECT — owner, manager view memberships
CREATE POLICY "portal_memberships: owner/manager can read"
  ON portal_memberships FOR SELECT
  USING (
    current_app_role() IN ('owner','manager')
    AND org_id = current_org_id()
  );

-- Portal user reads their own membership (for permission resolution)
CREATE POLICY "portal_memberships: portal user reads own membership"
  ON portal_memberships FOR SELECT
  USING (
    portal_user_id IN (
      SELECT id FROM portal_users WHERE auth_uid = auth.uid()
    )
  );

-- INSERT — owner, manager (creating new invitations)
CREATE POLICY "portal_memberships: owner/manager can insert"
  ON portal_memberships FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner','manager')
    AND org_id = current_org_id()
  );

-- UPDATE — owner, manager (revoke, extend expiry)
CREATE POLICY "portal_memberships: owner/manager can update"
  ON portal_memberships FOR UPDATE
  USING (
    current_app_role() IN ('owner','manager')
    AND org_id = current_org_id()
  );

-- DELETE — owner only
CREATE POLICY "portal_memberships: owner can delete"
  ON portal_memberships FOR DELETE
  USING (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );
