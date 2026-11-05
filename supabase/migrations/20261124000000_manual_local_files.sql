-- Migration: manual_local_files (manuals open inside LOOP, no Drive redirect)
--
-- Collin's ruling (2026-11-05): manuals open from LOOP, not Google Drive.
-- PDF copies live in the private Supabase Storage bucket `manuals` at
-- `<drive_file_id>/<file name>` (uploaded out of band). This adds the pointer:
--
--   1. drive_manual_files.storage_path (nullable) = object path in `manuals`.
--      NULL = no stored copy yet; the UI falls back to web_view_link.
--      The Drive sync never writes this column (its upsert lists explicit
--      columns), so a re-sync keeps it.
--   2. Backfill: PDF rows whose object really exists in the bucket get
--      storage_path = drive_file_id || '/' || name. Google Docs rows stay NULL
--      until their PDF conversions are uploaded and backfilled the same way.
--   3. Storage SELECT policy so GET /api/manuals/:id/file can stream the
--      object with the caller's own session (no service-role key): staff
--      roles that may read manuals, and only objects that an
--      (RLS-visible, so same-org) drive_manual_files row points at.
--      No INSERT/UPDATE/DELETE policy: uploads stay service-side.
--
-- Expand-only and additive: old code ignores the column.
-- NOT APPLIED. Apply, then run 20261124000000_manual_local_files.verify.sql.
--
-- DOWN (manual):
--   DROP POLICY IF EXISTS "manuals_storage_select" ON storage.objects;
--   DROP INDEX IF EXISTS public.drive_manual_files_storage_path_uidx;
--   ALTER TABLE public.drive_manual_files DROP COLUMN IF EXISTS storage_path;

BEGIN;

ALTER TABLE public.drive_manual_files
  ADD COLUMN IF NOT EXISTS storage_path text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'drive_manual_files_storage_path_check'
      AND conrelid = 'public.drive_manual_files'::regclass
  ) THEN
    ALTER TABLE public.drive_manual_files
      ADD CONSTRAINT drive_manual_files_storage_path_check
      CHECK (storage_path IS NULL
             OR (char_length(storage_path) BETWEEN 1 AND 800 AND storage_path NOT LIKE '%..%'));
  END IF;
END $$;

COMMENT ON COLUMN public.drive_manual_files.storage_path IS
  'Object path in the private `manuals` storage bucket; NULL = no stored copy (use web_view_link).';

CREATE UNIQUE INDEX IF NOT EXISTS drive_manual_files_storage_path_uidx
  ON public.drive_manual_files (org_id, storage_path)
  WHERE storage_path IS NOT NULL;

-- Backfill only where the object exists, so no row points at a missing file.
UPDATE public.drive_manual_files d
   SET storage_path = d.drive_file_id || '/' || d.name
 WHERE d.storage_path IS NULL
   AND d.mime_type = 'application/pdf'
   AND EXISTS (
     SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'manuals'
        AND o.name = d.drive_file_id || '/' || d.name
   );

DROP POLICY IF EXISTS "manuals_storage_select" ON storage.objects;
CREATE POLICY "manuals_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'manuals'
    AND (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales', 'tech')
    AND EXISTS (
      SELECT 1 FROM public.drive_manual_files d
       WHERE d.storage_path = objects.name
    )
  );

COMMIT;
