-- =============================================================================
-- Migration — Vehicle text retire (Inventory Lane 1, M4 of 4: CONTRACT)
-- Plan: docs/briefs/inventory-lane1-plan-2026-11-05.md
--
-- UP (destructive; apply ONLY after the PR D code is merged and Vercel is Ready,
--     so nothing live reads the dropped columns):
--   1. Delete the two junk test alerts, matched on their legacy text
--      ("jjj", "Unmarked Van") and only while still unlinked (vehicle_id IS NULL).
--   2. vehicle_alerts.vehicle_id SET NOT NULL.
--   3. DROP crews.truck_name and vehicle_alerts.vehicle_name.
--
-- Safety: if any OTHER unlinked alert exists, this raises before changing the
-- NOT NULL (nothing is deleted beyond the two junk rows; the transaction rolls
-- back). Re-running after success is a no-op.
--
-- Does NOT touch the vehicles table. (vehicles.crew_id was removed in M2; the
-- crew <-> van link is crews.vehicle_id only.)
--
-- Note: the same-org FK vehicle_alerts_vehicle_same_org_fkey is ON DELETE SET
-- NULL (vehicle_id). With NOT NULL in place, hard-deleting a vehicle that has
-- alerts is refused by Postgres (not-null violation) instead of orphaning them.
-- Vehicles are retired, never deleted, so this is the intended behaviour.
--
-- DOWN (manual rollback — the deleted rows and dropped text are NOT recoverable
-- from this file; restore from backup if needed):
--   ALTER TABLE public.crews          ADD COLUMN IF NOT EXISTS truck_name   text NOT NULL DEFAULT '';
--   ALTER TABLE public.vehicle_alerts ADD COLUMN IF NOT EXISTS vehicle_name text;
--   UPDATE public.vehicle_alerts a SET vehicle_name = v.name FROM public.vehicles v WHERE v.id = a.vehicle_id;
--   ALTER TABLE public.vehicle_alerts ALTER COLUMN vehicle_name SET NOT NULL;
--   ALTER TABLE public.vehicle_alerts ALTER COLUMN vehicle_id   DROP NOT NULL;
-- =============================================================================

BEGIN;

-- 1. Junk rows (skipped on a re-run, when vehicle_name is already gone).
DO $$
DECLARE
  deleted integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_alerts' AND column_name = 'vehicle_name'
  ) THEN
    DELETE FROM public.vehicle_alerts
     WHERE vehicle_id IS NULL
       AND lower(btrim(vehicle_name)) IN ('jjj', 'unmarked van');
    GET DIAGNOSTICS deleted = ROW_COUNT;
    IF deleted > 2 THEN
      RAISE EXCEPTION 'M4 expected to delete at most 2 junk alerts, matched %', deleted;
    END IF;
    RAISE NOTICE 'M4: deleted % junk vehicle_alerts row(s)', deleted;
  END IF;
END $$;

-- 2. NOT NULL, with a readable failure if something else is still unlinked.
DO $$
DECLARE
  unlinked integer;
BEGIN
  SELECT count(*) INTO unlinked FROM public.vehicle_alerts WHERE vehicle_id IS NULL;
  IF unlinked > 0 THEN
    RAISE EXCEPTION 'M4 blocked: % vehicle_alerts row(s) still have no vehicle_id. Link or remove them first.', unlinked;
  END IF;
END $$;

ALTER TABLE public.vehicle_alerts ALTER COLUMN vehicle_id SET NOT NULL;

-- 3. Retire the legacy text columns.
ALTER TABLE public.crews          DROP COLUMN IF EXISTS truck_name;
ALTER TABLE public.vehicle_alerts DROP COLUMN IF EXISTS vehicle_name;

COMMIT;
