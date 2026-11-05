-- Migration: technical_profiles_write_roles (#32 — spec-sheet permission tightening)
--
-- ⚠ PERMISSION CHANGE — review separately from the manuals feature.
--
-- Live today (checked read-only Nov 4, 2026):
--   "technical_profiles: org write"  FOR ALL  TO public
--      USING      (org_id = current_org_id())
--      WITH CHECK (org_id = current_org_id() AND current_app_role() IN ('owner','manager'))
--   "technical_profiles: org read"   FOR SELECT TO public
--      USING      (org_id = current_org_id())
--
-- Because a FOR ALL policy's DELETE only checks USING, ANY role in the org
-- (tech, sales, portal users with an org) can DELETE spec sheets today.
-- Insert / update are limited to owner + manager, so office and dispatch
-- cannot maintain spec sheets at all.
--
-- After this migration (office-type roles only write spec sheets):
--   read   : any signed-in user in the org (unchanged)
--   insert : owner, manager, office, dispatch
--   update : owner, manager, office, dispatch
--   delete : owner, manager, office, dispatch
--   anon   : no table privileges
--
-- App impact: none found. No route writes technical_profiles today
-- (repositories/installedSystems.upsertTechnicalProfile has no callers);
-- reads are unchanged. Table has 0 rows live.
--
-- NOT APPLIED. Apply via the Supabase SQL editor after review, then run
-- 20261121200000_technical_profiles_write_roles.verify.sql.
--
-- DOWN (manual — restores the old policy):
--   DROP POLICY IF EXISTS "technical_profiles: office insert" ON public.technical_profiles;
--   DROP POLICY IF EXISTS "technical_profiles: office update" ON public.technical_profiles;
--   DROP POLICY IF EXISTS "technical_profiles: office delete" ON public.technical_profiles;
--   CREATE POLICY "technical_profiles: org write" ON public.technical_profiles FOR ALL
--     USING (org_id = (select current_org_id()))
--     WITH CHECK (org_id = (select current_org_id()) AND (select current_app_role()) = ANY (ARRAY['owner','manager']));

BEGIN;

DROP POLICY IF EXISTS "technical_profiles: org write" ON public.technical_profiles;

DROP POLICY IF EXISTS "technical_profiles: office insert" ON public.technical_profiles;
CREATE POLICY "technical_profiles: office insert"
  ON public.technical_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    (select current_app_role()) IN ('owner', 'manager', 'office', 'dispatch')
    AND org_id = (select current_org_id())
  );

DROP POLICY IF EXISTS "technical_profiles: office update" ON public.technical_profiles;
CREATE POLICY "technical_profiles: office update"
  ON public.technical_profiles FOR UPDATE
  TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'office', 'dispatch')
    AND org_id = (select current_org_id())
  )
  WITH CHECK (
    (select current_app_role()) IN ('owner', 'manager', 'office', 'dispatch')
    AND org_id = (select current_org_id())
  );

DROP POLICY IF EXISTS "technical_profiles: office delete" ON public.technical_profiles;
CREATE POLICY "technical_profiles: office delete"
  ON public.technical_profiles FOR DELETE
  TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'office', 'dispatch')
    AND org_id = (select current_org_id())
  );

REVOKE ALL ON public.technical_profiles FROM anon;

COMMIT;
