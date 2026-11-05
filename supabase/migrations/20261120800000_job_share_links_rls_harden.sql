-- Migration: job_share_links RLS hardening
-- From Grok's RLS audit (docs/briefs/rls-audit-2026-11-04.md, finding HIGH-1,
-- draft D2), applied by Zoinks in the 2026-11-04 merge train BEFORE the
-- portal Share UI (PR #381) ships.
--
-- The original policy (20261120000000) is FOR ALL with org isolation only:
-- no role check, no WITH CHECK. Any authenticated org member — including a
-- tech — could insert a share-link row directly via PostgREST with a token
-- of their own choosing and open /gc-portal/<token> for any job in the org,
-- bypassing the office-gated API. (Exposure today: 0 rows.)
--
-- The app paths: create/list/revoke run on the caller's JWT via
-- getRepositoryContext and are already gated to OFFICE_PLUS
-- (owner/manager/dispatch/office) in the API; public token resolution uses
-- the service-role admin client and is unaffected. Revoke is an UPDATE of
-- revoked_at — there is deliberately no DELETE policy.

DROP POLICY IF EXISTS "org_isolation_job_share_links" ON public.job_share_links;

CREATE POLICY "job_share_links: office read"
  ON public.job_share_links FOR SELECT TO authenticated
  USING (
    org_id = (SELECT public.current_org_id())
    AND (SELECT public.current_app_role()) = ANY (ARRAY['owner','manager','dispatch','office'])
  );

CREATE POLICY "job_share_links: office create"
  ON public.job_share_links FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT public.current_org_id())
    AND (SELECT public.current_app_role()) = ANY (ARRAY['owner','manager','dispatch','office'])
    AND created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_share_links.job_id AND j.org_id = job_share_links.org_id
    )
  );

CREATE POLICY "job_share_links: office revoke"
  ON public.job_share_links FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT public.current_org_id())
    AND (SELECT public.current_app_role()) = ANY (ARRAY['owner','manager','dispatch','office'])
  )
  WITH CHECK (
    org_id = (SELECT public.current_org_id())
    AND (SELECT public.current_app_role()) = ANY (ARRAY['owner','manager','dispatch','office'])
  );

ALTER TABLE public.job_share_links FORCE ROW LEVEL SECURITY;
