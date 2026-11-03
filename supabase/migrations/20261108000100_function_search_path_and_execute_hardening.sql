-- =============================================================================
-- Migration — Function search_path hardening + execute lockdown
-- DB cleanup PR B / advisor run 2026-11-02
--
-- The security advisor flagged four trigger functions with a mutable
-- search_path (function_search_path_mutable) and one SECURITY DEFINER trigger
-- function (handle_new_user) that is executable by PUBLIC/anon/authenticated.
--
-- All four flagged functions live in public and reference public objects
-- unqualified in their bodies (e.g. current_app_role()), so they are pinned to
-- `search_path = public` — the same form this repo uses for current_app_role()
-- and current_org_id() (see 20261031000001_price_trigger_definer). Pinning the
-- path (SET clause only; bodies untouched) removes the mutable-path warning
-- without breaking name resolution. `= ''` would break these bodies.
--
-- handle_new_user() is a trigger function fired on auth.users insert; it must
-- never be callable as an RPC, so EXECUTE is revoked from PUBLIC/anon/
-- authenticated. current_app_role()/current_org_id() are intentionally left
-- executable — the app and RLS policies call them.
--
-- UP:
--   - ALTER FUNCTION ... SET search_path = public on the four trigger fns.
--   - REVOKE EXECUTE ON public.handle_new_user() FROM PUBLIC, anon, authenticated.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   ALTER FUNCTION public.set_updated_at() RESET search_path;
--   ALTER FUNCTION public.fn_set_updated_at() RESET search_path;
--   ALTER FUNCTION public.guard_tech_job_update() RESET search_path;
--   ALTER FUNCTION public.guard_tech_installed_system_warranty() RESET search_path;
--   GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Pin search_path on the flagged trigger functions (SET clause only).
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.fn_set_updated_at() SET search_path = public;
ALTER FUNCTION public.guard_tech_job_update() SET search_path = public;
ALTER FUNCTION public.guard_tech_installed_system_warranty() SET search_path = public;

-- ---------------------------------------------------------------------------
-- handle_new_user() is a trigger function — not an RPC. Remove EXECUTE.
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
