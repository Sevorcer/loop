-- Verify: 20261125000000_vehicle_text_retire
-- Read-only assertions; run after M4 is applied.

DO $$ BEGIN
  ASSERT NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crews' AND column_name = 'truck_name'
  ), 'crews.truck_name must be dropped';
  ASSERT NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_alerts' AND column_name = 'vehicle_name'
  ), 'vehicle_alerts.vehicle_name must be dropped';
END $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_alerts' AND column_name = 'vehicle_id'
      AND data_type = 'uuid' AND is_nullable = 'NO'
  ), 'vehicle_alerts.vehicle_id must be NOT NULL uuid';
  ASSERT NOT EXISTS (SELECT 1 FROM public.vehicle_alerts WHERE vehicle_id IS NULL),
    'no vehicle_alerts row may be unlinked';
END $$;

-- The junk rows are gone: nothing remains that the old text columns could have held
-- without a vehicle (the only prior rows were "jjj" and "Unmarked Van", both unlinked).
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.vehicle_alerts;
  RAISE NOTICE 'vehicle_alerts rows remaining: % (all linked to a vehicle)', n;
END $$;

-- crews.vehicle_id link and its unique index survive; vehicles untouched.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crews' AND column_name = 'vehicle_id'
  ), 'crews.vehicle_id must remain';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'crews_vehicle_id_uidx'
  ), 'crews_vehicle_id_uidx must remain';
  ASSERT NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'crew_id'
  ), 'vehicles.crew_id must stay gone';
END $$;
