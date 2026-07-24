-- =============================================================================
-- Policy Verification (Drift Guard)
-- scripts/verify-policies.sql
--
-- Checks that all expected RLS policies are present in the live database.
-- This is the SQL-editor version of scripts/verify-policies.sh.
--
-- Usage:
--   Supabase SQL Editor: paste and run
--   psql:  psql "$DATABASE_URL" -f scripts/verify-policies.sql
--
-- Exit interpretation:
--   If any row shows status = 'MISSING', the policy has not been applied and
--   the relevant migration should be re-run (or pushed via supabase db push).
--
-- This list is derived from supabase/migrations/ — update whenever a new
-- migration adds or removes policies.
-- =============================================================================

WITH expected_policies (policy_name) AS (
  VALUES
    -- ── 20260719000001_baseline_core_schema ──────────────────────────────────
    ('org: owner/manager can read own org'),
    ('org: owner can update own org'),
    ('user_profiles: internal roles can read own org'),
    ('user_profiles: user reads own row'),
    ('user_profiles: owner can insert'),
    ('user_profiles: owner can update'),
    ('user_profiles: owner can delete'),
    ('customers: read for internal operational roles'),
    ('customers: insert for owner/manager/office/sales'),
    ('customers: update for owner/manager/office/sales'),
    ('customers: delete for owner only'),
    ('properties: read for internal operational roles'),
    ('properties: insert for owner/manager/office/sales'),
    ('properties: update for owner/manager/office/sales'),
    ('properties: delete for owner only'),
    ('contractors: read for operational roles'),
    ('contractors: insert for owner/manager'),
    ('contractors: update for owner/manager'),
    ('contractors: delete for owner only'),
    ('jobs: read for owner/manager/dispatch/office/sales'),
    ('jobs: tech reads own assigned jobs'),
    ('jobs: insert for owner/manager/office'),
    ('jobs: update for owner/manager/dispatch'),
    ('jobs: tech updates own assigned jobs'),
    ('jobs: delete for owner only'),
    ('job_activity: read for owner/manager/dispatch/office'),
    ('job_activity: tech reads own job activity'),
    ('job_activity: insert for owner/manager/dispatch'),
    ('job_activity: tech inserts on own assigned jobs'),
    ('portal_users: owner/manager can read'),
    ('portal_users: portal user reads own row'),
    ('portal_users: owner/manager can insert'),
    ('portal_users: owner/manager can update'),
    ('portal_users: portal user updates own row'),
    ('portal_users: owner can delete'),
    ('portal_memberships: owner/manager can read'),
    ('portal_memberships: portal user reads own membership'),
    ('portal_memberships: owner/manager can insert'),
    ('portal_memberships: owner/manager can update'),
    ('portal_memberships: owner can delete'),

    -- ── 20260720000001_wave2_domains ─────────────────────────────────────────
    ('daily_plan_notes: org read'),
    ('daily_plan_notes: org write'),
    ('daily_plan_activations: org read'),
    ('daily_plan_activations: org write'),
    ('daily_plan_job_overrides: org read'),
    ('daily_plan_job_overrides: org write'),
    ('crews: org read'),
    ('crews: org write'),
    ('dispatch_plans: org read'),
    ('dispatch_plans: org write'),
    ('crew_assignments: org read'),
    ('crew_assignments: org write'),
    ('schedule_blocks: org read'),
    ('schedule_blocks: org write'),
    ('dispatch_events: org read'),
    ('dispatch_events: org insert'),
    ('dispatch_events: owner delete'),
    ('technical_profiles: org read'),
    ('technical_profiles: org write'),
    ('installed_systems: org read'),
    ('installed_systems: org write'),

    -- ── 20260721014500_property_artifacts ────────────────────────────────────
    ('property_documents: org read'),
    ('property_documents: org write'),
    ('property_photos: org read'),
    ('property_photos: org write'),

    -- ── 20260721060000_sprint27_platform_services ─────────────────────────────
    ('storage_objects_org_select'),
    ('storage_objects_org_insert'),
    ('storage_objects_org_update'),
    ('storage_objects_org_delete'),
    ('gc_issue_requests_org_select'),
    ('gc_issue_requests_org_insert'),
    ('gc_issue_requests_mgr_update'),
    ('gc_issue_requests_mgr_delete'),
    ('gc_issue_attachments_org_select'),
    ('gc_issue_attachments_org_insert'),
    ('gc_issue_attachments_mgr_delete'),
    ('knowledge_items_org_select'),
    ('knowledge_items_mgr_insert'),
    ('knowledge_items_mgr_update'),
    ('knowledge_items_mgr_delete'),
    ('knowledge_relationships_org_select'),
    ('knowledge_relationships_mgr_insert'),
    ('knowledge_relationships_mgr_delete'),
    ('knowledge_usage_org_select'),
    ('knowledge_usage_org_insert'),
    ('portal_projects_staff_all'),
    ('portal_projects_portal_select'),
    ('portal_milestones_staff_all'),
    ('portal_milestones_portal_select'),
    ('portal_documents_staff_all'),
    ('portal_documents_portal_select'),
    ('portal_photos_staff_all'),
    ('portal_photos_portal_select'),
    ('performance_models_org_select'),
    ('performance_models_mgr_insert'),
    ('performance_models_mgr_update'),
    ('performance_models_mgr_delete'),

    -- ── 20260724000001_db_health_checks ──────────────────────────────────────
    ('runs_select_owner_manager'),
    ('results_select_owner_manager')
)
SELECT
  e.policy_name,
  CASE
    WHEN p.policyname IS NOT NULL THEN 'OK'
    ELSE 'MISSING'
  END AS status
FROM expected_policies e
LEFT JOIN pg_policies p
  ON  p.schemaname = 'public'
  AND p.policyname = e.policy_name
ORDER BY
  CASE WHEN p.policyname IS NULL THEN 0 ELSE 1 END,
  e.policy_name;
