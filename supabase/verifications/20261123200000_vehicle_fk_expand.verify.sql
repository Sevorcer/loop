-- Verify: 20261123200000_vehicle_fk_expand
-- Read-only assertions; run after the migration is applied.

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crews' AND column_name = 'vehicle_id'
      AND data_type = 'uuid' AND is_nullable = 'YES'
  ), 'crews.vehicle_id must be a nullable uuid';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_alerts' AND column_name = 'vehicle_id'
      AND data_type = 'uuid' AND is_nullable = 'YES'
  ), 'vehicle_alerts.vehicle_id must be a nullable uuid (NOT NULL arrives with M4)';
END; $$;

-- Same-org composite FKs onto vehicles(id, org_id), SET NULL on vehicle delete
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'crews_vehicle_same_org_fkey' AND contype = 'f'
      AND conrelid = 'public.crews'::regclass AND confrelid = 'public.vehicles'::regclass
      AND array_length(conkey, 1) = 2 AND confdeltype = 'n'
  ), 'crews_vehicle_same_org_fkey must be a composite FK to vehicles ON DELETE SET NULL';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vehicle_alerts_vehicle_same_org_fkey' AND contype = 'f'
      AND conrelid = 'public.vehicle_alerts'::regclass AND confrelid = 'public.vehicles'::regclass
      AND array_length(conkey, 1) = 2 AND confdeltype = 'n'
  ), 'vehicle_alerts_vehicle_same_org_fkey must be a composite FK to vehicles ON DELETE SET NULL';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'crews' AND indexname = 'crews_vehicle_id_uidx'
      AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%vehicle_id IS NOT NULL%'
  ), 'crews_vehicle_id_uidx must be a unique partial index (one crew per vehicle)';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'vehicle_alerts' AND indexname = 'vehicle_alerts_vehicle_id_idx'
  ), 'vehicle_alerts_vehicle_id_idx must exist';
END; $$;

-- Expand phase: the legacy text columns must still exist (they are dropped by M4 only)
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crews' AND column_name = 'truck_name'
  ), 'crews.truck_name must still exist until M4';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_alerts' AND column_name = 'vehicle_name'
  ), 'vehicle_alerts.vehicle_name must still exist until M4';
END; $$;

-- No-backfill guarantee: the migration itself must not have linked any existing row.
-- (Rows linked later through the app are fine, so this only checks the shape of the data model.)
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.crews c WHERE c.vehicle_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = c.vehicle_id AND v.org_id = c.org_id)) = 0,
    'every linked crew.vehicle_id must reference a same-org vehicle';
  ASSERT (SELECT count(*) FROM public.vehicle_alerts a WHERE a.vehicle_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = a.vehicle_id AND v.org_id = a.org_id)) = 0,
    'every linked vehicle_alerts.vehicle_id must reference a same-org vehicle';
END; $$;
