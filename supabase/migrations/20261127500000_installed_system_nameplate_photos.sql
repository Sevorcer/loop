-- Installed system nameplate photos.
--
-- Equipment already on a property can have photos (a nameplate, the indoor
-- unit, the outdoor unit). Those files use the same storage_objects metadata
-- as other uploads, linked by installed_system_id. The bytes live in the
-- private bucket `installed-system-photos` at
-- `installed-systems/<system id>/<file>`.
--
-- Model and serial stay on installed_systems. A suggested reading is not
-- stored. The office confirms it before either field is written.
--
-- NOT APPLIED. Apply, then run
-- supabase/verifications/20261127500000_installed_system_nameplate_photos.verify.sql.
--
-- DOWN
--   DROP POLICY IF EXISTS "installed_system_photos_storage_delete" ON storage.objects;
--   DROP POLICY IF EXISTS "installed_system_photos_storage_insert" ON storage.objects;
--   DROP POLICY IF EXISTS "installed_system_photos_storage_select" ON storage.objects;
--   DELETE FROM storage.buckets WHERE id = 'installed-system-photos';
--   DROP INDEX IF EXISTS public.storage_objects_installed_system_id_idx;
--   ALTER TABLE public.storage_objects DROP CONSTRAINT IF EXISTS storage_objects_installed_system_id_fkey;
--   ALTER TABLE public.storage_objects DROP COLUMN IF EXISTS installed_system_id;

BEGIN;

ALTER TABLE public.storage_objects
  ADD COLUMN IF NOT EXISTS installed_system_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'storage_objects_installed_system_id_fkey'
      AND conrelid = 'public.storage_objects'::regclass
  ) THEN
    ALTER TABLE public.storage_objects
      ADD CONSTRAINT storage_objects_installed_system_id_fkey
      FOREIGN KEY (installed_system_id)
      REFERENCES public.installed_systems (id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.storage_objects.installed_system_id IS
  'Installed system this file belongs to. Null for job files and other uploads.';

CREATE INDEX IF NOT EXISTS storage_objects_installed_system_id_idx
  ON public.storage_objects (installed_system_id)
  WHERE installed_system_id IS NOT NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('installed-system-photos', 'installed-system-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Read: anyone who can open installed systems, and only a photo whose path
-- points at a system their RLS can see.
DROP POLICY IF EXISTS "installed_system_photos_storage_select" ON storage.objects;
CREATE POLICY "installed_system_photos_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'installed-system-photos'
    AND split_part(name, '/', 1) = 'installed-systems'
    AND (select public.current_app_role()) IN ('owner', 'manager', 'dispatch', 'tech', 'office', 'sales')
    AND EXISTS (
      SELECT 1
      FROM public.installed_systems AS s
      WHERE s.id::text = split_part(name, '/', 2)
    )
  );

-- Write: the same people who can edit an installed system in the app
-- (owner, manager, office, tech). A technician must be allowed to update
-- that system (unassigned job, or a job they are on). No update policy:
-- uploads are write-once.
DROP POLICY IF EXISTS "installed_system_photos_storage_insert" ON storage.objects;
CREATE POLICY "installed_system_photos_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'installed-system-photos'
    AND split_part(name, '/', 1) = 'installed-systems'
    AND (select public.current_app_role()) IN ('owner', 'manager', 'office', 'tech')
    AND EXISTS (
      SELECT 1
      FROM public.installed_systems AS s
      WHERE s.id::text = split_part(name, '/', 2)
        AND (
          (select public.current_app_role()) IN ('owner', 'manager', 'office')
          OR (
            (select public.current_app_role()) = 'tech'
            AND (s.job_id IS NULL OR private.caller_is_assigned_to_job(s.job_id))
          )
        )
    )
  );

DROP POLICY IF EXISTS "installed_system_photos_storage_delete" ON storage.objects;
CREATE POLICY "installed_system_photos_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'installed-system-photos'
    AND split_part(name, '/', 1) = 'installed-systems'
    AND (select public.current_app_role()) IN ('owner', 'manager')
    AND EXISTS (
      SELECT 1
      FROM public.installed_systems AS s
      WHERE s.id::text = split_part(name, '/', 2)
    )
  );

COMMIT;
