-- =============================================================================
-- Policy 003 — Wave 2 Domain RLS
-- Sprint 27 PR A (#56)
--
-- Row Level Security for all Wave 2 tables: daily plan state, dispatch
-- domain, and installed systems / technical profiles.
--
-- Posture: org-scoped; same role matrix as existing tables.
--
-- Apply after: policies/002_role_policies.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helpers (already defined in 001_rls_baseline.sql — referenced here for
-- clarity only)
-- ---------------------------------------------------------------------------
-- current_org_id() → uuid
-- current_app_role() → text

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

ALTER TABLE daily_plan_notes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_plan_notes            FORCE  ROW LEVEL SECURITY;

ALTER TABLE daily_plan_activations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_plan_activations      FORCE  ROW LEVEL SECURITY;

ALTER TABLE daily_plan_job_overrides    ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_plan_job_overrides    FORCE  ROW LEVEL SECURITY;

ALTER TABLE crews                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE crews                       FORCE  ROW LEVEL SECURITY;

ALTER TABLE dispatch_plans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_plans              FORCE  ROW LEVEL SECURITY;

ALTER TABLE crew_assignments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_assignments            FORCE  ROW LEVEL SECURITY;

ALTER TABLE schedule_blocks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks             FORCE  ROW LEVEL SECURITY;

ALTER TABLE dispatch_events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_events             FORCE  ROW LEVEL SECURITY;

ALTER TABLE technical_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_profiles          FORCE  ROW LEVEL SECURITY;

ALTER TABLE installed_systems           ENABLE ROW LEVEL SECURITY;
ALTER TABLE installed_systems           FORCE  ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- daily_plan_notes  — owner/manager/dispatch/office can read+write
-- ---------------------------------------------------------------------------

CREATE POLICY "daily_plan_notes: org read"
  ON daily_plan_notes FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY "daily_plan_notes: org write"
  ON daily_plan_notes FOR ALL
  USING (org_id = current_org_id())
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','office')
  );

-- ---------------------------------------------------------------------------
-- daily_plan_activations  — same as notes
-- ---------------------------------------------------------------------------

CREATE POLICY "daily_plan_activations: org read"
  ON daily_plan_activations FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY "daily_plan_activations: org write"
  ON daily_plan_activations FOR ALL
  USING (org_id = current_org_id())
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','office')
  );

-- ---------------------------------------------------------------------------
-- daily_plan_job_overrides  — same as notes
-- ---------------------------------------------------------------------------

CREATE POLICY "daily_plan_job_overrides: org read"
  ON daily_plan_job_overrides FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY "daily_plan_job_overrides: org write"
  ON daily_plan_job_overrides FOR ALL
  USING (org_id = current_org_id())
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','office')
  );

-- ---------------------------------------------------------------------------
-- crews  — all authenticated roles can read; owner/manager/dispatch can write
-- ---------------------------------------------------------------------------

CREATE POLICY "crews: org read"
  ON crews FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY "crews: org write"
  ON crews FOR ALL
  USING (org_id = current_org_id())
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch')
  );

-- ---------------------------------------------------------------------------
-- dispatch_plans  — all authenticated roles can read; dispatch/manager/owner write
-- ---------------------------------------------------------------------------

CREATE POLICY "dispatch_plans: org read"
  ON dispatch_plans FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY "dispatch_plans: org write"
  ON dispatch_plans FOR ALL
  USING (org_id = current_org_id())
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch')
  );

-- ---------------------------------------------------------------------------
-- crew_assignments
-- ---------------------------------------------------------------------------

CREATE POLICY "crew_assignments: org read"
  ON crew_assignments FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY "crew_assignments: org write"
  ON crew_assignments FOR ALL
  USING (org_id = current_org_id())
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch')
  );

-- ---------------------------------------------------------------------------
-- schedule_blocks
-- ---------------------------------------------------------------------------

CREATE POLICY "schedule_blocks: org read"
  ON schedule_blocks FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY "schedule_blocks: org write"
  ON schedule_blocks FOR ALL
  USING (org_id = current_org_id())
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch')
  );

-- ---------------------------------------------------------------------------
-- dispatch_events  — append-only log; no delete for non-owner
-- ---------------------------------------------------------------------------

CREATE POLICY "dispatch_events: org read"
  ON dispatch_events FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY "dispatch_events: org insert"
  ON dispatch_events FOR INSERT
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch')
  );

CREATE POLICY "dispatch_events: owner delete"
  ON dispatch_events FOR DELETE
  USING (
    org_id = current_org_id()
    AND current_app_role() = 'owner'
  );

-- ---------------------------------------------------------------------------
-- technical_profiles  — read-all; write owner/manager
-- ---------------------------------------------------------------------------

CREATE POLICY "technical_profiles: org read"
  ON technical_profiles FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY "technical_profiles: org write"
  ON technical_profiles FOR ALL
  USING (org_id = current_org_id())
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager')
  );

-- ---------------------------------------------------------------------------
-- installed_systems  — read-all; write owner/manager
-- ---------------------------------------------------------------------------

CREATE POLICY "installed_systems: org read"
  ON installed_systems FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY "installed_systems: org write"
  ON installed_systems FOR ALL
  USING (org_id = current_org_id())
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager')
  );
