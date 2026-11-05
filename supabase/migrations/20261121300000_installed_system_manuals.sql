-- Migration: installed_system_manuals (#32 Installed Systems as the manuals home)
--
-- Links an installed system to the Drive manual(s) that cover it. A row is
-- a DECISION about a (system, manual) pair:
--   confirmed   — office confirmed (or hand-picked) this manual for the system
--   rejected    — office unlinked it; the matcher will not suggest it again
--   auto_linked — Copilot linked it automatically above the confidence
--                 threshold (#8; written by private.record_manual_auto_match)
--   suggested   — Copilot suggestion below the threshold (#8)
-- Brand-level guesses are computed live from drive_manual_files and are not
-- stored until someone decides.
--
-- match_kind / confidence / reason record WHY the manual matched
-- (model_exact, model_family, manufacturer, manual = hand-picked).
--
-- RLS (org-scoped, FORCE, no anon, portal none):
--   owner/manager/dispatch/office : read, insert, update, delete
--   tech/sales                    : read
--   portal / anon                 : nothing (portal v2: scoped API, see #8 note)
-- Both ends must belong to the caller's org (checked on insert).
-- decided_by / decided_at / updated_at are stamped by trigger from auth.uid().
--
-- Depends on 20261121100000_drive_manual_index.sql.
-- NOT APPLIED. Apply via the Supabase SQL editor after review, then run
-- 20261121300000_installed_system_manuals.verify.sql.
--
-- DOWN (manual):
--   DROP TABLE IF EXISTS public.installed_system_manuals;
--   DROP FUNCTION IF EXISTS public.installed_system_manuals_stamp();

BEGIN;

CREATE TABLE IF NOT EXISTS public.installed_system_manuals (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  installed_system_id  uuid NOT NULL REFERENCES public.installed_systems(id) ON DELETE CASCADE,
  manual_file_id       uuid NOT NULL REFERENCES public.drive_manual_files(id) ON DELETE CASCADE,
  status               text NOT NULL
                         CHECK (status IN ('confirmed', 'rejected', 'auto_linked', 'suggested')),
  source               text NOT NULL DEFAULT 'office'
                         CHECK (source IN ('office', 'copilot')),
  match_kind           text NOT NULL DEFAULT 'manual'
                         CHECK (match_kind IN ('model_exact', 'model_family', 'manufacturer', 'manual')),
  confidence           numeric(4,3) NOT NULL DEFAULT 1
                         CHECK (confidence >= 0 AND confidence <= 1),
  reason               text NOT NULL DEFAULT ''
                         CHECK (char_length(reason) <= 500),
  decided_by           uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  decided_at           timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT installed_system_manuals_pair_key UNIQUE (installed_system_id, manual_file_id),
  -- office decisions are confirmed/rejected; Copilot writes auto_linked/suggested
  CONSTRAINT installed_system_manuals_source_status_check CHECK (
    (source = 'office' AND status IN ('confirmed', 'rejected'))
    OR (source = 'copilot' AND status IN ('auto_linked', 'suggested'))
  )
);

COMMENT ON TABLE public.installed_system_manuals IS
  'Installed system ↔ Drive manual decisions (confirmed / rejected / auto_linked / suggested) with match reason. #32/#8.';

CREATE INDEX IF NOT EXISTS installed_system_manuals_org_system_idx
  ON public.installed_system_manuals (org_id, installed_system_id);
CREATE INDEX IF NOT EXISTS installed_system_manuals_manual_idx
  ON public.installed_system_manuals (manual_file_id);
CREATE INDEX IF NOT EXISTS installed_system_manuals_decided_by_idx
  ON public.installed_system_manuals (decided_by);

CREATE OR REPLACE FUNCTION public.installed_system_manuals_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.decided_by := auth.uid();
    NEW.decided_at := now();
    NEW.created_at := now();
  ELSE
    NEW.org_id := OLD.org_id;
    NEW.installed_system_id := OLD.installed_system_id;
    NEW.manual_file_id := OLD.manual_file_id;
    NEW.created_at := OLD.created_at;
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.source IS DISTINCT FROM OLD.source THEN
      NEW.decided_by := auth.uid();
      NEW.decided_at := now();
    ELSE
      NEW.decided_by := OLD.decided_by;
      NEW.decided_at := OLD.decided_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.installed_system_manuals_stamp() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS installed_system_manuals_stamp ON public.installed_system_manuals;
CREATE TRIGGER installed_system_manuals_stamp
  BEFORE INSERT OR UPDATE ON public.installed_system_manuals
  FOR EACH ROW EXECUTE FUNCTION public.installed_system_manuals_stamp();

REVOKE ALL ON public.installed_system_manuals FROM anon;
REVOKE ALL ON public.installed_system_manuals FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installed_system_manuals TO authenticated;

ALTER TABLE public.installed_system_manuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installed_system_manuals FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "installed_system_manuals: staff read" ON public.installed_system_manuals;
CREATE POLICY "installed_system_manuals: staff read"
  ON public.installed_system_manuals FOR SELECT
  TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales', 'tech')
    AND org_id = (select current_org_id())
  );

DROP POLICY IF EXISTS "installed_system_manuals: office insert" ON public.installed_system_manuals;
CREATE POLICY "installed_system_manuals: office insert"
  ON public.installed_system_manuals FOR INSERT
  TO authenticated
  WITH CHECK (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = (select current_org_id())
    AND source = 'office'
    AND EXISTS (
      SELECT 1 FROM public.installed_systems AS s
      WHERE s.id = installed_system_manuals.installed_system_id
        AND s.org_id = (select current_org_id())
    )
    AND EXISTS (
      SELECT 1 FROM public.drive_manual_files AS f
      WHERE f.id = installed_system_manuals.manual_file_id
        AND f.org_id = (select current_org_id())
    )
  );

DROP POLICY IF EXISTS "installed_system_manuals: office update" ON public.installed_system_manuals;
CREATE POLICY "installed_system_manuals: office update"
  ON public.installed_system_manuals FOR UPDATE
  TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = (select current_org_id())
  )
  WITH CHECK (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = (select current_org_id())
    AND source = 'office'
  );

DROP POLICY IF EXISTS "installed_system_manuals: office delete" ON public.installed_system_manuals;
CREATE POLICY "installed_system_manuals: office delete"
  ON public.installed_system_manuals FOR DELETE
  TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = (select current_org_id())
  );

COMMIT;
