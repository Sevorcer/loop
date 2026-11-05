-- Verify: 20261121000000_job_materials
-- Read-only assertions. Run after applying the migration; raises on failure.

DO $$
DECLARE
  col text;
BEGIN
  ASSERT to_regclass('public.job_material_lines') IS NOT NULL,
    'job_material_lines table must exist';

  FOREACH col IN ARRAY ARRAY[
    'id','org_id','job_id','name','quantity','unit','part_number','notes','state',
    'sort_order','created_by','created_at','updated_by','updated_at',
    'state_changed_by','state_changed_at'
  ] LOOP
    ASSERT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'job_material_lines' AND column_name = col
    ), format('job_material_lines.%s must exist', col);
  END LOOP;

  -- State check constraint allows exactly needed / on_truck / used
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.job_material_lines'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%needed%on_truck%used%'
  ), 'state CHECK (needed, on_truck, used) must exist';

  -- FKs: org + job (cascade)
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.job_material_lines'::regclass AND contype = 'f'
      AND confrelid = 'public.jobs'::regclass AND confdeltype = 'c'
  ), 'job_id FK → jobs ON DELETE CASCADE must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.job_material_lines'::regclass AND contype = 'f'
      AND confrelid = 'public.organizations'::regclass
  ), 'org_id FK → organizations must exist';

  -- RLS on + forced
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.job_material_lines'::regclass),
    'RLS must be enabled';
  ASSERT (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'public.job_material_lines'::regclass),
    'FORCE RLS must be enabled';

  -- Exactly the six expected policies, all TO authenticated
  ASSERT (SELECT count(*) FROM pg_policies
          WHERE schemaname = 'public' AND tablename = 'job_material_lines') = 6,
    'job_material_lines must have exactly 6 policies';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_material_lines'
      AND NOT (roles = ARRAY['authenticated']::name[])
  ), 'every job_material_lines policy must be TO authenticated';

  -- No permissive holes, no portal, org-scoped everywhere
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_material_lines'
      AND (coalesce(qual, '') = 'true' OR coalesce(with_check, '') = 'true')
  ), 'no USING/WITH CHECK (true) policies';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_material_lines'
      AND (coalesce(qual, '') || coalesce(with_check, '')) ILIKE '%portal%'
  ), 'portal must not appear in any policy';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_material_lines'
      AND (coalesce(qual, '') || coalesce(with_check, '')) NOT ILIKE '%current_org_id%'
  ), 'every policy must be org-scoped';

  -- Tech policies are assignment-scoped
  ASSERT (SELECT count(*) FROM pg_policies
          WHERE schemaname = 'public' AND tablename = 'job_material_lines'
            AND qual ILIKE '%''tech''%'
            AND qual ILIKE '%caller_is_assigned_to_job%') = 2,
    'tech SELECT + UPDATE must both use caller_is_assigned_to_job';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_material_lines'
      AND cmd IN ('INSERT', 'DELETE')
      AND (coalesce(qual, '') || coalesce(with_check, '')) ILIKE '%''tech''%'
  ), 'tech must not insert or delete';

  -- anon has no table privileges
  ASSERT NOT has_table_privilege('anon', 'public.job_material_lines', 'SELECT'),
    'anon must not SELECT';
  ASSERT NOT has_table_privilege('anon', 'public.job_material_lines', 'INSERT'),
    'anon must not INSERT';

  -- Triggers present
  ASSERT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgrelid = 'public.job_material_lines'::regclass
                   AND tgname = 'trg_job_material_lines_stamp' AND NOT tgisinternal),
    'stamp trigger must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgrelid = 'public.job_material_lines'::regclass
                   AND tgname = 'trg_guard_tech_job_material_update' AND NOT tgisinternal),
    'tech guard trigger must exist';

  -- Trigger functions: pinned search_path, not callable as RPC
  ASSERT (SELECT proconfig @> ARRAY['search_path=public']
          FROM pg_proc WHERE oid = 'public.job_material_lines_stamp()'::regprocedure),
    'stamp function must pin search_path';
  ASSERT (SELECT proconfig @> ARRAY['search_path=public']
          FROM pg_proc WHERE oid = 'public.guard_tech_job_material_update()'::regprocedure),
    'guard function must pin search_path';
  ASSERT NOT has_function_privilege('anon', 'public.job_material_lines_stamp()', 'EXECUTE'),
    'anon must not execute stamp function';
  ASSERT NOT has_function_privilege('authenticated', 'public.guard_tech_job_material_update()', 'EXECUTE'),
    'authenticated must not execute guard function directly';

  -- Indexes
  ASSERT to_regclass('public.job_material_lines_job_sort_idx') IS NOT NULL,
    'job_sort index must exist';
  ASSERT to_regclass('public.job_material_lines_org_state_idx') IS NOT NULL,
    'org_state index must exist';

  RAISE NOTICE 'job_material_lines verification passed';
END $$;
