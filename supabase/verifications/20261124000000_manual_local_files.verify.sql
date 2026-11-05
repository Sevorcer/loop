-- Verify: 20261124000000_manual_local_files
-- Run after applying the migration. Raises on failure; prints notices otherwise.
DO $$
DECLARE
  pdf_rows int;
  pdf_stored int;
  dangling int;
  total_objects int;
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'drive_manual_files'
       AND column_name = 'storage_path' AND data_type = 'text' AND is_nullable = 'YES'
  ), 'storage_path column missing or not nullable text';

  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'drive_manual_files_storage_path_uidx'
  ), 'unique index on (org_id, storage_path) missing';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND policyname = 'manuals_storage_select' AND cmd = 'SELECT'
  ), 'manuals_storage_select policy missing';

  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND qual LIKE '%manuals%' AND cmd <> 'SELECT'
  ), 'a non-SELECT storage policy references the manuals bucket';

  ASSERT (SELECT NOT public FROM storage.buckets WHERE id = 'manuals'), 'manuals bucket must stay private';

  -- Every stored path points at a real object.
  SELECT count(*) INTO dangling
    FROM public.drive_manual_files d
   WHERE d.storage_path IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'manuals' AND o.name = d.storage_path);
  ASSERT dangling = 0, format('%s rows point at a missing storage object', dangling);

  -- Only PDFs were backfilled; Google Docs stay NULL until converted.
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.drive_manual_files
     WHERE storage_path IS NOT NULL AND mime_type <> 'application/pdf'
  ), 'a non-PDF row has a storage_path';

  SELECT count(*), count(storage_path) INTO pdf_rows, pdf_stored
    FROM public.drive_manual_files WHERE mime_type = 'application/pdf';
  SELECT count(*) INTO total_objects FROM storage.objects WHERE bucket_id = 'manuals';
  RAISE NOTICE 'PDF rows: %, with storage_path: %, objects in bucket: % (expect 14 / 14 / 14 at first apply)',
    pdf_rows, pdf_stored, total_objects;
END $$;
