-- =============================================================================
-- Migration — Vehicle FK expand (Inventory Lane 1, M3 of 4)
-- Plan: docs/briefs/inventory-lane1-plan-2026-11-05.md (approved by Collin 2026-11-05;
--       vehicles amendment: NO backfill, NO vehicle creation)
--
-- UP (expand only — additive, nullable, safe to apply before the code deploys):
--   - crews.vehicle_id          nullable FK -> vehicles (same-org composite FK)
--   - vehicle_alerts.vehicle_id nullable FK -> vehicles (same-org composite FK)
--   - one crew per vehicle: unique partial index on crews(vehicle_id)
--
-- Deliberately NOT done here:
--   * No vehicles rows are created from crews.truck_name or vehicle_alerts.vehicle_name.
--     Collin adds the real vans in the Locations & vans screen.
--   * No existing row is linked or changed. The legacy alert rows ("jjj",
--     "Unmarked Van") stay unlinked.
--   * crews.truck_name and vehicle_alerts.vehicle_name are NOT dropped. That is M4
--     (20261124000000), applied only after this cutover is deployed and live-checked.
--
-- Existing RLS on crews and vehicle_alerts already covers the new columns; no
-- policy changes. The composite FKs make a cross-org link impossible.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   ALTER TABLE public.vehicle_alerts DROP CONSTRAINT IF EXISTS vehicle_alerts_vehicle_same_org_fkey;
--   ALTER TABLE public.crews          DROP CONSTRAINT IF EXISTS crews_vehicle_same_org_fkey;
--   DROP INDEX IF EXISTS public.vehicle_alerts_vehicle_id_idx;
--   DROP INDEX IF EXISTS public.crews_vehicle_id_uidx;
--   ALTER TABLE public.vehicle_alerts DROP COLUMN IF EXISTS vehicle_id;
--   ALTER TABLE public.crews          DROP COLUMN IF EXISTS vehicle_id;
-- =============================================================================

ALTER TABLE public.crews          ADD COLUMN IF NOT EXISTS vehicle_id uuid;
ALTER TABLE public.vehicle_alerts ADD COLUMN IF NOT EXISTS vehicle_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crews_vehicle_same_org_fkey') THEN
    ALTER TABLE public.crews
      ADD CONSTRAINT crews_vehicle_same_org_fkey
      FOREIGN KEY (vehicle_id, org_id) REFERENCES public.vehicles (id, org_id)
      ON DELETE SET NULL (vehicle_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_alerts_vehicle_same_org_fkey') THEN
    ALTER TABLE public.vehicle_alerts
      ADD CONSTRAINT vehicle_alerts_vehicle_same_org_fkey
      FOREIGN KEY (vehicle_id, org_id) REFERENCES public.vehicles (id, org_id)
      ON DELETE SET NULL (vehicle_id);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS crews_vehicle_id_uidx
  ON public.crews (vehicle_id) WHERE vehicle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS vehicle_alerts_vehicle_id_idx
  ON public.vehicle_alerts (vehicle_id) WHERE vehicle_id IS NOT NULL;
