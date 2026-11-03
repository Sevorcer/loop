-- PR A: RLS policy performance — initplan wrap + true-duplicate consolidation.
--
-- Generated from the LIVE policy set (public.pg_policies, 168 policies / 50 tables,
-- pulled 2026-11-02), which is the ground truth; the live DB has drifted from the
-- migration files before, so every statement below reproduces the live qual/with_check
-- EXACTLY, changing only what each part documents.
--
-- Fixes Supabase advisor 2026-11-02:
--   * auth_rls_initplan (26 findings): auth/current_setting re-evaluated per row.
--   * multiple_permissive_policies (231 findings): partially — only TRUE duplicates merged.
--
-- UP:
--   Part 1 — Initplan wrap (priority 1). For every policy whose qual/with_check calls
--     current_app_role(), current_org_id() or auth.uid() DIRECTLY, rewrite the call as
--     (select <fn>()) so Postgres evaluates it once per statement (initplan) instead of
--     once per row. Pure, semantics-identical rewrite via ALTER POLICY, preserving
--     roles/cmd/permissive exactly. 167 of 168 policies are rewritten (the 168th,
--     feedback_reports.feedback_no_delete, has qual `false` and calls nothing).
--   Part 2 — Consolidate ONLY true duplicates (priority 2). Exactly ONE group qualifies:
--     job_activity SELECT policies 'read for owner/manager/dispatch/office' and
--     'sales reads own company' have identical quals except for the current_app_role
--     IN-list, so they merge into one policy with the union of roles. The third
--     job_activity SELECT policy ('tech reads own job activity') is row-scoped and is
--     left untouched. No other multi-permissive group is a true duplicate (all others
--     differ in row-scope logic), so none are merged. Effective access is unchanged.
--
-- Does NOT change WHO can do WHAT on any table. Roles/cmd/permissive are preserved
-- exactly, except the single deliberate role-union merge (which preserves the effective
-- set owner/manager/dispatch/office/sales). The guard triggers guard_tech_job_update and
-- guard_tech_installed_system_warranty and the tech column allowlist are trigger/function
-- logic, not RLS policies, and are untouched. Idempotent-friendly: re-running ALTER
-- POLICY with the same expression is a no-op.
--
-- Apply to production via the Supabase SQL Editor, then run the paired verify file.

BEGIN;

-- ============================================================================
-- Part 1 — Initplan wrap (ALTER POLICY; qual/with_check wrapping only)
-- ============================================================================

-- calendar_saved_group_members
ALTER POLICY "calendar_saved_group_members: office delete" ON public.calendar_saved_group_members
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "calendar_saved_group_members: office insert" ON public.calendar_saved_group_members
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id())) AND (EXISTS ( SELECT 1
   FROM user_profiles member_profile
  WHERE ((member_profile.id = calendar_saved_group_members.user_id) AND (member_profile.org_id = calendar_saved_group_members.org_id)))) AND (EXISTS ( SELECT 1
   FROM calendar_saved_groups saved_group
  WHERE ((saved_group.id = calendar_saved_group_members.group_id) AND (saved_group.org_id = calendar_saved_group_members.org_id))))));
ALTER POLICY "calendar_saved_group_members: office read" ON public.calendar_saved_group_members
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))));

-- calendar_saved_groups
ALTER POLICY "calendar_saved_groups: office delete" ON public.calendar_saved_groups
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "calendar_saved_groups: office insert" ON public.calendar_saved_groups
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "calendar_saved_groups: office read" ON public.calendar_saved_groups
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "calendar_saved_groups: office update" ON public.calendar_saved_groups
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))))
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))));

-- calendar_task_assignees
ALTER POLICY "calendar_task_assignees: office all" ON public.calendar_task_assignees
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))))
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "calendar_task_assignees: tech reads visible" ON public.calendar_task_assignees
  USING ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND private.tech_can_see_calendar_task(task_id)));

-- calendar_tasks
ALTER POLICY "calendar_tasks: office delete" ON public.calendar_tasks
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "calendar_tasks: office insert" ON public.calendar_tasks
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "calendar_tasks: office read" ON public.calendar_tasks
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "calendar_tasks: tech reads assigned" ON public.calendar_tasks
  USING ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND private.tech_can_see_calendar_task(id)));
ALTER POLICY "calendar_tasks: office update" ON public.calendar_tasks
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))))
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "calendar_tasks: tech marks done" ON public.calendar_tasks
  USING ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND private.tech_can_see_calendar_task(id)))
  WITH CHECK ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND private.tech_can_see_calendar_task(id)));

-- contractors
ALTER POLICY "contractors: delete for owner only" ON public.contractors
  USING ((((select current_app_role()) = 'owner'::text) AND (org_id = (select current_org_id()))));
ALTER POLICY "contractors: insert for owner/manager" ON public.contractors
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "contractors: read for operational roles" ON public.contractors
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'tech'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "contractors: update for owner/manager" ON public.contractors
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text])) AND (org_id = (select current_org_id()))));

-- crew_assignments
ALTER POLICY "crew_assignments: org write" ON public.crew_assignments
  USING ((org_id = (select current_org_id())))
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text]))));
ALTER POLICY "crew_assignments: org read" ON public.crew_assignments
  USING ((org_id = (select current_org_id())));

-- crews
ALTER POLICY "crews: org write" ON public.crews
  USING ((org_id = (select current_org_id())))
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text]))));
ALTER POLICY "crews: org read" ON public.crews
  USING ((org_id = (select current_org_id())));

-- customer_contacts
ALTER POLICY "customer_contacts: delete for owner only" ON public.customer_contacts
  USING ((((select current_app_role()) = 'owner'::text) AND (org_id = (select current_org_id()))));
ALTER POLICY "customer_contacts: insert for owner/manager/office/sales" ON public.customer_contacts
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "customer_contacts: read for internal operational roles" ON public.customer_contacts
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "customer_contacts: update for owner/manager/office/sales" ON public.customer_contacts
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))))
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));

-- customers
ALTER POLICY "customers: delete for owner only" ON public.customers
  USING ((((select current_app_role()) = 'owner'::text) AND (org_id = (select current_org_id()))));
ALTER POLICY "customers: insert for owner/manager/office/sales" ON public.customers
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "customers: read for internal operational roles" ON public.customers
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "customers: update for owner/manager/office/sales" ON public.customers
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));

-- daily_plan_activations
ALTER POLICY "daily_plan_activations: org write" ON public.daily_plan_activations
  USING ((org_id = (select current_org_id())))
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text]))));
ALTER POLICY "daily_plan_activations: org read" ON public.daily_plan_activations
  USING ((org_id = (select current_org_id())));

-- daily_plan_job_overrides
ALTER POLICY "daily_plan_job_overrides: org write" ON public.daily_plan_job_overrides
  USING ((org_id = (select current_org_id())))
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text]))));
ALTER POLICY "daily_plan_job_overrides: org read" ON public.daily_plan_job_overrides
  USING ((org_id = (select current_org_id())));

-- daily_plan_notes
ALTER POLICY "daily_plan_notes: org write" ON public.daily_plan_notes
  USING ((org_id = (select current_org_id())))
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text]))));
ALTER POLICY "daily_plan_notes: org read" ON public.daily_plan_notes
  USING ((org_id = (select current_org_id())));

-- db_health_check_results
ALTER POLICY "results_select_owner_manager" ON public.db_health_check_results
  USING ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = (select auth.uid())) AND (user_profiles.app_role = ANY (ARRAY['owner'::text, 'manager'::text]))))));

-- db_health_check_runs
ALTER POLICY "runs_select_owner_manager" ON public.db_health_check_runs
  USING ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = (select auth.uid())) AND (user_profiles.app_role = ANY (ARRAY['owner'::text, 'manager'::text]))))));

-- dispatch_events
ALTER POLICY "dispatch_events: owner delete" ON public.dispatch_events
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = 'owner'::text)));
ALTER POLICY "dispatch_events: org insert" ON public.dispatch_events
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text]))));
ALTER POLICY "dispatch_events: org read" ON public.dispatch_events
  USING ((org_id = (select current_org_id())));

-- dispatch_plans
ALTER POLICY "dispatch_plans: org write" ON public.dispatch_plans
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text, 'dispatch'::text]))))
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text, 'dispatch'::text]))));
ALTER POLICY "dispatch_plans: org read" ON public.dispatch_plans
  USING ((org_id = (select current_org_id())));
ALTER POLICY "dispatch_plans: tech updates assigned job status" ON public.dispatch_plans
  USING ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND private.caller_is_assigned_to_job(job_id)))
  WITH CHECK ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND private.caller_is_assigned_to_job(job_id)));

-- estimate_line_items
ALTER POLICY "estimate_line_items: finance read" ON public.estimate_line_items
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id())) AND (EXISTS ( SELECT 1
   FROM estimates estimate
  WHERE ((estimate.id = estimate_line_items.estimate_id) AND (estimate.org_id = estimate_line_items.org_id))))));

-- estimates
ALTER POLICY "estimates: finance read" ON public.estimates
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));

-- feedback_reports
ALTER POLICY "feedback_reports_delete_owner_or_creator" ON public.feedback_reports
  USING (((org_id = (select current_org_id())) AND (((select current_app_role()) = 'owner'::text) OR (created_by_user_id = (select auth.uid())))));
ALTER POLICY "feedback_reports_insert_org_member" ON public.feedback_reports
  WITH CHECK ((org_id = (select current_org_id())));
ALTER POLICY "feedback_reports_select_manager" ON public.feedback_reports
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text]))));
ALTER POLICY "feedback_reports_select_own" ON public.feedback_reports
  USING (((org_id = (select current_org_id())) AND (created_by_user_id = (select auth.uid()))));
ALTER POLICY "feedback_select_triage_roles" ON public.feedback_reports
  USING ((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = (select auth.uid())) AND (up.org_id = feedback_reports.org_id) AND (up.app_role = ANY (ARRAY['owner'::text, 'manager'::text]))))));
ALTER POLICY "feedback_reports_update_manager" ON public.feedback_reports
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text]))))
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text]))));
ALTER POLICY "feedback_update_triage_roles" ON public.feedback_reports
  USING ((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = (select auth.uid())) AND (up.org_id = feedback_reports.org_id) AND (up.app_role = ANY (ARRAY['owner'::text, 'manager'::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = (select auth.uid())) AND (up.org_id = feedback_reports.org_id) AND (up.app_role = ANY (ARRAY['owner'::text, 'manager'::text]))))));

-- gc_issue_attachments
ALTER POLICY "gc_issue_attachments_mgr_delete" ON public.gc_issue_attachments
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text]))));
ALTER POLICY "gc_issue_attachments_org_insert" ON public.gc_issue_attachments
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'tech'::text, 'office'::text, 'sales'::text]))));
ALTER POLICY "gc_issue_attachments_org_select" ON public.gc_issue_attachments
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'tech'::text, 'office'::text, 'sales'::text]))));

-- gc_issue_requests
ALTER POLICY "gc_issue_requests_mgr_delete" ON public.gc_issue_requests
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text]))));
ALTER POLICY "gc_issue_requests_org_insert" ON public.gc_issue_requests
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'tech'::text, 'office'::text, 'sales'::text]))));
ALTER POLICY "gc_issue_requests_org_select" ON public.gc_issue_requests
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'tech'::text, 'office'::text, 'sales'::text]))));
ALTER POLICY "gc_issue_requests_mgr_update" ON public.gc_issue_requests
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text]))));

-- installed_systems
ALTER POLICY "installed_systems: org write" ON public.installed_systems
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text, 'dispatch'::text]))))
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text, 'dispatch'::text]))));
ALTER POLICY "installed_systems: tech inserts field equipment" ON public.installed_systems
  WITH CHECK ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND ((job_id IS NULL) OR private.caller_is_assigned_to_job(job_id))));
ALTER POLICY "installed_systems: org read" ON public.installed_systems
  USING ((org_id = (select current_org_id())));
ALTER POLICY "installed_systems: tech updates field equipment" ON public.installed_systems
  USING ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND ((job_id IS NULL) OR private.caller_is_assigned_to_job(job_id))))
  WITH CHECK ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND ((job_id IS NULL) OR private.caller_is_assigned_to_job(job_id))));

-- invoices
ALTER POLICY "invoices: finance read" ON public.invoices
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));

-- job_activity
ALTER POLICY "job_activity: insert for owner/manager/dispatch/office" ON public.job_activity
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "job_activity: sales records a price change" ON public.job_activity
  WITH CHECK ((((select current_app_role()) = 'sales'::text) AND (org_id = (select current_org_id())) AND (type = 'price'::text)));
ALTER POLICY "job_activity: tech inserts on own assigned jobs" ON public.job_activity
  WITH CHECK ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND (actor_id = (select auth.uid())) AND (job_id IN ( SELECT j.id
   FROM jobs j
  WHERE ((j.org_id = (select current_org_id())) AND ((j.assigned_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM job_assignees ja
          WHERE ((ja.job_id = j.id) AND (ja.user_id = (select auth.uid())))))))))));
ALTER POLICY "job_activity: tech reads own job activity" ON public.job_activity
  USING ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND (job_id IN ( SELECT j.id
   FROM jobs j
  WHERE ((j.org_id = (select current_org_id())) AND ((j.assigned_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM job_assignees ja
          WHERE ((ja.job_id = j.id) AND (ja.user_id = (select auth.uid())))))))))));

-- job_assignees
ALTER POLICY "job_assignees: org delete" ON public.job_assignees
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text, 'dispatch'::text]))));
ALTER POLICY "job_assignees: org insert" ON public.job_assignees
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text, 'dispatch'::text]))));
ALTER POLICY "job_assignees: org read" ON public.job_assignees
  USING ((org_id = (select current_org_id())));

-- job_callbacks
ALTER POLICY "job_callbacks: insert for owner/manager/dispatch/office" ON public.job_callbacks
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "job_callbacks: read for owner/manager/dispatch/office/sales" ON public.job_callbacks
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "job_callbacks: tech reads callbacks on assigned jobs" ON public.job_callbacks
  USING ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND ((job_id IN ( SELECT j.id
   FROM jobs j
  WHERE ((j.org_id = (select current_org_id())) AND ((j.assigned_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM job_assignees ja
          WHERE ((ja.job_id = j.id) AND (ja.user_id = (select auth.uid()))))))))) OR (original_job_id IN ( SELECT j.id
   FROM jobs j
  WHERE ((j.org_id = (select current_org_id())) AND ((j.assigned_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM job_assignees ja
          WHERE ((ja.job_id = j.id) AND (ja.user_id = (select auth.uid()))))))))))));

-- job_completion_team
ALTER POLICY "job_completion_team: read" ON public.job_completion_team
  USING (((org_id = (select current_org_id())) AND (((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) OR (((select current_app_role()) = 'tech'::text) AND ((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM jobs job
  WHERE ((job.id = job_completion_team.job_id) AND (job.org_id = job_completion_team.org_id) AND ((job.assigned_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM job_assignees assignee
          WHERE ((assignee.job_id = job.id) AND (assignee.user_id = (select auth.uid()))))))))))))));

-- job_financials
ALTER POLICY "job_financials: finance delete" ON public.job_financials
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "job_financials: finance insert" ON public.job_financials
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id())) AND (EXISTS ( SELECT 1
   FROM jobs priced_job
  WHERE ((priced_job.id = job_financials.job_id) AND (priced_job.org_id = job_financials.org_id))))));
ALTER POLICY "job_financials: finance read" ON public.job_financials
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id())) AND (EXISTS ( SELECT 1
   FROM jobs priced_job
  WHERE ((priced_job.id = job_financials.job_id) AND (priced_job.org_id = job_financials.org_id))))));
ALTER POLICY "job_financials: tech reads assigned" ON public.job_financials
  USING ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND (EXISTS ( SELECT 1
   FROM jobs priced_job
  WHERE ((priced_job.id = job_financials.job_id) AND (priced_job.org_id = job_financials.org_id) AND ((priced_job.assigned_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM job_assignees assignee
          WHERE ((assignee.job_id = priced_job.id) AND (assignee.user_id = (select auth.uid())))))))))));
ALTER POLICY "job_financials: finance update" ON public.job_financials
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))))
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id())) AND (EXISTS ( SELECT 1
   FROM jobs priced_job
  WHERE ((priced_job.id = job_financials.job_id) AND (priced_job.org_id = job_financials.org_id))))));

-- job_financials_history
ALTER POLICY "job_financials_history: finance insert" ON public.job_financials_history
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id())) AND (EXISTS ( SELECT 1
   FROM jobs priced_job
  WHERE ((priced_job.id = job_financials_history.job_id) AND (priced_job.org_id = job_financials_history.org_id))))));
ALTER POLICY "job_financials_history: finance read" ON public.job_financials_history
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id())) AND (EXISTS ( SELECT 1
   FROM jobs priced_job
  WHERE ((priced_job.id = job_financials_history.job_id) AND (priced_job.org_id = job_financials_history.org_id))))));

-- job_line_items
ALTER POLICY "job_line_items: finance delete" ON public.job_line_items
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "job_line_items: finance insert" ON public.job_line_items
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id())) AND (EXISTS ( SELECT 1
   FROM jobs priced_job
  WHERE ((priced_job.id = job_line_items.job_id) AND (priced_job.org_id = job_line_items.org_id))))));
ALTER POLICY "job_line_items: finance read" ON public.job_line_items
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id())) AND (EXISTS ( SELECT 1
   FROM jobs priced_job
  WHERE ((priced_job.id = job_line_items.job_id) AND (priced_job.org_id = job_line_items.org_id))))));
ALTER POLICY "job_line_items: tech reads assigned" ON public.job_line_items
  USING ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND (EXISTS ( SELECT 1
   FROM jobs priced_job
  WHERE ((priced_job.id = job_line_items.job_id) AND (priced_job.org_id = job_line_items.org_id) AND ((priced_job.assigned_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM job_assignees assignee
          WHERE ((assignee.job_id = priced_job.id) AND (assignee.user_id = (select auth.uid())))))))))));
ALTER POLICY "job_line_items: finance update" ON public.job_line_items
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))))
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id())) AND (EXISTS ( SELECT 1
   FROM jobs priced_job
  WHERE ((priced_job.id = job_line_items.job_id) AND (priced_job.org_id = job_line_items.org_id))))));

-- job_notes
ALTER POLICY "job_notes: insert for owner/manager/dispatch/office" ON public.job_notes
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "job_notes: tech inserts on assigned jobs" ON public.job_notes
  WITH CHECK ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND (author_id = (select auth.uid())) AND (job_id IN ( SELECT j.id
   FROM jobs j
  WHERE ((j.org_id = (select current_org_id())) AND ((j.assigned_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM job_assignees ja
          WHERE ((ja.job_id = j.id) AND (ja.user_id = (select auth.uid())))))))))));
ALTER POLICY "job_notes: read for owner/manager/dispatch/office/sales" ON public.job_notes
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "job_notes: tech reads notes on assigned jobs" ON public.job_notes
  USING ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND (job_id IN ( SELECT j.id
   FROM jobs j
  WHERE ((j.org_id = (select current_org_id())) AND ((j.assigned_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM job_assignees ja
          WHERE ((ja.job_id = j.id) AND (ja.user_id = (select auth.uid())))))))))));

-- job_signatures
ALTER POLICY "job_signatures: insert for owner/manager/office" ON public.job_signatures
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "job_signatures: tech inserts on assigned jobs" ON public.job_signatures
  WITH CHECK ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND (captured_by = (select auth.uid())) AND (job_id IN ( SELECT j.id
   FROM jobs j
  WHERE ((j.org_id = (select current_org_id())) AND ((j.assigned_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM job_assignees ja
          WHERE ((ja.job_id = j.id) AND (ja.user_id = (select auth.uid())))))))))));
ALTER POLICY "job_signatures: read for owner/manager/dispatch/office/sales" ON public.job_signatures
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "job_signatures: tech reads signatures on assigned jobs" ON public.job_signatures
  USING ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND (job_id IN ( SELECT j.id
   FROM jobs j
  WHERE ((j.org_id = (select current_org_id())) AND ((j.assigned_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM job_assignees ja
          WHERE ((ja.job_id = j.id) AND (ja.user_id = (select auth.uid())))))))))));

-- job_tasks
ALTER POLICY "job_tasks: delete for office and above" ON public.job_tasks
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "job_tasks: insert for org staff" ON public.job_tasks
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'tech'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "job_tasks: org all" ON public.job_tasks
  USING ((org_id = (select current_org_id())));
ALTER POLICY "job_tasks: tech updates tasks on assigned jobs" ON public.job_tasks
  USING ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND private.caller_is_assigned_to_job(job_id)))
  WITH CHECK ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND private.caller_is_assigned_to_job(job_id)));
ALTER POLICY "job_tasks: update for office roles" ON public.job_tasks
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text, 'dispatch'::text])) AND (org_id = (select current_org_id()))))
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text, 'dispatch'::text])) AND (org_id = (select current_org_id()))));

-- jobs
ALTER POLICY "jobs: delete for owner only" ON public.jobs
  USING ((((select current_app_role()) = 'owner'::text) AND (org_id = (select current_org_id()))));
ALTER POLICY "jobs: dispatch inserts callback jobs" ON public.jobs
  WITH CHECK ((((select current_app_role()) = 'dispatch'::text) AND (org_id = (select current_org_id())) AND (type = 'Callback'::text)));
ALTER POLICY "jobs: insert for owner/manager/office" ON public.jobs
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "jobs: read for owner/manager/dispatch/office/sales" ON public.jobs
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "jobs: tech reads own assigned jobs" ON public.jobs
  USING ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND ((assigned_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM job_assignees ja
  WHERE ((ja.job_id = jobs.id) AND (ja.user_id = (select auth.uid()))))))));
ALTER POLICY "jobs: tech updates own assigned jobs" ON public.jobs
  USING ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND ((assigned_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM job_assignees ja
  WHERE ((ja.job_id = jobs.id) AND (ja.user_id = (select auth.uid()))))))))
  WITH CHECK ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND ((assigned_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM job_assignees ja
  WHERE ((ja.job_id = jobs.id) AND (ja.user_id = (select auth.uid()))))))));
ALTER POLICY "jobs: update for owner/manager/dispatch/office" ON public.jobs
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))));

-- knowledge_items
ALTER POLICY "knowledge_items_mgr_delete" ON public.knowledge_items
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text]))));
ALTER POLICY "knowledge_items_mgr_insert" ON public.knowledge_items
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text]))));
ALTER POLICY "knowledge_items_org_select" ON public.knowledge_items
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'tech'::text, 'office'::text, 'sales'::text]))));
ALTER POLICY "knowledge_items_mgr_update" ON public.knowledge_items
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text]))));

-- knowledge_relationships
ALTER POLICY "knowledge_relationships_mgr_delete" ON public.knowledge_relationships
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text]))));
ALTER POLICY "knowledge_relationships_mgr_insert" ON public.knowledge_relationships
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text]))));
ALTER POLICY "knowledge_relationships_org_select" ON public.knowledge_relationships
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'tech'::text, 'office'::text, 'sales'::text]))));

-- knowledge_usage
ALTER POLICY "knowledge_usage_org_insert" ON public.knowledge_usage
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'tech'::text, 'office'::text, 'sales'::text]))));
ALTER POLICY "knowledge_usage_org_select" ON public.knowledge_usage
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'tech'::text, 'office'::text, 'sales'::text]))));

-- organizations
ALTER POLICY "org: owner/manager can read own org" ON public.organizations
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text])) AND (id = (select current_org_id()))));
ALTER POLICY "org: owner can update own org" ON public.organizations
  USING ((((select current_app_role()) = 'owner'::text) AND (id = (select current_org_id()))));

-- payments
ALTER POLICY "payments: finance read" ON public.payments
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));

-- performance_models
ALTER POLICY "performance_models_mgr_delete" ON public.performance_models
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text]))));
ALTER POLICY "performance_models_mgr_insert" ON public.performance_models
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text]))));
ALTER POLICY "performance_models_org_select" ON public.performance_models
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'tech'::text, 'office'::text, 'sales'::text]))));
ALTER POLICY "performance_models_mgr_update" ON public.performance_models
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text]))));

-- portal_memberships
ALTER POLICY "portal_memberships: owner can delete" ON public.portal_memberships
  USING ((((select current_app_role()) = 'owner'::text) AND (org_id = (select current_org_id()))));
ALTER POLICY "portal_memberships: owner/manager can insert" ON public.portal_memberships
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "portal_memberships: owner/manager can read" ON public.portal_memberships
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "portal_memberships: portal user reads own membership" ON public.portal_memberships
  USING ((portal_user_id IN ( SELECT portal_users.id
   FROM portal_users
  WHERE (portal_users.auth_uid = (select auth.uid())))));
ALTER POLICY "portal_memberships: owner/manager can update" ON public.portal_memberships
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text])) AND (org_id = (select current_org_id()))));

-- portal_users
ALTER POLICY "portal_users: owner can delete" ON public.portal_users
  USING ((((select current_app_role()) = 'owner'::text) AND (org_id = (select current_org_id()))));
ALTER POLICY "portal_users: owner/manager can insert" ON public.portal_users
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "portal_users: owner/manager can read" ON public.portal_users
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "portal_users: portal user reads own row" ON public.portal_users
  USING ((auth_uid = (select auth.uid())));
ALTER POLICY "portal_users: owner/manager can update" ON public.portal_users
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "portal_users: portal user updates own row" ON public.portal_users
  USING ((auth_uid = (select auth.uid())));

-- properties
ALTER POLICY "properties: delete for owner only" ON public.properties
  USING ((((select current_app_role()) = 'owner'::text) AND (org_id = (select current_org_id()))));
ALTER POLICY "properties: insert for owner/manager/office/sales" ON public.properties
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "properties: read for internal operational roles" ON public.properties
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "properties: tech reads properties on assigned jobs" ON public.properties
  USING ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND (id IN ( SELECT j.property_id
   FROM jobs j
  WHERE ((j.org_id = (select current_org_id())) AND (j.property_id IS NOT NULL) AND ((j.assigned_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM job_assignees ja
          WHERE ((ja.job_id = j.id) AND (ja.user_id = (select auth.uid())))))))))));
ALTER POLICY "properties: update for owner/manager/office/sales" ON public.properties
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));

-- property_documents
ALTER POLICY "property_documents: org write" ON public.property_documents
  USING ((org_id = (select current_org_id())))
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text, 'sales'::text]))));
ALTER POLICY "property_documents: org read" ON public.property_documents
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'tech'::text, 'office'::text, 'sales'::text]))));

-- property_photos
ALTER POLICY "property_photos: org write" ON public.property_photos
  USING ((org_id = (select current_org_id())))
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'office'::text, 'sales'::text]))));
ALTER POLICY "property_photos: org read" ON public.property_photos
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'tech'::text, 'office'::text, 'sales'::text]))));

-- schedule_blocks
ALTER POLICY "schedule_blocks: org write" ON public.schedule_blocks
  USING ((org_id = (select current_org_id())))
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text]))));
ALTER POLICY "schedule_blocks: org read" ON public.schedule_blocks
  USING ((org_id = (select current_org_id())));

-- storage_objects
ALTER POLICY "storage_objects_org_delete" ON public.storage_objects
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text]))));
ALTER POLICY "storage_objects_org_insert" ON public.storage_objects
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'tech'::text, 'office'::text, 'sales'::text]))));
ALTER POLICY "storage_objects_org_select" ON public.storage_objects
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'tech'::text, 'office'::text, 'sales'::text]))));
ALTER POLICY "storage_objects_org_update" ON public.storage_objects
  USING (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text]))));

-- technical_profiles
ALTER POLICY "technical_profiles: org write" ON public.technical_profiles
  USING ((org_id = (select current_org_id())))
  WITH CHECK (((org_id = (select current_org_id())) AND ((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text]))));
ALTER POLICY "technical_profiles: org read" ON public.technical_profiles
  USING ((org_id = (select current_org_id())));

-- time_off
ALTER POLICY "time_off: office delete" ON public.time_off
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "time_off: office insert" ON public.time_off
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "time_off: office read" ON public.time_off
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "time_off: tech reads own" ON public.time_off
  USING ((((select current_app_role()) = 'tech'::text) AND (org_id = (select current_org_id())) AND (user_id = (select auth.uid()))));
ALTER POLICY "time_off: office update" ON public.time_off
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))))
  WITH CHECK ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text])) AND (org_id = (select current_org_id()))));

-- user_profiles
ALTER POLICY "user_profiles: owner can delete" ON public.user_profiles
  USING ((((select current_app_role()) = 'owner'::text) AND (org_id = (select current_org_id()))));
ALTER POLICY "user_profiles: manager can insert" ON public.user_profiles
  WITH CHECK ((((select current_app_role()) = 'manager'::text) AND (org_id = (select current_org_id())) AND (id IS DISTINCT FROM (select auth.uid()))));
ALTER POLICY "user_profiles: owner can insert" ON public.user_profiles
  WITH CHECK ((((select current_app_role()) = 'owner'::text) AND (org_id = (select current_org_id()))));
ALTER POLICY "user_profiles: internal roles can read own org" ON public.user_profiles
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'tech'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));
ALTER POLICY "user_profiles: user reads own row" ON public.user_profiles
  USING ((id = (select auth.uid())));
ALTER POLICY "user_profiles: manager can update" ON public.user_profiles
  USING ((((select current_app_role()) = 'manager'::text) AND (org_id = (select current_org_id()))))
  WITH CHECK ((((select current_app_role()) = 'manager'::text) AND (org_id = (select current_org_id()))));
ALTER POLICY "user_profiles: user updates own name" ON public.user_profiles
  USING ((id = (select auth.uid())))
  WITH CHECK ((id = (select auth.uid())));

-- ============================================================================
-- Part 2 — Consolidate the one true duplicate (job_activity SELECT)
--   owner/manager/dispatch/office + sales -> single policy, union of roles.
--   Row-scoped 'tech reads own job activity' policy is intentionally NOT merged.
-- ============================================================================
DROP POLICY IF EXISTS "job_activity: read for owner/manager/dispatch/office" ON public.job_activity;
DROP POLICY IF EXISTS "job_activity: sales reads own company" ON public.job_activity;
DROP POLICY IF EXISTS "job_activity: read for owner/manager/dispatch/office/sales" ON public.job_activity;
CREATE POLICY "job_activity: read for owner/manager/dispatch/office/sales"
  ON public.job_activity
  FOR SELECT
  USING ((((select current_app_role()) = ANY (ARRAY['owner'::text, 'manager'::text, 'dispatch'::text, 'office'::text, 'sales'::text])) AND (org_id = (select current_org_id()))));

COMMIT;

-- DOWN
-- Part 1 is reversible by ALTER POLICY ... USING/WITH CHECK with the un-wrapped
-- expression (remove the (select ...) wrapper from each current_app_role()/
-- current_org_id()/auth.uid() call). This is a performance-only change; access is
-- identical with or without the wrapper, so a rollback is optional.
-- Part 2 rollback (restore the two separate job_activity SELECT policies):
--   DROP POLICY IF EXISTS "job_activity: read for owner/manager/dispatch/office/sales" ON public.job_activity;
--   CREATE POLICY "job_activity: read for owner/manager/dispatch/office" ON public.job_activity
--     FOR SELECT USING ((current_app_role() = ANY (ARRAY['owner'::text,'manager'::text,'dispatch'::text,'office'::text])) AND (org_id = current_org_id()));
--   CREATE POLICY "job_activity: sales reads own company" ON public.job_activity
--     FOR SELECT USING ((current_app_role() = 'sales'::text) AND (org_id = current_org_id()));
