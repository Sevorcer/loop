-- Verify: 20261126400000_material_metrics
-- Read-only assertions; run after the migration is applied.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['job_readiness_snapshots', 'job_material_events'] LOOP
    ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t),
      t || ' must exist';
    ASSERT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relrowsecurity AND c.relforcerowsecurity
    ), 'RLS must be ENABLED and FORCED on ' || t;
    ASSERT NOT has_table_privilege('anon', 'public.' || t, 'SELECT'), 'anon must have no access to ' || t;
    ASSERT NOT has_table_privilege('authenticated', 'public.' || t, 'UPDATE'), t || ' is append-only: no UPDATE';
    ASSERT NOT has_table_privilege('authenticated', 'public.' || t, 'DELETE'), t || ' is append-only: no DELETE';
    ASSERT NOT has_table_privilege('authenticated', 'public.' || t, 'TRUNCATE'), t || ' is append-only: no TRUNCATE';
    ASSERT NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND (coalesce(qual, '') = 'true' OR coalesce(with_check, '') = 'true')
    ), t || ' must have no unconditional policy';
    ASSERT NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND cmd IN ('UPDATE', 'DELETE')
    ), t || ' must have no UPDATE or DELETE policy';
    ASSERT (SELECT count(*) FROM pg_trigger tg
            WHERE tg.tgrelid = ('public.' || t)::regclass AND NOT tg.tgisinternal) >= 2,
      t || ' must carry its stamp and append-only triggers';
  END LOOP;
  ASSERT (SELECT count(*) FROM public.job_readiness_snapshots) = 0, 'no snapshots are seeded';
  ASSERT (SELECT count(*) FROM public.job_material_events) = 0, 'no events are seeded';
END; $$;
