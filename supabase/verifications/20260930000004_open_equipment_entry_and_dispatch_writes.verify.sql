-- Asserts the widened org write policies.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'installed_systems'
      AND policyname = 'installed_systems: org write'
  ), 'installed_systems: org write must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dispatch_plans'
      AND policyname = 'dispatch_plans: org write'
  ), 'dispatch_plans: org write must exist';
END; $$;
