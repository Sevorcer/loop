-- Read-only checks for 20261128100000_inventory_serial_units_authority.sql.
-- Run after the migration. This file changes nothing.

DO $$
DECLARE
  n bigint;
  def text;
BEGIN
  -- unit -> array ------------------------------------------------------------
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_inventory_serial_units_derive'
      AND tgrelid = 'public.inventory_serial_units'::regclass AND NOT tgisinternal
  ), 'the unit -> array derive trigger must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_inventory_serial_units_unflag'
      AND tgrelid = 'public.inventory_serial_units'::regclass AND NOT tgisinternal
  ), 'the duplicate-group unflag trigger must exist';

  -- array -> unit stays (safety net for every non-app writer) --------------------
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_installed_systems_serial_sync'
      AND tgrelid = 'public.installed_systems'::regclass AND NOT tgisinternal
  ), 'the array -> unit bridge trigger must still exist';

  def := pg_get_functiondef('public.fn_installed_system_serials_sync()'::regprocedure);
  ASSERT position('loop.serial_sync' IN def) > 0,
    'the bridge must honour the recursion flag';
  ASSERT position('SET installed_system_id = NULL' IN def) > 0,
    'the bridge must detach, not delete, units it did not create';

  -- Not callable through the API ---------------------------------------------------
  ASSERT NOT has_function_privilege('authenticated', 'public.fn_installed_system_serials_derive(uuid)', 'EXECUTE'),
    'the derive function must not be executable by authenticated';
  ASSERT NOT has_function_privilege('authenticated', 'public.fn_inventory_serial_unit_unflag()', 'EXECUTE'),
    'the unflag function must not be executable by authenticated';
  ASSERT NOT has_function_privilege('authenticated', 'public.fn_installed_system_serials_sync()', 'EXECUTE'),
    'the bridge function must not be executable by authenticated';

  -- Policies are unchanged from M10 ----------------------------------------------
  ASSERT (SELECT count(*) FROM pg_policies
          WHERE schemaname = 'public' AND tablename = 'inventory_serial_units') = 5,
    'inventory_serial_units must still have exactly 5 policies';

  -- Converged: no flagged row is the only row of its group ----------------------
  SELECT count(*) INTO n
  FROM public.inventory_serial_units u
  WHERE u.needs_review
    AND (SELECT count(*) FROM public.inventory_serial_units o
         WHERE o.org_id = u.org_id AND o.manufacturer_key = u.manufacturer_key
           AND o.serial_key = u.serial_key) = 1;
  ASSERT n = 0, format('%s flagged rows are alone in their group', n);

  -- Converged: every attached unit's serial appears on its system's array ---------
  SELECT count(*) INTO n
  FROM public.inventory_serial_units u
  JOIN public.installed_systems s ON s.id = u.installed_system_id
  WHERE NOT EXISTS (
    SELECT 1 FROM unnest(s.serial_numbers) AS x(serial) WHERE lower(btrim(x.serial)) = u.serial_key
  );
  ASSERT n = 0, format('%s attached units are missing from their system serial list', n);
END $$;
