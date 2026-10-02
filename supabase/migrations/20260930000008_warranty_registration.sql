-- Warranty registration tracking for installed systems (2026-10-02)
-- Adds warranty registration status to installed_systems so the office can
-- mark a system's warranty as registered, with a visible "not registered"
-- flag until then. Per Collin 2026-10-02: registration is per installed
-- system, marked by the office.

ALTER TABLE public.installed_systems
  ADD COLUMN IF NOT EXISTS warranty_registered BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS warranty_registered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS warranty_registered_by TEXT;
