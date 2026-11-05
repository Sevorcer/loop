-- Verify: 20261121300000_installed_system_manuals (read-only)
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
   WHERE s.nspname = 'public' AND c.relname = 'installed_system_manuals'
     AND c.relrowsecurity AND c.relforcerowsecurity;
  IF n <> 1 THEN RAISE EXCEPTION 'installed_system_manuals missing or RLS not enabled+forced'; END IF;

  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'installed_system_manuals';
  IF n <> 4 THEN RAISE EXCEPTION 'installed_system_manuals: expected 4 policies, found %', n; END IF;

  SELECT count(*) INTO n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'installed_system_manuals' AND roles <> '{authenticated}';
  IF n <> 0 THEN RAISE EXCEPTION 'installed_system_manuals policies must be TO authenticated'; END IF;

  SELECT count(*) INTO n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'installed_system_manuals'
     AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
     AND (coalesce(qual, '') || coalesce(with_check, '')) ~ '''(tech|sales|portal)''';
  IF n <> 0 THEN RAISE EXCEPTION 'tech/sales/portal must not write installed_system_manuals'; END IF;

  IF has_table_privilege('anon', 'public.installed_system_manuals', 'SELECT') THEN
    RAISE EXCEPTION 'anon can read installed_system_manuals';
  END IF;

  SELECT count(*) INTO n FROM pg_constraint WHERE conname = 'installed_system_manuals_pair_key';
  IF n <> 1 THEN RAISE EXCEPTION 'unique (installed_system_id, manual_file_id) missing'; END IF;

  SELECT count(*) INTO n FROM pg_constraint
   WHERE conrelid = 'public.installed_system_manuals'::regclass AND contype = 'f';
  IF n < 3 THEN RAISE EXCEPTION 'expected FKs to organizations, installed_systems, drive_manual_files (found %)', n; END IF;

  SELECT count(*) INTO n FROM pg_trigger WHERE tgname = 'installed_system_manuals_stamp' AND NOT tgisinternal;
  IF n <> 1 THEN RAISE EXCEPTION 'installed_system_manuals_stamp trigger missing'; END IF;

  RAISE NOTICE 'installed_system_manuals verify OK';
END $$;
