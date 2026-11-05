-- Harden portal_submissions RLS.
--
-- Migration 20261120200000 created policy service_insert_portal_submissions
-- as FOR INSERT WITH CHECK (true) with no TO clause (roles = {public}).
-- Combined with default GRANT INSERT TO anon, anyone holding the anon key
-- could insert rows directly and bypass the rate-limited token submit route.
--
-- The public submit route (/api/portal/[token]/submit) inserts via the
-- service-role admin client (getSupabaseAdminClient), which bypasses RLS.
-- So the open insert policy is unnecessary for the legitimate path.
--
-- This migration:
--   1. Drops the WITH CHECK (true) insert policy
--   2. Revokes INSERT (and other DML) from anon
--   3. Enables FORCE ROW LEVEL SECURITY (service_role still bypasses RLS)

DROP POLICY IF EXISTS "service_insert_portal_submissions" ON public.portal_submissions;

-- Keep org-scoped staff policy; ensure it is TO authenticated for clarity.
DROP POLICY IF EXISTS "org_isolation_portal_submissions" ON public.portal_submissions;
CREATE POLICY "org_isolation_portal_submissions"
  ON public.portal_submissions
  FOR ALL
  TO authenticated
  USING (
    org_id = current_org_id()
  )
  WITH CHECK (
    org_id = current_org_id()
  );

REVOKE ALL ON TABLE public.portal_submissions FROM anon;
-- authenticated keeps DML; staff access is gated by the org policy above.
-- service_role retains full access (Supabase default; bypasses RLS).

ALTER TABLE public.portal_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_submissions FORCE ROW LEVEL SECURITY;
