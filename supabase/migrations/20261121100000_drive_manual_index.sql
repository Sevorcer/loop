-- Migration: drive_manual_index (#33 Company Brain ↔ Google Drive)
--
-- An index of the manuals / install references that live in Google Drive.
-- Google Drive stays the source of truth: this table stores METADATA AND
-- LINKS ONLY (file id, name, type, folder path, modified time, view link)
-- plus a manufacturer / model / document-type guess parsed from the file
-- name. File contents are never copied into Loop.
--
-- Rows are written by the Drive sync (POST /api/manuals/sync), which runs
-- under the signed-in office user's session and reads Drive with a Google
-- service account (GOOGLE_DRIVE_SERVICE_ACCOUNT_* env). Until those env vars
-- are set the sync refuses to run and this table stays empty.
--
-- Office overrides (manufacturer_override / model_override) are never
-- touched by the sync, so a corrected brand or model survives re-syncs.
-- Files that disappear from the shared folders are marked status='removed'
-- (kept so existing manual links do not silently vanish), not deleted.
--
-- RLS (org-scoped, FORCE, no anon, portal none):
--   owner/manager/dispatch/office : read, insert, update, delete
--   tech/sales                    : read (crew need the manuals in the field)
--   portal / anon                 : nothing (portal v2 gets a scoped API — #8 note)
--
-- NOT APPLIED. Apply via the Supabase SQL editor after review, then run
-- 20261121100000_drive_manual_index.verify.sql.
--
-- DOWN (manual):
--   DROP TABLE IF EXISTS public.drive_manual_sync_runs;
--   DROP TABLE IF EXISTS public.drive_manual_files;
--   DROP FUNCTION IF EXISTS public.drive_manual_files_touch();

BEGIN;

CREATE TABLE IF NOT EXISTS public.drive_manual_files (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  drive_file_id         text NOT NULL
                          CHECK (char_length(drive_file_id) BETWEEN 1 AND 200),
  name                  text NOT NULL
                          CHECK (char_length(name) BETWEEN 1 AND 500),
  mime_type             text NOT NULL DEFAULT ''
                          CHECK (char_length(mime_type) <= 200),
  folder_path           text NOT NULL DEFAULT ''
                          CHECK (char_length(folder_path) <= 1000),
  root_folder_id        text,
  parent_folder_id      text,
  drive_modified_at     timestamptz,
  web_view_link         text NOT NULL DEFAULT ''
                          CHECK (web_view_link = '' OR web_view_link LIKE 'https://%'),
  size_bytes            bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  parsed_manufacturer   text CHECK (parsed_manufacturer IS NULL OR char_length(parsed_manufacturer) <= 100),
  parsed_manufacturers  text[] NOT NULL DEFAULT '{}',
  parsed_models         text[] NOT NULL DEFAULT '{}',
  parsed_doc_type       text NOT NULL DEFAULT 'other'
                          CHECK (parsed_doc_type IN (
                            'install', 'iom', 'service', 'user', 'spec_sheet',
                            'quick_reference', 'field_reference', 'guide',
                            'wiring', 'form', 'other')),
  manufacturer_override text CHECK (manufacturer_override IS NULL OR char_length(manufacturer_override) <= 100),
  model_override        text CHECK (model_override IS NULL OR char_length(model_override) <= 100),
  status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'removed')),
  last_seen_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  CONSTRAINT drive_manual_files_org_file_key UNIQUE (org_id, drive_file_id)
);

COMMENT ON TABLE public.drive_manual_files IS
  'Index of Google Drive manuals (metadata + links only; Drive is the source of truth). #33.';

CREATE INDEX IF NOT EXISTS drive_manual_files_org_status_idx
  ON public.drive_manual_files (org_id, status);
CREATE INDEX IF NOT EXISTS drive_manual_files_manufacturer_idx
  ON public.drive_manual_files (org_id, lower(coalesce(manufacturer_override, parsed_manufacturer)));
CREATE INDEX IF NOT EXISTS drive_manual_files_updated_by_idx
  ON public.drive_manual_files (updated_by);

CREATE TABLE IF NOT EXISTS public.drive_manual_sync_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  status         text NOT NULL DEFAULT 'running'
                   CHECK (status IN ('running', 'ok', 'error')),
  folder_count   integer NOT NULL DEFAULT 0 CHECK (folder_count >= 0),
  files_seen     integer NOT NULL DEFAULT 0 CHECK (files_seen >= 0),
  files_added    integer NOT NULL DEFAULT 0 CHECK (files_added >= 0),
  files_updated  integer NOT NULL DEFAULT 0 CHECK (files_updated >= 0),
  files_removed  integer NOT NULL DEFAULT 0 CHECK (files_removed >= 0),
  error          text CHECK (error IS NULL OR char_length(error) <= 2000),
  triggered_by   uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.drive_manual_sync_runs IS
  'One row per Drive manuals sync (who ran it, counts, error). #33.';

CREATE INDEX IF NOT EXISTS drive_manual_sync_runs_org_started_idx
  ON public.drive_manual_sync_runs (org_id, started_at DESC);
CREATE INDEX IF NOT EXISTS drive_manual_sync_runs_triggered_by_idx
  ON public.drive_manual_sync_runs (triggered_by);

-- ---------------------------------------------------------------------------
-- updated_at / updated_by stamp (from auth.uid(), never the request body)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.drive_manual_files_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  IF TG_OP = 'UPDATE' THEN
    NEW.created_at := OLD.created_at;
    NEW.org_id := OLD.org_id;
    NEW.drive_file_id := OLD.drive_file_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.drive_manual_files_touch() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS drive_manual_files_touch ON public.drive_manual_files;
CREATE TRIGGER drive_manual_files_touch
  BEFORE INSERT OR UPDATE ON public.drive_manual_files
  FOR EACH ROW EXECUTE FUNCTION public.drive_manual_files_touch();

-- ---------------------------------------------------------------------------
-- Grants: no anon access at all; authenticated goes through RLS.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.drive_manual_files FROM anon;
REVOKE ALL ON public.drive_manual_files FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drive_manual_files TO authenticated;
REVOKE ALL ON public.drive_manual_sync_runs FROM anon;
REVOKE ALL ON public.drive_manual_sync_runs FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.drive_manual_sync_runs TO authenticated;
REVOKE DELETE, TRUNCATE ON public.drive_manual_sync_runs FROM authenticated;

ALTER TABLE public.drive_manual_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_manual_files FORCE ROW LEVEL SECURITY;
ALTER TABLE public.drive_manual_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_manual_sync_runs FORCE ROW LEVEL SECURITY;

-- drive_manual_files ---------------------------------------------------------
DROP POLICY IF EXISTS "drive_manual_files: staff read" ON public.drive_manual_files;
CREATE POLICY "drive_manual_files: staff read"
  ON public.drive_manual_files FOR SELECT
  TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales', 'tech')
    AND org_id = (select current_org_id())
  );

DROP POLICY IF EXISTS "drive_manual_files: office insert" ON public.drive_manual_files;
CREATE POLICY "drive_manual_files: office insert"
  ON public.drive_manual_files FOR INSERT
  TO authenticated
  WITH CHECK (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = (select current_org_id())
  );

DROP POLICY IF EXISTS "drive_manual_files: office update" ON public.drive_manual_files;
CREATE POLICY "drive_manual_files: office update"
  ON public.drive_manual_files FOR UPDATE
  TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = (select current_org_id())
  )
  WITH CHECK (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = (select current_org_id())
  );

DROP POLICY IF EXISTS "drive_manual_files: office delete" ON public.drive_manual_files;
CREATE POLICY "drive_manual_files: office delete"
  ON public.drive_manual_files FOR DELETE
  TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = (select current_org_id())
  );

-- drive_manual_sync_runs -----------------------------------------------------
DROP POLICY IF EXISTS "drive_manual_sync_runs: office read" ON public.drive_manual_sync_runs;
CREATE POLICY "drive_manual_sync_runs: office read"
  ON public.drive_manual_sync_runs FOR SELECT
  TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = (select current_org_id())
  );

DROP POLICY IF EXISTS "drive_manual_sync_runs: office insert" ON public.drive_manual_sync_runs;
CREATE POLICY "drive_manual_sync_runs: office insert"
  ON public.drive_manual_sync_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = (select current_org_id())
    AND triggered_by = (select auth.uid())
  );

DROP POLICY IF EXISTS "drive_manual_sync_runs: office update" ON public.drive_manual_sync_runs;
CREATE POLICY "drive_manual_sync_runs: office update"
  ON public.drive_manual_sync_runs FOR UPDATE
  TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = (select current_org_id())
  )
  WITH CHECK (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = (select current_org_id())
  );

COMMIT;
