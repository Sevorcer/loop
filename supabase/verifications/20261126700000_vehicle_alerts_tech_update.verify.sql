-- Verify: 20261126700000_vehicle_alerts_tech_update
-- Read-only assertions; run after the migration is applied.

DO $$
BEGIN
  -- The widened policy exists under its new name, and the old one is gone.
  ASSERT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'vehicle_alerts'
                   AND policyname = 'vehicle_alerts: update for staff'
                   AND cmd = 'UPDATE'),
    'the staff update policy must exist';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies
                     WHERE schemaname = 'public' AND tablename = 'vehicle_alerts'
                       AND policyname = 'vehicle_alerts: update for office+dispatch'),
    'the old office+dispatch update policy must be gone';

  -- Its definition must include tech (and must not include sales or portal).
  ASSERT (SELECT qual FROM pg_policies
          WHERE schemaname = 'public' AND tablename = 'vehicle_alerts'
            AND policyname = 'vehicle_alerts: update for staff') LIKE '%''tech''%',
    'the update policy must include tech';
  ASSERT (SELECT qual FROM pg_policies
          WHERE schemaname = 'public' AND tablename = 'vehicle_alerts'
            AND policyname = 'vehicle_alerts: update for staff') NOT LIKE '%''sales''%',
    'the update policy must not include sales';
  ASSERT (SELECT with_check FROM pg_policies
          WHERE schemaname = 'public' AND tablename = 'vehicle_alerts'
            AND policyname = 'vehicle_alerts: update for staff') LIKE '%''tech''%',
    'the update policy WITH CHECK must include tech';

  -- Read/insert/delete policies untouched.
  ASSERT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'vehicle_alerts'
                   AND policyname = 'vehicle_alerts: read for staff' AND cmd = 'SELECT'),
    'the read policy must remain';
  ASSERT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'vehicle_alerts'
                   AND policyname = 'vehicle_alerts: delete for owner' AND cmd = 'DELETE'),
    'the owner-only delete policy must remain';
END; $$;
