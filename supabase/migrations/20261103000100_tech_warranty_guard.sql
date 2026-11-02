-- =============================================================================
-- Migration — Technician warranty-write guard
-- Security fix S2
--
-- Warranty registration is per installed system and is marked by the office
-- (per Collin, 2026-10-02). But the installed_systems RLS lets a technician
-- update any column on a system for a job they are assigned to (and on any
-- system with no job), and there is no column guard — so a technician can set
-- warranty_registered directly in the database, bypassing the office-only
-- rule. (The API route and UI are tightened in the same change set.)
--
-- This migration adds a BEFORE UPDATE trigger that blocks a technician from
-- changing any warranty_registered* column.
--
-- UP:
--   - Create function public.guard_tech_installed_system_warranty().
--   - Create BEFORE UPDATE trigger on public.installed_systems using it.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP TRIGGER IF EXISTS guard_tech_installed_system_warranty ON public.installed_systems;
--   DROP FUNCTION IF EXISTS public.guard_tech_installed_system_warranty();
-- =============================================================================

-- ---------------------------------------------------------------------------
-- guard_tech_installed_system_warranty
-- Technicians may record equipment (model, serial, etc.) on their jobs, but
-- never the warranty registration state — that stays office-only.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_tech_installed_system_warranty()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_app_role() IS DISTINCT FROM 'tech' THEN
    RETURN NEW;
  END IF;

  IF NEW.warranty_registered   IS DISTINCT FROM OLD.warranty_registered
     OR NEW.warranty_registered_at IS DISTINCT FROM OLD.warranty_registered_at
     OR NEW.warranty_registered_by IS DISTINCT FROM OLD.warranty_registered_by
  THEN
    RAISE EXCEPTION
      'Technicians cannot change warranty registration — that is office-only'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_tech_installed_system_warranty ON public.installed_systems;
CREATE TRIGGER guard_tech_installed_system_warranty
  BEFORE UPDATE ON public.installed_systems
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_tech_installed_system_warranty();
