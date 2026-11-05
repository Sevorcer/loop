-- Verify: vehicle_alerts table

DO $$
BEGIN
  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vehicle_alerts'
  )), 'vehicle_alerts table must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_alerts' AND column_name = 'id'
  )), 'id column must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_alerts' AND column_name = 'org_id'
  )), 'org_id column must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_alerts' AND column_name = 'vehicle_name'
  )), 'vehicle_name column must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_alerts' AND column_name = 'title'
  )), 'title column must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_alerts' AND column_name = 'description'
  )), 'description column must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_alerts' AND column_name = 'priority'
  )), 'priority column must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_alerts' AND column_name = 'status'
  )), 'status column must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_alerts' AND column_name = 'reported_by'
  )), 'reported_by column must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_alerts' AND column_name = 'created_at'
  )), 'created_at column must exist';

  ASSERT (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_alerts' AND column_name = 'updated_at'
  )), 'updated_at column must exist';

  ASSERT (SELECT relrowsecurity FROM pg_class WHERE relname = 'vehicle_alerts'),
    'RLS must be enabled on vehicle_alerts';

  ASSERT (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'vehicle_alerts'),
    'FORCE RLS must be enabled on vehicle_alerts';

  ASSERT (SELECT COUNT(*) >= 3 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vehicle_alerts'),
    'vehicle_alerts must have RLS policies';

  -- No permissive anon insert hole (the portal_submissions anti-pattern)
  ASSERT (
    SELECT COUNT(*) = 0 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vehicle_alerts'
      AND cmd = 'INSERT'
      AND with_check = 'true'
  ), 'vehicle_alerts must not have WITH CHECK (true) insert policies';

  RAISE NOTICE 'vehicle_alerts verification passed';
END $$;
