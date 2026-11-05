-- Migration: job_materials (#23 Dispatch — materials + technical data)
--
-- Per-job materials checklist: each line is one part/consumable a job needs,
-- tracked through three states:
--   needed   → on the list, not yet loaded
--   on_truck → pulled from the shop / supplier and loaded
--   used     → installed or consumed on the job
--
-- Who/when is stamped by trigger from auth.uid() (never from the request
-- body): created_by/created_at, updated_by/updated_at, and
-- state_changed_by/state_changed_at whenever the state moves.
--
-- Inventory plug-in (bundlec-note-inventory.md, phases 2–3): a later
-- migration adds a nullable catalog_item_id FK → inventory_items and an
-- inventory_movements ledger. The needed → on_truck → used transitions in
-- services/jobMaterials.ts are the single place that will also write
-- movements (shop → truck transfer, truck → job consume). Nothing here has to
-- be rewritten for that; part_number is the bridge key until a catalog exists.
--
-- RLS (org-scoped, FORCE, no anon, portal none) — follows vehicle_alerts /
-- job_tasks and the initplan (select fn()) form from 20261107000000:
--   owner/manager/dispatch/office/sales : read, add, edit, delete
--   tech                                : read + update on jobs they are
--                                         assigned to (private.caller_is_assigned_to_job);
--                                         a trigger limits a tech's update
--                                         to state and quantity.
--   portal / anon                       : nothing
--
-- NOT APPLIED. Apply via the Supabase SQL editor after review, then run
-- 20261121000000_job_materials.verify.sql.
--
-- DOWN (manual):
--   DROP TABLE IF EXISTS public.job_material_lines;
--   DROP FUNCTION IF EXISTS public.job_material_lines_stamp();
--   DROP FUNCTION IF EXISTS public.guard_tech_job_material_update();

BEGIN;

CREATE TABLE IF NOT EXISTS public.job_material_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id            uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  name              text NOT NULL
                      CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  quantity          numeric(12,3) NOT NULL DEFAULT 1
                      CHECK (quantity > 0 AND quantity <= 100000),
  unit              text NOT NULL DEFAULT 'ea'
                      CHECK (char_length(btrim(unit)) BETWEEN 1 AND 20),
  part_number       text
                      CHECK (part_number IS NULL OR char_length(part_number) <= 100),
  notes             text NOT NULL DEFAULT ''
                      CHECK (char_length(notes) <= 2000),
  state             text NOT NULL DEFAULT 'needed'
                      CHECK (state IN ('needed', 'on_truck', 'used')),
  sort_order        integer NOT NULL DEFAULT 0,
  created_by        uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  state_changed_by  uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  state_changed_at  timestamptz
);

COMMENT ON TABLE public.job_material_lines IS
  'Per-job materials checklist (needed → on_truck → used). #23. Inventory phase 2 adds catalog_item_id + movements.';

CREATE INDEX IF NOT EXISTS job_material_lines_job_sort_idx
  ON public.job_material_lines (job_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS job_material_lines_org_state_idx
  ON public.job_material_lines (org_id, state);
CREATE INDEX IF NOT EXISTS job_material_lines_created_by_idx
  ON public.job_material_lines (created_by);
CREATE INDEX IF NOT EXISTS job_material_lines_updated_by_idx
  ON public.job_material_lines (updated_by);
CREATE INDEX IF NOT EXISTS job_material_lines_state_changed_by_idx
  ON public.job_material_lines (state_changed_by);

-- ---------------------------------------------------------------------------
-- Grants: no anon access at all; authenticated goes through RLS.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.job_material_lines FROM anon;
REVOKE ALL ON public.job_material_lines FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_material_lines TO authenticated;

ALTER TABLE public.job_material_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_material_lines FORCE ROW LEVEL SECURITY;

-- Read: office roles, whole org
DROP POLICY IF EXISTS "job_material_lines: read for office roles" ON public.job_material_lines;
CREATE POLICY "job_material_lines: read for office roles"
  ON public.job_material_lines FOR SELECT
  TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = (select current_org_id())
  );

-- Read: tech, assigned jobs only
DROP POLICY IF EXISTS "job_material_lines: tech reads assigned jobs" ON public.job_material_lines;
CREATE POLICY "job_material_lines: tech reads assigned jobs"
  ON public.job_material_lines FOR SELECT
  TO authenticated
  USING (
    (select current_app_role()) = 'tech'
    AND org_id = (select current_org_id())
    AND private.caller_is_assigned_to_job(job_id)
  );

-- Insert: office roles; the job must belong to the caller's org
DROP POLICY IF EXISTS "job_material_lines: insert for office roles" ON public.job_material_lines;
CREATE POLICY "job_material_lines: insert for office roles"
  ON public.job_material_lines FOR INSERT
  TO authenticated
  WITH CHECK (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = (select current_org_id())
    AND EXISTS (
      SELECT 1 FROM public.jobs AS j
      WHERE j.id = job_material_lines.job_id
        AND j.org_id = (select current_org_id())
    )
  );

-- Update: office roles, whole org
DROP POLICY IF EXISTS "job_material_lines: update for office roles" ON public.job_material_lines;
CREATE POLICY "job_material_lines: update for office roles"
  ON public.job_material_lines FOR UPDATE
  TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = (select current_org_id())
  )
  WITH CHECK (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = (select current_org_id())
  );

-- Update: tech, assigned jobs only (columns limited by trigger below)
DROP POLICY IF EXISTS "job_material_lines: tech updates assigned jobs" ON public.job_material_lines;
CREATE POLICY "job_material_lines: tech updates assigned jobs"
  ON public.job_material_lines FOR UPDATE
  TO authenticated
  USING (
    (select current_app_role()) = 'tech'
    AND org_id = (select current_org_id())
    AND private.caller_is_assigned_to_job(job_id)
  )
  WITH CHECK (
    (select current_app_role()) = 'tech'
    AND org_id = (select current_org_id())
    AND private.caller_is_assigned_to_job(job_id)
  );

-- Delete: office roles
DROP POLICY IF EXISTS "job_material_lines: delete for office roles" ON public.job_material_lines;
CREATE POLICY "job_material_lines: delete for office roles"
  ON public.job_material_lines FOR DELETE
  TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = (select current_org_id())
  );

-- ---------------------------------------------------------------------------
-- Stamp trigger: actor + timestamps come from the session, never the client.
-- Also pins a line to its job/org (moving a line between jobs is not a thing).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.job_material_lines_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := actor;
    NEW.created_at := now();
    NEW.updated_by := actor;
    NEW.updated_at := now();
    NEW.state_changed_by := actor;
    NEW.state_changed_at := now();
    RETURN NEW;
  END IF;

  IF NEW.job_id IS DISTINCT FROM OLD.job_id OR NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'A material line cannot be moved to another job'
      USING ERRCODE = '42501';
  END IF;

  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  NEW.updated_by := actor;
  NEW.updated_at := now();
  IF NEW.state IS DISTINCT FROM OLD.state THEN
    NEW.state_changed_by := actor;
    NEW.state_changed_at := now();
  ELSE
    NEW.state_changed_by := OLD.state_changed_by;
    NEW.state_changed_at := OLD.state_changed_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_material_lines_stamp ON public.job_material_lines;
CREATE TRIGGER trg_job_material_lines_stamp
  BEFORE INSERT OR UPDATE ON public.job_material_lines
  FOR EACH ROW EXECUTE FUNCTION public.job_material_lines_stamp();

-- ---------------------------------------------------------------------------
-- Tech column guard: a technician may only move state and adjust quantity.
-- Same shape as guard_tech_installed_system_warranty (20261103000100).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_tech_job_material_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_app_role() IS DISTINCT FROM 'tech' THEN
    RETURN NEW;
  END IF;

  IF NEW.name        IS DISTINCT FROM OLD.name
     OR NEW.unit        IS DISTINCT FROM OLD.unit
     OR NEW.part_number IS DISTINCT FROM OLD.part_number
     OR NEW.notes       IS DISTINCT FROM OLD.notes
     OR NEW.sort_order  IS DISTINCT FROM OLD.sort_order
  THEN
    RAISE EXCEPTION 'Technicians can only change a material''s state and quantity'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_tech_job_material_update ON public.job_material_lines;
CREATE TRIGGER trg_guard_tech_job_material_update
  BEFORE UPDATE ON public.job_material_lines
  FOR EACH ROW EXECUTE FUNCTION public.guard_tech_job_material_update();

-- Trigger functions are not RPCs (20261108000100 hardening).
REVOKE EXECUTE ON FUNCTION public.job_material_lines_stamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_tech_job_material_update() FROM PUBLIC, anon, authenticated;

COMMIT;
