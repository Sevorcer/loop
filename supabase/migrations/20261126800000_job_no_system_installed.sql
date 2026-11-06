-- =============================================================================
-- Job closeout — "no system installed" attestation (Collin, 2026-11-06).
--
-- Full closeout requires installed systems to be entered. On jobs where the
-- crew installed nothing (service calls, inspections, warranty revisits),
-- that gate was unpassable except by entering a fake system. The crew can
-- now attest that no system was installed; the attestation satisfies the
-- gate and is stamped with who/when for the audit trail (the job_activity
-- record carries the actor as well).
--
-- UP:
--   - jobs.no_system_installed      boolean NOT NULL DEFAULT false
--   - jobs.no_system_installed_by   uuid (profile id of the attester)
--   - jobs.no_system_installed_at   timestamptz (when attested)
--
-- Column-only migration: no new table, no RLS change. The jobs table's
-- existing policies already cover these columns.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   ALTER TABLE public.jobs
--     DROP COLUMN IF EXISTS no_system_installed,
--     DROP COLUMN IF EXISTS no_system_installed_by,
--     DROP COLUMN IF EXISTS no_system_installed_at;
-- =============================================================================

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS no_system_installed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_system_installed_by uuid,
  ADD COLUMN IF NOT EXISTS no_system_installed_at timestamptz;
