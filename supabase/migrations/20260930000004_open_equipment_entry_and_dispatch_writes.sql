-- Open equipment entry and dispatch writes to all org members
-- Applied in production Supabase 2026-09-30 to fix RLS violations for techs:
-- Start Job inserted into dispatch_plans (owner/manager/dispatch only) and
-- installed_systems writes (owner/manager only). Mirrors org-scoping pattern:
-- any signed-in user whose org matches the row org can write. No anon/public access.
DROP POLICY IF EXISTS "installed_systems: org write" ON public.installed_systems;
CREATE POLICY "installed_systems: org write" ON public.installed_systems FOR ALL USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
DROP POLICY IF EXISTS "dispatch_plans: org write" ON public.dispatch_plans;
CREATE POLICY "dispatch_plans: org write" ON public.dispatch_plans FOR ALL USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
