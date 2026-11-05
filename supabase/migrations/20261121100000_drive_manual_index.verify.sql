-- Verify: 20261121100000_drive_manual_index
-- Read-only. Every check raises if the migration did not land as designed.
DO $$
DECLARE
  n integer;
BEGIN
  -- tables exist with RLS enabled + forced
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
   WHERE s.nspname = 'public' AND c.relname IN ('drive_manual_files', 'drive_manual_sync_runs')
     AND c.relrowsecurity AND c.relforcerowsecurity;
  IF n <> 2 THEN RAISE EXCEPTION 'drive manual tables missing or RLS not enabled+forced (%)', n; END IF;

  -- policy counts
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'drive_manual_files';
  IF n <> 4 THEN RAISE EXCEPTION 'drive_manual_files: expected 4 policies, found %', n; END IF;
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'drive_manual_sync_runs';
  IF n <> 3 THEN RAISE EXCEPTION 'drive_manual_sync_runs: expected 3 policies, found %', n; END IF;

  -- every policy is TO authenticated only
  SELECT count(*) INTO n FROM pg_policies
   WHERE schemaname = 'public' AND tablename IN ('drive_manual_files', 'drive_manual_sync_runs')
     AND roles <> '{authenticated}';
  IF n <> 0 THEN RAISE EXCEPTION 'drive manual policies must be TO authenticated (% are not)', n; END IF;

  -- no policy mentions portal
  SELECT count(*) INTO n FROM pg_policies
   WHERE schemaname = 'public' AND tablename IN ('drive_manual_files', 'drive_manual_sync_runs')
     AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%portal%';
  IF n <> 0 THEN RAISE EXCEPTION 'portal must not appear in drive manual policies'; END IF;

  -- anon has no privileges
  IF has_table_privilege('anon', 'public.drive_manual_files', 'SELECT')
     OR has_table_privilege('anon', 'public.drive_manual_files', 'INSERT')
     OR has_table_privilege('anon', 'public.drive_manual_sync_runs', 'SELECT') THEN
    RAISE EXCEPTION 'anon still has privileges on drive manual tables';
  END IF;

  -- unique (org_id, drive_file_id)
  SELECT count(*) INTO n FROM pg_constraint
   WHERE conname = 'drive_manual_files_org_file_key' AND contype = 'u';
  IF n <> 1 THEN RAISE EXCEPTION 'drive_manual_files_org_file_key unique constraint missing'; END IF;

  -- touch trigger present, function not executable by API roles
  SELECT count(*) INTO n FROM pg_trigger WHERE tgname = 'drive_manual_files_touch' AND NOT tgisinternal;
  IF n <> 1 THEN RAISE EXCEPTION 'drive_manual_files_touch trigger missing'; END IF;
  IF has_function_privilege('authenticated', 'public.drive_manual_files_touch()', 'EXECUTE') THEN
    RAISE EXCEPTION 'drive_manual_files_touch must not be executable by authenticated';
  END IF;

  -- no file content column: metadata only
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'drive_manual_files'
     AND column_name IN ('content', 'body', 'file_data', 'text_content');
  IF n <> 0 THEN RAISE EXCEPTION 'drive_manual_files must not store file contents'; END IF;

  RAISE NOTICE 'drive_manual_index verify OK';
END $$;
