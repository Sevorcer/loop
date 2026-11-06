-- Verify: 20261127500000_installed_system_nameplate_photos
-- Run after applying the migration. Raises on failure.

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'storage_objects'
      AND column_name = 'installed_system_id'
      AND data_type = 'uuid'
      AND is_nullable = 'YES'
  ), 'storage_objects.installed_system_id must be a nullable uuid';
END $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'storage_objects_installed_system_id_fkey'
      AND conrelid = 'public.storage_objects'::regclass
      AND confrelid = 'public.installed_systems'::regclass
  ), 'installed_system_id must reference installed_systems';
END $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'storage_objects_installed_system_id_idx'
  ), 'storage_objects_installed_system_id_idx must exist';
END $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'installed-system-photos'
      AND public = false
  ), 'installed-system-photos bucket must exist and stay private';
END $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'installed_system_photos_storage_select'
      AND cmd = 'SELECT'
      AND qual LIKE '%installed-system-photos%'
      AND qual LIKE '%sales%'
  ), 'select policy must let staff read nameplate photos';

  ASSERT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'installed_system_photos_storage_insert'
      AND cmd = 'INSERT'
      AND with_check LIKE '%installed-system-photos%'
      AND with_check LIKE '%tech%'
      AND with_check LIKE '%caller_is_assigned_to_job%'
      AND with_check NOT LIKE '%sales%'
      AND with_check NOT LIKE '%dispatch%'
  ), 'insert policy must follow installed-system editors and exclude sales and dispatch';

  ASSERT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'installed_system_photos_storage_delete'
      AND cmd = 'DELETE'
      AND qual LIKE '%owner%'
  ), 'delete policy must exist for owner and manager';

  ASSERT NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname LIKE 'installed_system_photos_storage_%'
      AND cmd = 'UPDATE'
  ), 'nameplate photos are write-once; no update policy';
END $$;
