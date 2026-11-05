-- Migration: portal_manual_links (portal digital-manual delivery, option b)
--
-- Collin's decision (2026-11-04): builders get manuals from a curated
-- "Customer manuals" Drive subfolder that he shares "anyone with the link".
-- The portal links straight to the Drive web-view link. Manuals anywhere else
-- in the index stay internal-only.
--
-- 1. drive_manual_files.portal_eligible: set by the Drive sync when a file
--    sits (directly, not via a shortcut) inside the folder named by
--    GOOGLE_DRIVE_CUSTOMER_MANUALS_FOLDER_ID. Recomputed on every sync, so
--    moving a file out of the folder (or unsetting the env var) un-publishes
--    it on the next sync. Default false: nothing is portal-visible until
--    a sync runs with the folder configured.
--
-- 2. public.equipment_manual_links_v: the stable read model for the portal
--    (GET /api/portal/[token]/manuals and Claude's portal v2 lane). Only
--      * links with status confirmed / auto_linked (never suggestions or
--        rejected ones),
--      * to ACTIVE manuals that are portal_eligible,
--      * where system, link and manual are all in the same org.
--    security_invoker, so any session reader would still be filtered by the
--    underlying tables' RLS. Only service_role (the server-side portal route)
--    may select it: no anon, no authenticated, no PUBLIC.
--    No customer names, notes, or other PII columns are exposed.
--
-- The Drive service account keeps drive.metadata.readonly; nothing streams
-- or proxies file contents.
--
-- Depends on 20261121100000, 20261121300000 (and 20261121400000 for Copilot
-- auto_linked rows). NOT APPLIED. Apply via the Supabase SQL editor after
-- review, then run 20261121500000_portal_manual_links.verify.sql.
--
-- DOWN (manual):
--   DROP VIEW IF EXISTS public.equipment_manual_links_v;
--   DROP INDEX IF EXISTS public.drive_manual_files_portal_idx;
--   ALTER TABLE public.drive_manual_files DROP COLUMN IF EXISTS portal_eligible;

BEGIN;

ALTER TABLE public.drive_manual_files
  ADD COLUMN IF NOT EXISTS portal_eligible boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.drive_manual_files.portal_eligible IS
  'True when the Drive file sits in the configured "Customer manuals" folder (shared anyone-with-the-link). Set by the sync; only these manuals reach the builder portal.';

CREATE INDEX IF NOT EXISTS drive_manual_files_portal_idx
  ON public.drive_manual_files (org_id)
  WHERE portal_eligible AND status = 'active';

CREATE OR REPLACE VIEW public.equipment_manual_links_v
  WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  m.org_id,
  s.id                   AS installed_system_id,
  s.property_id,
  s.job_id,
  s.linked_workflow_ids,
  s.system_name,
  s.manufacturer,
  s.model_number,
  s.location,
  f.id                   AS manual_id,
  f.name                 AS manual_name,
  f.parsed_doc_type      AS doc_type,
  f.mime_type,
  f.web_view_link,
  m.status               AS link_status,
  m.updated_at
FROM public.installed_system_manuals m
JOIN public.installed_systems s
  ON s.id = m.installed_system_id
 AND s.org_id = m.org_id
JOIN public.drive_manual_files f
  ON f.id = m.manual_file_id
 AND f.org_id = m.org_id
WHERE m.status IN ('confirmed', 'auto_linked')
  AND f.status = 'active'
  AND f.portal_eligible;

COMMENT ON VIEW public.equipment_manual_links_v IS
  'Portal read model: confirmed / auto-linked manuals from the Customer manuals Drive folder, per installed system. Server-side (service_role) only; scope every read by org + the share link''s job/property.';

REVOKE ALL ON public.equipment_manual_links_v FROM PUBLIC;
REVOKE ALL ON public.equipment_manual_links_v FROM anon;
REVOKE ALL ON public.equipment_manual_links_v FROM authenticated;
GRANT SELECT ON public.equipment_manual_links_v TO service_role;

COMMIT;
