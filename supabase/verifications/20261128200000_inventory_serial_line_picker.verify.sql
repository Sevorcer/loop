-- Read-only checks for 20261128200000_inventory_serial_line_picker.sql.
-- Run after the migration. This file changes nothing.

DO $$
DECLARE
  n bigint;
  def text;
  f text;
BEGIN
  -- table, RLS, policies ------------------------------------------------------
  ASSERT to_regclass('public.job_material_line_serials') IS NOT NULL,
    'job_material_line_serials must exist';
  ASSERT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
          WHERE oid = 'public.job_material_line_serials'::regclass),
    'job_material_line_serials must have RLS enabled and forced';

  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'job_material_line_serials';
  ASSERT n = 4, format('expected 4 policies on job_material_line_serials, found %s', n);
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_material_line_serials' AND cmd IN ('UPDATE', 'ALL')
  ), 'links are never updated: no UPDATE or ALL policy';
  ASSERT NOT has_table_privilege('authenticated', 'public.job_material_line_serials', 'UPDATE'),
    'authenticated must have no UPDATE on links';
  ASSERT NOT has_table_privilege('anon', 'public.job_material_line_serials', 'SELECT'),
    'anon must have no access to links';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_material_line_serials'
      AND cmd IN ('INSERT', 'DELETE') AND (qual ILIKE '%tech%' OR with_check ILIKE '%tech%' OR qual ILIKE '%dispatch%' OR with_check ILIKE '%dispatch%')
  ), 'only owner, manager and office write links; techs and dispatch never do';

  -- guard, follow-through, adoption triggers ------------------------------------------
  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_job_material_line_serial_guard'
                 AND tgrelid = 'public.job_material_line_serials'::regclass AND NOT tgisinternal),
    'the link guard trigger must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_txn_line_units_follow'
                 AND tgrelid = 'public.inventory_transactions'::regclass AND NOT tgisinternal),
    'the pull follow-through trigger must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_installed_systems_serial_adopt'
                 AND tgrelid = 'public.installed_systems'::regclass AND NOT tgisinternal),
    'the adoption trigger must exist';
  ASSERT 'trg_installed_systems_serial_adopt' < 'trg_installed_systems_serial_sync',
    'adoption must fire before the bridge (triggers fire by name)';

  FOREACH f IN ARRAY ARRAY[
    'public.fn_job_material_line_serial_guard()',
    'public.fn_inventory_txn_line_units_follow()',
    'public.fn_installed_system_serials_adopt()'
  ] LOOP
    def := pg_get_functiondef(f::regprocedure);
    ASSERT position('SET search_path' IN def) > 0, f || ' must pin search_path';
    ASSERT NOT has_function_privilege('authenticated', f, 'EXECUTE'), f || ' must not be executable by authenticated';
    ASSERT NOT has_function_privilege('anon', f, 'EXECUTE'), f || ' must not be executable by anon';
  END LOOP;

  ASSERT position('loop.serial_sync' IN pg_get_functiondef('public.fn_installed_system_serials_adopt()'::regprocedure)) > 0,
    'adoption must set the recursion flag';

  -- review queue --------------------------------------------------------------------
  ASSERT position('detached_unit' IN pg_get_viewdef('public.inventory_serial_review_queue'::regclass)) > 0,
    'the review queue must include detached units';
  ASSERT (SELECT reloptions::text FROM pg_class WHERE oid = 'public.inventory_serial_review_queue'::regclass) LIKE '%security_invoker=true%',
    'the review queue must stay security_invoker';

  -- data invariants -----------------------------------------------------------------
  SELECT count(*) INTO n
  FROM public.job_material_line_serials s
  JOIN public.job_material_lines l ON l.id = s.line_id
  JOIN public.inventory_serial_units u ON u.id = s.serial_unit_id
  WHERE l.catalog_item_id IS DISTINCT FROM u.item_id OR l.org_id <> u.org_id;
  ASSERT n = 0, format('%s links point at a unit that is not their line''s item', n);

  SELECT count(*) INTO n FROM (
    SELECT s.line_id FROM public.job_material_line_serials s
    JOIN public.job_material_lines l ON l.id = s.line_id
    GROUP BY s.line_id, l.quantity HAVING count(*) > l.quantity
  ) over_full;
  ASSERT n = 0, format('%s lines have more units picked than their quantity', n);

  RAISE NOTICE 'OK: 20261128200000_inventory_serial_line_picker verified';
END $$;
