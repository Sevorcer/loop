-- Verify: 20261126200000_inventory_reservations
-- Read-only assertions; run after the migration is applied.

-- Table + RLS (ENABLE and FORCE), no anon, no DELETE/TRUNCATE for authenticated
DO $$
BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_reservations'),
    'inventory_reservations must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'inventory_reservations' AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be ENABLED and FORCED on inventory_reservations';
  ASSERT NOT has_table_privilege('anon', 'public.inventory_reservations', 'SELECT'), 'anon must have no access';
  ASSERT NOT has_table_privilege('authenticated', 'public.inventory_reservations', 'DELETE'), 'authenticated must not DELETE';
  ASSERT NOT has_table_privilege('authenticated', 'public.inventory_reservations', 'TRUNCATE'), 'authenticated must not TRUNCATE';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inventory_reservations'
      AND (coalesce(qual, '') = 'true' OR coalesce(with_check, '') = 'true')
  ), 'inventory_reservations must have no unconditional policy';
  ASSERT (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_reservations'
          AND cmd = 'DELETE') = 0, 'inventory_reservations must have no DELETE policy';
END; $$;

-- Additive columns on job_material_lines / job_material_plans
DO $$
DECLARE
  c text;
BEGIN
  FOREACH c IN ARRAY ARRAY['stage', 'readiness_state', 'readiness_reason', 'readiness_eta', 'fulfil_location_id'] LOOP
    ASSERT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'job_material_lines' AND column_name = c),
      'job_material_lines.' || c || ' must exist';
  END LOOP;
  FOREACH c IN ARRAY ARRAY['readiness_state', 'readiness_reason', 'readiness_checked_at'] LOOP
    ASSERT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'job_material_plans' AND column_name = c),
      'job_material_plans.' || c || ' must exist';
  END LOOP;
  ASSERT (SELECT column_default FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'job_material_lines' AND column_name = 'stage') LIKE '%planned%',
    'stage must default to planned';
END; $$;

-- Existing lines are untouched: every line reads as planned with no readiness yet
DO $$
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.job_material_lines WHERE stage <> 'planned'),
    'no existing line may be past planned after this migration';
END; $$;

-- View is security_invoker
DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'inventory_available'
      AND c.relkind = 'v' AND coalesce(c.reloptions::text, '') LIKE '%security_invoker=true%'
  ), 'inventory_available must be a security_invoker view';
  ASSERT NOT has_table_privilege('anon', 'public.inventory_available', 'SELECT'), 'anon must not read inventory_available';
END; $$;

-- Functions exist, are invoker, and are not callable by anon
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['reserve_job_materials', 'release_job_reservations', 'default_fulfil_location'] LOOP
    ASSERT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                   WHERE n.nspname = 'public' AND p.proname = f AND NOT p.prosecdef),
      f || ' must exist and be SECURITY INVOKER';
  END LOOP;
  ASSERT NOT has_function_privilege('anon', 'public.reserve_job_materials(uuid, text, boolean)', 'EXECUTE'),
    'anon must not execute reserve_job_materials';
  ASSERT has_function_privilege('authenticated', 'public.reserve_job_materials(uuid, text, boolean)', 'EXECUTE'),
    'authenticated must execute reserve_job_materials';
END; $$;

-- Expected on a fresh apply: no reservations yet (nothing is seeded)
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.inventory_reservations) = 0, 'no reservations are seeded';
END; $$;
