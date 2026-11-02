-- Read-only checks for the technician warranty-write guard migration.
-- Run after 20261103000100_tech_warranty_guard.sql. This file changes nothing.

DO $$
DECLARE
  fn_def text;
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'guard_tech_installed_system_warranty'
      AND pronamespace = 'public'::regnamespace
  ), 'function public.guard_tech_installed_system_warranty() must exist';

  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'guard_tech_installed_system_warranty'
      AND tgrelid = 'public.installed_systems'::regclass
      AND NOT tgisinternal
  ), 'trigger guard_tech_installed_system_warranty on public.installed_systems must exist';

  fn_def := pg_get_functiondef('public.guard_tech_installed_system_warranty()'::regprocedure);

  ASSERT position('warranty_registered' IN fn_def) > 0,
    'guard must reference the warranty_registered columns';
  ASSERT position('''tech''' IN fn_def) > 0,
    'guard must apply only to the tech role';
END $$;
