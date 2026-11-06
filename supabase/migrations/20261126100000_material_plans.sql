-- =============================================================================
-- Migration — Job material plans (Inventory Lane 4, PR B, M2)
-- Plan: docs/briefs/inventory-lane4-plan-2026-11-05.md (approved 2026-11-05; D1–D13)
--
-- UP (expand-only; existing job_material_lines rows and the legacy job-materials
-- API keep working untouched):
--   - job_material_plans         one plan header per job (draft | confirmed)
--   - job_kits                  kits attached to a job (snapshot: version + multiplier)
--   - job_material_line_events  append-only history of every plan-line change
--   - catalog_item_aliases      remembered "estimate text -> catalog item" links
--   - job_material_lines        ADDITIVE columns: plan_id, catalog_item_id (NULL = needs
--                               SKU), source, soft refs to the SF line items, kit
--                               provenance, is_optional, non_stock_reason
--   - trg_job_material_lines_events   writes the history from the line itself, so
--                               every path (RPC, legacy PATCH, tech quantity tap)
--                               is recorded the same way
--   - guard_tech_job_material_update  EXTENDED: techs still change only state and quantity
--   - generate_material_plan / refresh_job_kit / adjust_material_line /
--     link_material_line_sku / remove_material_line    atomic SECURITY INVOKER RPCs
--
-- Draft plans never reserve stock; reservations, readiness, pulls and closeout
-- arrive in PRs C–E. This migration touches no stock tables.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP FUNCTION IF EXISTS public.remove_material_line(uuid, text);
--   DROP FUNCTION IF EXISTS public.link_material_line_sku(uuid, uuid, boolean);
--   DROP FUNCTION IF EXISTS public.adjust_material_line(uuid, jsonb, text);
--   DROP FUNCTION IF EXISTS public.refresh_job_kit(uuid, uuid, integer, numeric, jsonb);
--   DROP FUNCTION IF EXISTS public.generate_material_plan(uuid, text, jsonb, jsonb);
--   DROP TRIGGER IF EXISTS trg_job_material_lines_events ON public.job_material_lines;
--   DROP FUNCTION IF EXISTS public.fn_job_material_lines_events();
--   ALTER TABLE public.job_material_lines
--     DROP COLUMN IF EXISTS non_stock_reason, DROP COLUMN IF EXISTS is_optional,
--     DROP COLUMN IF EXISTS kit_quantity, DROP COLUMN IF EXISTS kit_version,
--     DROP COLUMN IF EXISTS kit_id, DROP COLUMN IF EXISTS estimate_line_item_id,
--     DROP COLUMN IF EXISTS job_line_item_id, DROP COLUMN IF EXISTS source,
--     DROP COLUMN IF EXISTS catalog_item_id, DROP COLUMN IF EXISTS plan_id;
--   DROP TABLE IF EXISTS public.catalog_item_aliases;
--   DROP TABLE IF EXISTS public.job_material_line_events;
--   DROP TABLE IF EXISTS public.job_kits;
--   DROP TABLE IF EXISTS public.job_material_plans;
--   DROP FUNCTION IF EXISTS public.fn_job_material_events_guard();
--   DROP FUNCTION IF EXISTS public.fn_job_material_events_stamp();
--   DROP FUNCTION IF EXISTS public.fn_job_material_plans_stamp();
--   DROP FUNCTION IF EXISTS public.fn_job_kits_stamp();
--   DROP FUNCTION IF EXISTS public.fn_catalog_item_aliases_stamp();
--   (then restore guard_tech_job_material_update() from 20261121000000)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- job_material_plans — one header per job
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_material_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id          uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
  generated_from  text NOT NULL DEFAULT 'manual'
                    CHECK (generated_from IN ('estimate', 'kit', 'manual', 'mixed')),
  generated_at    timestamptz NOT NULL DEFAULT now(),
  confirmed_by    uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  confirmed_at    timestamptz,
  created_by      uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_material_plans_job_key UNIQUE (job_id),
  CONSTRAINT job_material_plans_id_org_key UNIQUE (id, org_id)
);

CREATE INDEX IF NOT EXISTS job_material_plans_org_status_idx
  ON public.job_material_plans (org_id, status);
CREATE INDEX IF NOT EXISTS job_material_plans_confirmed_by_idx
  ON public.job_material_plans (confirmed_by);
CREATE INDEX IF NOT EXISTS job_material_plans_created_by_idx
  ON public.job_material_plans (created_by);
CREATE INDEX IF NOT EXISTS job_material_plans_updated_by_idx
  ON public.job_material_plans (updated_by);

CREATE OR REPLACE FUNCTION public.fn_job_material_plans_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'draft';
    NEW.confirmed_by := NULL;
    NEW.confirmed_at := NULL;
    NEW.created_by := actor;
    NEW.created_at := now();
    NEW.generated_at := now();
  ELSE
    IF NEW.job_id IS DISTINCT FROM OLD.job_id OR NEW.org_id IS DISTINCT FROM OLD.org_id THEN
      RAISE EXCEPTION 'A material plan cannot be moved to another job' USING ERRCODE = '42501';
    END IF;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.generated_at := OLD.generated_at;
    IF NEW.status = 'confirmed' AND OLD.status <> 'confirmed' THEN
      NEW.confirmed_by := actor;
      NEW.confirmed_at := now();
    ELSIF NEW.status = 'confirmed' THEN
      NEW.confirmed_by := OLD.confirmed_by;
      NEW.confirmed_at := OLD.confirmed_at;
    ELSE
      NEW.confirmed_by := NULL;
      NEW.confirmed_at := NULL;
    END IF;
  END IF;
  NEW.updated_by := actor;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_material_plans_stamp ON public.job_material_plans;
CREATE TRIGGER trg_job_material_plans_stamp
  BEFORE INSERT OR UPDATE ON public.job_material_plans
  FOR EACH ROW EXECUTE FUNCTION public.fn_job_material_plans_stamp();

-- ---------------------------------------------------------------------------
-- job_kits — kits attached to a job (snapshot semantics: editing the kit later
-- never changes the job; "Refresh from kit" is an explicit action)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_kits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id        uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  kit_id        uuid NOT NULL,
  kit_version   integer NOT NULL CHECK (kit_version >= 1),
  multiplier    numeric(8,3) NOT NULL DEFAULT 1 CHECK (multiplier > 0 AND multiplier <= 1000),
  attached_by   uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  attached_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_kits_job_kit_key UNIQUE (job_id, kit_id),
  CONSTRAINT job_kits_kit_same_org_fkey
    FOREIGN KEY (kit_id, org_id) REFERENCES public.kit_templates (id, org_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS job_kits_org_kit_idx ON public.job_kits (org_id, kit_id);
CREATE INDEX IF NOT EXISTS job_kits_attached_by_idx ON public.job_kits (attached_by);

CREATE OR REPLACE FUNCTION public.fn_job_kits_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.attached_by := auth.uid();
    NEW.attached_at := now();
  ELSE
    IF NEW.job_id IS DISTINCT FROM OLD.job_id OR NEW.kit_id IS DISTINCT FROM OLD.kit_id
       OR NEW.org_id IS DISTINCT FROM OLD.org_id THEN
      RAISE EXCEPTION 'An attached kit cannot be re-pointed' USING ERRCODE = '42501';
    END IF;
    NEW.attached_by := OLD.attached_by;
    NEW.attached_at := OLD.attached_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_kits_stamp ON public.job_kits;
CREATE TRIGGER trg_job_kits_stamp
  BEFORE INSERT OR UPDATE ON public.job_kits
  FOR EACH ROW EXECUTE FUNCTION public.fn_job_kits_stamp();

-- ---------------------------------------------------------------------------
-- catalog_item_aliases — "this estimate text means that catalog item"
-- alias is stored normalized (lowercase, collapsed whitespace); the app
-- normalizes the same way before looking up.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.catalog_item_aliases (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  catalog_item_id  uuid NOT NULL,
  alias            text NOT NULL
                     CHECK (char_length(alias) BETWEEN 1 AND 200
                            AND alias = regexp_replace(lower(btrim(alias)), '\s+', ' ', 'g')),
  created_by       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_item_aliases_org_alias_key UNIQUE (org_id, alias),
  CONSTRAINT catalog_item_aliases_item_same_org_fkey
    FOREIGN KEY (catalog_item_id, org_id) REFERENCES public.catalog_items (id, org_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS catalog_item_aliases_item_idx
  ON public.catalog_item_aliases (catalog_item_id);
CREATE INDEX IF NOT EXISTS catalog_item_aliases_created_by_idx
  ON public.catalog_item_aliases (created_by);

CREATE OR REPLACE FUNCTION public.fn_catalog_item_aliases_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_at := now();
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.org_id := OLD.org_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_catalog_item_aliases_stamp ON public.catalog_item_aliases;
CREATE TRIGGER trg_catalog_item_aliases_stamp
  BEFORE INSERT OR UPDATE ON public.catalog_item_aliases
  FOR EACH ROW EXECUTE FUNCTION public.fn_catalog_item_aliases_stamp();

-- ---------------------------------------------------------------------------
-- job_material_lines — additive plan columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.job_material_lines
  ADD COLUMN IF NOT EXISTS plan_id               uuid,
  ADD COLUMN IF NOT EXISTS catalog_item_id       uuid,
  ADD COLUMN IF NOT EXISTS source                text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS job_line_item_id      uuid,
  ADD COLUMN IF NOT EXISTS estimate_line_item_id uuid,
  ADD COLUMN IF NOT EXISTS kit_id                uuid,
  ADD COLUMN IF NOT EXISTS kit_version           integer,
  ADD COLUMN IF NOT EXISTS kit_quantity          numeric(12,3),
  ADD COLUMN IF NOT EXISTS is_optional           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS non_stock_reason      text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_material_lines_source_check') THEN
    ALTER TABLE public.job_material_lines
      ADD CONSTRAINT job_material_lines_source_check
      CHECK (source IN ('manual', 'estimate', 'kit', 'field'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_material_lines_kit_quantity_check') THEN
    ALTER TABLE public.job_material_lines
      ADD CONSTRAINT job_material_lines_kit_quantity_check
      CHECK (kit_quantity IS NULL OR (kit_quantity > 0 AND kit_quantity <= 100000));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_material_lines_non_stock_reason_check') THEN
    ALTER TABLE public.job_material_lines
      ADD CONSTRAINT job_material_lines_non_stock_reason_check
      CHECK (non_stock_reason IS NULL
             OR (catalog_item_id IS NULL AND char_length(btrim(non_stock_reason)) BETWEEN 1 AND 500));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_material_lines_plan_same_org_fkey') THEN
    ALTER TABLE public.job_material_lines
      ADD CONSTRAINT job_material_lines_plan_same_org_fkey
      FOREIGN KEY (plan_id, org_id) REFERENCES public.job_material_plans (id, org_id)
      ON DELETE SET NULL (plan_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_material_lines_item_same_org_fkey') THEN
    ALTER TABLE public.job_material_lines
      ADD CONSTRAINT job_material_lines_item_same_org_fkey
      FOREIGN KEY (catalog_item_id, org_id) REFERENCES public.catalog_items (id, org_id)
      ON DELETE SET NULL (catalog_item_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_material_lines_kit_same_org_fkey') THEN
    ALTER TABLE public.job_material_lines
      ADD CONSTRAINT job_material_lines_kit_same_org_fkey
      FOREIGN KEY (kit_id, org_id) REFERENCES public.kit_templates (id, org_id)
      ON DELETE SET NULL (kit_id);
  END IF;
END $$;

COMMENT ON COLUMN public.job_material_lines.catalog_item_id IS
  'NULL = needs SKU (free text from an estimate or typed by hand). Linked via link_material_line_sku().';
COMMENT ON COLUMN public.job_material_lines.job_line_item_id IS
  'Soft reference to job_line_items.id (SF import); no FK so re-imports never fail on plans.';
COMMENT ON COLUMN public.job_material_lines.estimate_line_item_id IS
  'Soft reference to estimate_line_items.id (SF import); no FK so re-imports never fail on plans.';

CREATE INDEX IF NOT EXISTS job_material_lines_plan_idx ON public.job_material_lines (plan_id);
CREATE INDEX IF NOT EXISTS job_material_lines_catalog_item_idx ON public.job_material_lines (catalog_item_id);
CREATE INDEX IF NOT EXISTS job_material_lines_kit_idx ON public.job_material_lines (kit_id);
-- Needs-SKU queue: plan lines with no catalog item and no "not stock" decision.
CREATE INDEX IF NOT EXISTS job_material_lines_needs_sku_idx
  ON public.job_material_lines (org_id, created_at)
  WHERE catalog_item_id IS NULL AND non_stock_reason IS NULL AND plan_id IS NOT NULL;
-- D7: one line per catalog item per job; regeneration is idempotent per source row.
CREATE UNIQUE INDEX IF NOT EXISTS job_material_lines_job_item_uidx
  ON public.job_material_lines (job_id, catalog_item_id) WHERE catalog_item_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS job_material_lines_job_line_item_uidx
  ON public.job_material_lines (job_id, job_line_item_id) WHERE job_line_item_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS job_material_lines_job_estimate_item_uidx
  ON public.job_material_lines (job_id, estimate_line_item_id) WHERE estimate_line_item_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- job_material_line_events — append-only history (actor stamped by trigger)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_material_line_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id      uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  line_id     uuid NOT NULL,   -- no FK: the history outlives a removed line
  line_name   text NOT NULL,   -- snapshot, so removed lines still read well
  event_type  text NOT NULL CHECK (event_type IN (
                'created', 'qty_changed', 'item_changed', 'removed', 'sku_linked',
                'kit_refreshed', 'reserved', 'released', 'pulled', 'used', 'returned', 'override')),
  origin      text NOT NULL DEFAULT 'user' CHECK (origin IN ('user', 'generation', 'kit_refresh', 'system')),
  from_qty    numeric(12,3),
  to_qty      numeric(12,3),
  reason      text CHECK (reason IS NULL OR char_length(reason) <= 500),
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id    uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_material_line_events_job_idx
  ON public.job_material_line_events (job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_material_line_events_line_idx
  ON public.job_material_line_events (line_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_material_line_events_org_idx
  ON public.job_material_line_events (org_id);
CREATE INDEX IF NOT EXISTS job_material_line_events_actor_idx
  ON public.job_material_line_events (actor_id);

CREATE OR REPLACE FUNCTION public.fn_job_material_events_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.actor_id := auth.uid();
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_job_material_events_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- A job being deleted cascades its history away (the job row is already gone by the
  -- time the cascade reaches us); nothing else may delete or edit history.
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.jobs WHERE id = OLD.job_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'job_material_line_events is append-only (% is not allowed)', TG_OP
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_job_material_events_stamp ON public.job_material_line_events;
CREATE TRIGGER trg_job_material_events_stamp
  BEFORE INSERT ON public.job_material_line_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_job_material_events_stamp();

DROP TRIGGER IF EXISTS trg_job_material_events_guard ON public.job_material_line_events;
CREATE TRIGGER trg_job_material_events_guard
  BEFORE UPDATE OR DELETE ON public.job_material_line_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_job_material_events_guard();

-- ---------------------------------------------------------------------------
-- History trigger on job_material_lines. Reason/origin come from transaction-local
-- settings the RPCs set (loop.line_reason / loop.line_origin); a direct write
-- records the event with no reason and origin 'user'.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_job_material_lines_events()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_reason text := nullif(btrim(coalesce(current_setting('loop.line_reason', true), '')), '');
  v_origin text := coalesce(nullif(current_setting('loop.line_origin', true), ''), 'user');
BEGIN
  IF v_origin NOT IN ('user', 'generation', 'kit_refresh', 'system') THEN
    v_origin := 'user';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.plan_id IS NOT NULL THEN
      INSERT INTO public.job_material_line_events
        (org_id, job_id, line_id, line_name, event_type, origin, to_qty, reason, detail)
      VALUES
        (NEW.org_id, NEW.job_id, NEW.id, NEW.name, 'created', v_origin, NEW.quantity, v_reason,
         jsonb_build_object('source', NEW.source, 'needs_sku', NEW.catalog_item_id IS NULL));
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- A job being deleted cascades its lines away; its history goes with it.
    IF OLD.plan_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.jobs WHERE id = OLD.job_id) THEN
      INSERT INTO public.job_material_line_events
        (org_id, job_id, line_id, line_name, event_type, origin, from_qty, reason)
      VALUES
        (OLD.org_id, OLD.job_id, OLD.id, OLD.name, 'removed', v_origin, OLD.quantity, v_reason);
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF NEW.plan_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
    INSERT INTO public.job_material_line_events
      (org_id, job_id, line_id, line_name, event_type, origin, from_qty, to_qty, reason)
    VALUES
      (NEW.org_id, NEW.job_id, NEW.id, NEW.name, 'qty_changed', v_origin, OLD.quantity, NEW.quantity, v_reason);
  END IF;

  IF NEW.catalog_item_id IS DISTINCT FROM OLD.catalog_item_id THEN
    INSERT INTO public.job_material_line_events
      (org_id, job_id, line_id, line_name, event_type, origin, reason, detail)
    VALUES
      (NEW.org_id, NEW.job_id, NEW.id, NEW.name,
       CASE WHEN OLD.catalog_item_id IS NULL THEN 'sku_linked' ELSE 'item_changed' END,
       v_origin, v_reason,
       jsonb_build_object('from_item', OLD.catalog_item_id, 'to_item', NEW.catalog_item_id));
  ELSIF NEW.name IS DISTINCT FROM OLD.name OR NEW.unit IS DISTINCT FROM OLD.unit THEN
    INSERT INTO public.job_material_line_events
      (org_id, job_id, line_id, line_name, event_type, origin, reason, detail)
    VALUES
      (NEW.org_id, NEW.job_id, NEW.id, NEW.name, 'item_changed', v_origin, v_reason,
       jsonb_build_object('from_name', OLD.name, 'to_name', NEW.name, 'from_unit', OLD.unit, 'to_unit', NEW.unit));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_material_lines_events ON public.job_material_lines;
CREATE TRIGGER trg_job_material_lines_events
  AFTER INSERT OR UPDATE OR DELETE ON public.job_material_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_job_material_lines_events();

-- ---------------------------------------------------------------------------
-- Tech guard (extends 20261121000000): techs change only state and quantity.
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
     OR NEW.plan_id               IS DISTINCT FROM OLD.plan_id
     OR NEW.catalog_item_id       IS DISTINCT FROM OLD.catalog_item_id
     OR NEW.source                IS DISTINCT FROM OLD.source
     OR NEW.job_line_item_id      IS DISTINCT FROM OLD.job_line_item_id
     OR NEW.estimate_line_item_id IS DISTINCT FROM OLD.estimate_line_item_id
     OR NEW.kit_id                IS DISTINCT FROM OLD.kit_id
     OR NEW.kit_version           IS DISTINCT FROM OLD.kit_version
     OR NEW.kit_quantity          IS DISTINCT FROM OLD.kit_quantity
     OR NEW.is_optional           IS DISTINCT FROM OLD.is_optional
     OR NEW.non_stock_reason      IS DISTINCT FROM OLD.non_stock_reason
  THEN
    RAISE EXCEPTION 'Technicians can only change a material''s state and quantity'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.job_material_plans FROM anon, PUBLIC;
REVOKE ALL ON public.job_kits FROM anon, PUBLIC;
REVOKE ALL ON public.job_material_line_events FROM anon, PUBLIC;
REVOKE ALL ON public.catalog_item_aliases FROM anon, PUBLIC;

-- Default privileges on public may already grant ALL to authenticated, so narrow
-- explicitly. TRUNCATE ignores RLS and must never be reachable.
REVOKE ALL ON public.job_material_plans FROM authenticated;
REVOKE ALL ON public.job_kits FROM authenticated;
REVOKE ALL ON public.job_material_line_events FROM authenticated;
REVOKE ALL ON public.catalog_item_aliases FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.job_material_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_kits TO authenticated;
GRANT SELECT, INSERT ON public.job_material_line_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_item_aliases TO authenticated;
REVOKE TRUNCATE ON public.job_material_lines FROM authenticated;

ALTER TABLE public.job_material_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_material_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE public.job_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_kits FORCE ROW LEVEL SECURITY;
ALTER TABLE public.job_material_line_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_material_line_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_item_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_item_aliases FORCE ROW LEVEL SECURITY;

-- job_material_plans -------------------------------------------------------
DROP POLICY IF EXISTS "job_material_plans: read for office roles" ON public.job_material_plans;
CREATE POLICY "job_material_plans: read for office roles"
  ON public.job_material_plans FOR SELECT TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales')
         AND org_id = (select current_org_id()));

DROP POLICY IF EXISTS "job_material_plans: tech reads assigned jobs" ON public.job_material_plans;
CREATE POLICY "job_material_plans: tech reads assigned jobs"
  ON public.job_material_plans FOR SELECT TO authenticated
  USING ((select current_app_role()) = 'tech'
         AND org_id = (select current_org_id())
         AND private.caller_is_assigned_to_job(job_id));

DROP POLICY IF EXISTS "job_material_plans: insert for office roles" ON public.job_material_plans;
CREATE POLICY "job_material_plans: insert for office roles"
  ON public.job_material_plans FOR INSERT TO authenticated
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales')
              AND org_id = (select current_org_id())
              AND EXISTS (SELECT 1 FROM public.jobs AS j
                          WHERE j.id = job_material_plans.job_id
                            AND j.org_id = (select current_org_id())));

DROP POLICY IF EXISTS "job_material_plans: confirm for owner/manager/dispatch/office" ON public.job_material_plans;
CREATE POLICY "job_material_plans: confirm for owner/manager/dispatch/office"
  ON public.job_material_plans FOR UPDATE TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
         AND org_id = (select current_org_id()))
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
              AND org_id = (select current_org_id()));

-- job_kits -----------------------------------------------------------------
DROP POLICY IF EXISTS "job_kits: read for office roles" ON public.job_kits;
CREATE POLICY "job_kits: read for office roles"
  ON public.job_kits FOR SELECT TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales')
         AND org_id = (select current_org_id()));

DROP POLICY IF EXISTS "job_kits: tech reads assigned jobs" ON public.job_kits;
CREATE POLICY "job_kits: tech reads assigned jobs"
  ON public.job_kits FOR SELECT TO authenticated
  USING ((select current_app_role()) = 'tech'
         AND org_id = (select current_org_id())
         AND private.caller_is_assigned_to_job(job_id));

DROP POLICY IF EXISTS "job_kits: insert for office roles" ON public.job_kits;
CREATE POLICY "job_kits: insert for office roles"
  ON public.job_kits FOR INSERT TO authenticated
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales')
              AND org_id = (select current_org_id())
              AND EXISTS (SELECT 1 FROM public.jobs AS j
                          WHERE j.id = job_kits.job_id
                            AND j.org_id = (select current_org_id())));

DROP POLICY IF EXISTS "job_kits: update for office roles" ON public.job_kits;
CREATE POLICY "job_kits: update for office roles"
  ON public.job_kits FOR UPDATE TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales')
         AND org_id = (select current_org_id()))
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales')
              AND org_id = (select current_org_id()));

DROP POLICY IF EXISTS "job_kits: delete for office roles" ON public.job_kits;
CREATE POLICY "job_kits: delete for office roles"
  ON public.job_kits FOR DELETE TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales')
         AND org_id = (select current_org_id()));

-- job_material_line_events (append-only: no UPDATE/DELETE policy or privilege) -
DROP POLICY IF EXISTS "job_material_line_events: read for office roles" ON public.job_material_line_events;
CREATE POLICY "job_material_line_events: read for office roles"
  ON public.job_material_line_events FOR SELECT TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales')
         AND org_id = (select current_org_id()));

DROP POLICY IF EXISTS "job_material_line_events: tech reads assigned jobs" ON public.job_material_line_events;
CREATE POLICY "job_material_line_events: tech reads assigned jobs"
  ON public.job_material_line_events FOR SELECT TO authenticated
  USING ((select current_app_role()) = 'tech'
         AND org_id = (select current_org_id())
         AND private.caller_is_assigned_to_job(job_id));

DROP POLICY IF EXISTS "job_material_line_events: insert for office roles" ON public.job_material_line_events;
CREATE POLICY "job_material_line_events: insert for office roles"
  ON public.job_material_line_events FOR INSERT TO authenticated
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales')
              AND org_id = (select current_org_id())
              AND EXISTS (SELECT 1 FROM public.jobs AS j
                          WHERE j.id = job_material_line_events.job_id
                            AND j.org_id = (select current_org_id())));

DROP POLICY IF EXISTS "job_material_line_events: tech quantity events on assigned jobs" ON public.job_material_line_events;
CREATE POLICY "job_material_line_events: tech quantity events on assigned jobs"
  ON public.job_material_line_events FOR INSERT TO authenticated
  WITH CHECK ((select current_app_role()) = 'tech'
              AND org_id = (select current_org_id())
              AND event_type = 'qty_changed'
              AND private.caller_is_assigned_to_job(job_id));

-- catalog_item_aliases -----------------------------------------------------
DROP POLICY IF EXISTS "catalog_item_aliases: read for office roles" ON public.catalog_item_aliases;
CREATE POLICY "catalog_item_aliases: read for office roles"
  ON public.catalog_item_aliases FOR SELECT TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales')
         AND org_id = (select current_org_id()));

DROP POLICY IF EXISTS "catalog_item_aliases: insert for owner/manager/office" ON public.catalog_item_aliases;
CREATE POLICY "catalog_item_aliases: insert for owner/manager/office"
  ON public.catalog_item_aliases FOR INSERT TO authenticated
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'office')
              AND org_id = (select current_org_id()));

DROP POLICY IF EXISTS "catalog_item_aliases: update for owner/manager/office" ON public.catalog_item_aliases;
CREATE POLICY "catalog_item_aliases: update for owner/manager/office"
  ON public.catalog_item_aliases FOR UPDATE TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'office')
         AND org_id = (select current_org_id()))
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'office')
              AND org_id = (select current_org_id()));

DROP POLICY IF EXISTS "catalog_item_aliases: delete for owner/manager/office" ON public.catalog_item_aliases;
CREATE POLICY "catalog_item_aliases: delete for owner/manager/office"
  ON public.catalog_item_aliases FOR DELETE TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'office')
         AND org_id = (select current_org_id()));

-- ---------------------------------------------------------------------------
-- RPCs — SECURITY INVOKER (RLS applies as the caller), atomic per call.
-- ---------------------------------------------------------------------------

-- generate_material_plan: persist an already-merged candidate list (matching and
-- the D7 merge happen in the app, where they are unit-tested). Idempotent:
-- candidates whose catalog item, job line item or estimate line item already has
-- a line on this job are skipped. Returns {plan_id, added, skipped}.
--   p_lines: [{name, quantity, unit, catalog_item_id?, part_number?, source,
--              job_line_item_id?, estimate_line_item_id?, kit_id?, kit_version?,
--              kit_quantity?, is_optional?}]
--   p_kits : [{kit_id, kit_version, multiplier}]
CREATE OR REPLACE FUNCTION public.generate_material_plan(
  p_job_id         uuid,
  p_generated_from text,
  p_lines          jsonb DEFAULT '[]'::jsonb,
  p_kits           jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org     uuid;
  v_plan    uuid;
  v_status  text;
  v_from    text;
  v_line    jsonb;
  v_kit     jsonb;
  v_added   integer := 0;
  v_skipped integer := 0;
  v_sort    integer;
BEGIN
  IF p_generated_from NOT IN ('estimate', 'kit', 'manual', 'mixed') THEN
    RAISE EXCEPTION 'invalid generated_from %', p_generated_from USING ERRCODE = 'check_violation';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN p_lines := '[]'::jsonb; END IF;
  IF p_kits IS NULL OR jsonb_typeof(p_kits) <> 'array' THEN p_kits := '[]'::jsonb; END IF;
  IF jsonb_array_length(p_lines) > 500 THEN
    RAISE EXCEPTION 'too many lines in one plan generation' USING ERRCODE = 'check_violation';
  END IF;

  SELECT org_id INTO v_org FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job % not found', p_job_id USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('loop.line_origin', 'generation', true);
  PERFORM set_config('loop.line_reason', '', true);

  SELECT id, generated_from INTO v_plan, v_from
  FROM public.job_material_plans WHERE job_id = p_job_id;

  IF v_plan IS NULL THEN
    INSERT INTO public.job_material_plans (org_id, job_id, generated_from)
    VALUES (v_org, p_job_id, p_generated_from)
    RETURNING id INTO v_plan;
  ELSIF v_from <> p_generated_from THEN
    UPDATE public.job_material_plans SET generated_from = 'mixed' WHERE id = v_plan;
  END IF;

  FOR v_kit IN SELECT * FROM jsonb_array_elements(p_kits) LOOP
    INSERT INTO public.job_kits (org_id, job_id, kit_id, kit_version, multiplier)
    VALUES (v_org, p_job_id, (v_kit->>'kit_id')::uuid,
            (v_kit->>'kit_version')::integer,
            coalesce((v_kit->>'multiplier')::numeric, 1))
    ON CONFLICT (job_id, kit_id) DO UPDATE
      SET kit_version = EXCLUDED.kit_version, multiplier = EXCLUDED.multiplier;
  END LOOP;

  SELECT coalesce(max(sort_order), 0) INTO v_sort
  FROM public.job_material_lines WHERE job_id = p_job_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    IF (v_line->>'catalog_item_id') IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.job_material_lines
         WHERE job_id = p_job_id AND catalog_item_id = (v_line->>'catalog_item_id')::uuid)
       OR (v_line->>'job_line_item_id') IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.job_material_lines
         WHERE job_id = p_job_id AND job_line_item_id = (v_line->>'job_line_item_id')::uuid)
       OR (v_line->>'estimate_line_item_id') IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.job_material_lines
         WHERE job_id = p_job_id AND estimate_line_item_id = (v_line->>'estimate_line_item_id')::uuid)
    THEN
      -- The item is already on the plan. A kit that asks for it still gets remembered
      -- (D7: the existing quantity wins, the kit's is kept in kit_quantity).
      IF (v_line->>'kit_id') IS NOT NULL AND (v_line->>'catalog_item_id') IS NOT NULL THEN
        UPDATE public.job_material_lines
        SET kit_id = coalesce(kit_id, (v_line->>'kit_id')::uuid),
            kit_version = coalesce(kit_version, nullif(v_line->>'kit_version', '')::integer),
            kit_quantity = coalesce(kit_quantity, nullif(v_line->>'kit_quantity', '')::numeric)
        WHERE job_id = p_job_id AND catalog_item_id = (v_line->>'catalog_item_id')::uuid;
      END IF;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_sort := v_sort + 10;
    INSERT INTO public.job_material_lines (
      org_id, job_id, plan_id, name, quantity, unit, part_number, source, catalog_item_id,
      job_line_item_id, estimate_line_item_id, kit_id, kit_version, kit_quantity,
      is_optional, sort_order
    ) VALUES (
      v_org, p_job_id, v_plan,
      v_line->>'name',
      (v_line->>'quantity')::numeric,
      coalesce(nullif(v_line->>'unit', ''), 'ea'),
      nullif(v_line->>'part_number', ''),
      coalesce(v_line->>'source', 'manual'),
      nullif(v_line->>'catalog_item_id', '')::uuid,
      nullif(v_line->>'job_line_item_id', '')::uuid,
      nullif(v_line->>'estimate_line_item_id', '')::uuid,
      nullif(v_line->>'kit_id', '')::uuid,
      nullif(v_line->>'kit_version', '')::integer,
      nullif(v_line->>'kit_quantity', '')::numeric,
      coalesce((v_line->>'is_optional')::boolean, false),
      v_sort
    );
    v_added := v_added + 1;
  END LOOP;

  RETURN jsonb_build_object('plan_id', v_plan, 'added', v_added, 'skipped', v_skipped);
END;
$$;

-- refresh_job_kit: bring a job up to the kit's current lines. Never overwrites a
-- line someone adjusted (a user qty/item event); untouched lines follow the kit;
-- lines the kit gained are added. p_lines are the kit's CURRENT lines already
-- multiplied: [{catalog_item_id, name, unit, quantity, is_optional}].
-- Returns {added, updated, skipped}.
CREATE OR REPLACE FUNCTION public.refresh_job_kit(
  p_job_id      uuid,
  p_kit_id      uuid,
  p_kit_version integer,
  p_multiplier  numeric,
  p_lines       jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org     uuid;
  v_plan    uuid;
  v_line    jsonb;
  v_existing public.job_material_lines%ROWTYPE;
  v_item    uuid;
  v_qty     numeric;
  v_added   integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_sort    integer;
  v_touched boolean;
BEGIN
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN p_lines := '[]'::jsonb; END IF;

  SELECT org_id INTO v_org FROM public.job_kits WHERE job_id = p_job_id AND kit_id = p_kit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'kit % is not attached to job %', p_kit_id, p_job_id USING ERRCODE = 'P0002';
  END IF;
  SELECT id INTO v_plan FROM public.job_material_plans WHERE job_id = p_job_id;
  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'job % has no material plan', p_job_id USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('loop.line_origin', 'kit_refresh', true);
  PERFORM set_config('loop.line_reason', 'Kit refreshed', true);

  SELECT coalesce(max(sort_order), 0) INTO v_sort
  FROM public.job_material_lines WHERE job_id = p_job_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_item := (v_line->>'catalog_item_id')::uuid;
    v_qty  := (v_line->>'quantity')::numeric;

    SELECT * INTO v_existing FROM public.job_material_lines
    WHERE job_id = p_job_id AND catalog_item_id = v_item;

    IF NOT FOUND THEN
      v_sort := v_sort + 10;
      INSERT INTO public.job_material_lines (
        org_id, job_id, plan_id, name, quantity, unit, source, catalog_item_id,
        kit_id, kit_version, kit_quantity, is_optional, sort_order
      ) VALUES (
        v_org, p_job_id, v_plan, v_line->>'name', v_qty,
        coalesce(nullif(v_line->>'unit', ''), 'ea'), 'kit', v_item,
        p_kit_id, p_kit_version, v_qty,
        coalesce((v_line->>'is_optional')::boolean, false), v_sort);
      v_added := v_added + 1;
      CONTINUE;
    END IF;

    -- A line another source owns (estimate qty wins, D7) only learns the kit quantity.
    IF v_existing.source <> 'kit' OR v_existing.kit_id IS DISTINCT FROM p_kit_id THEN
      UPDATE public.job_material_lines
      SET kit_quantity = v_qty, kit_version = p_kit_version,
          kit_id = coalesce(kit_id, p_kit_id)
      WHERE id = v_existing.id;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.job_material_line_events e
      WHERE e.line_id = v_existing.id AND e.origin = 'user'
        AND e.event_type IN ('qty_changed', 'item_changed')
    ) INTO v_touched;

    IF v_touched THEN
      UPDATE public.job_material_lines
      SET kit_quantity = v_qty, kit_version = p_kit_version
      WHERE id = v_existing.id;
      v_skipped := v_skipped + 1;
    ELSE
      UPDATE public.job_material_lines
      SET quantity = v_qty, kit_quantity = v_qty, kit_version = p_kit_version
      WHERE id = v_existing.id;
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  UPDATE public.job_kits
  SET kit_version = p_kit_version, multiplier = p_multiplier
  WHERE job_id = p_job_id AND kit_id = p_kit_id;

  RETURN jsonb_build_object('added', v_added, 'updated', v_updated, 'skipped', v_skipped);
END;
$$;

-- adjust_material_line: patch quantity / name / unit / notes / is_optional /
-- non_stock_reason on one line, recording p_reason on the history events the
-- line trigger writes. Unknown keys are rejected. Returns the line id.
CREATE OR REPLACE FUNCTION public.adjust_material_line(
  p_line_id uuid,
  p_patch   jsonb,
  p_reason  text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_allowed constant text[] :=
    ARRAY['quantity', 'name', 'unit', 'notes', 'is_optional', 'non_stock_reason'];
BEGIN
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'patch must be a JSON object' USING ERRCODE = 'check_violation';
  END IF;
  FOR v_key IN SELECT jsonb_object_keys(p_patch) LOOP
    IF NOT (v_key = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'field "%" cannot be adjusted here', v_key USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  PERFORM set_config('loop.line_origin', 'user', true);
  PERFORM set_config('loop.line_reason', coalesce(p_reason, ''), true);

  UPDATE public.job_material_lines SET
    quantity         = CASE WHEN p_patch ? 'quantity' THEN (p_patch->>'quantity')::numeric ELSE quantity END,
    name             = CASE WHEN p_patch ? 'name' THEN p_patch->>'name' ELSE name END,
    unit             = CASE WHEN p_patch ? 'unit' THEN p_patch->>'unit' ELSE unit END,
    notes            = CASE WHEN p_patch ? 'notes' THEN coalesce(p_patch->>'notes', '') ELSE notes END,
    is_optional      = CASE WHEN p_patch ? 'is_optional' THEN (p_patch->>'is_optional')::boolean ELSE is_optional END,
    non_stock_reason = CASE WHEN p_patch ? 'non_stock_reason' THEN nullif(btrim(p_patch->>'non_stock_reason'), '') ELSE non_stock_reason END
  WHERE id = p_line_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'material line % not found', p_line_id USING ERRCODE = 'P0002';
  END IF;
  RETURN p_line_id;
END;
$$;

-- link_material_line_sku: resolve a needs-SKU line to a catalog item and remember
-- the original text as an alias so the next estimate matches automatically.
CREATE OR REPLACE FUNCTION public.link_material_line_sku(
  p_line_id         uuid,
  p_catalog_item_id uuid,
  p_write_alias     boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_line  public.job_material_lines%ROWTYPE;
  v_item  public.catalog_items%ROWTYPE;
  v_alias text;
BEGIN
  SELECT * INTO v_line FROM public.job_material_lines WHERE id = p_line_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'material line % not found', p_line_id USING ERRCODE = 'P0002';
  END IF;
  IF v_line.catalog_item_id IS NOT NULL THEN
    RAISE EXCEPTION 'this line is already linked to a catalog item' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_item FROM public.catalog_items
  WHERE id = p_catalog_item_id AND org_id = v_line.org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog item % not found', p_catalog_item_id USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NOT v_item.is_stockable OR NOT v_item.is_active THEN
    RAISE EXCEPTION '"%" must be an active stocked item to be pulled for a job', v_item.name
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.job_material_lines
             WHERE job_id = v_line.job_id AND catalog_item_id = p_catalog_item_id) THEN
    RAISE EXCEPTION '"%" is already on this job''s plan; remove or merge the duplicate line', v_item.name
      USING ERRCODE = 'unique_violation';
  END IF;

  PERFORM set_config('loop.line_origin', 'user', true);
  PERFORM set_config('loop.line_reason', '', true);

  UPDATE public.job_material_lines
  SET catalog_item_id = p_catalog_item_id, non_stock_reason = NULL
  WHERE id = p_line_id;

  IF p_write_alias THEN
    v_alias := regexp_replace(lower(btrim(v_line.name)), '\s+', ' ', 'g');
    IF char_length(v_alias) BETWEEN 1 AND 200 AND lower(btrim(v_item.name)) <> v_alias THEN
      INSERT INTO public.catalog_item_aliases (org_id, catalog_item_id, alias)
      VALUES (v_line.org_id, p_catalog_item_id, v_alias)
      ON CONFLICT (org_id, alias) DO UPDATE SET catalog_item_id = EXCLUDED.catalog_item_id;
    END IF;
  END IF;

  RETURN p_line_id;
END;
$$;

-- remove_material_line: delete a line, recording the reason on the history event.
CREATE OR REPLACE FUNCTION public.remove_material_line(
  p_line_id uuid,
  p_reason  text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('loop.line_origin', 'user', true);
  PERFORM set_config('loop.line_reason', coalesce(p_reason, ''), true);

  DELETE FROM public.job_material_lines WHERE id = p_line_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'material line % not found', p_line_id USING ERRCODE = 'P0002';
  END IF;
  RETURN p_line_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: trigger functions are not RPCs; RPCs are authenticated-only.
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.fn_job_material_plans_stamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_job_kits_stamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_catalog_item_aliases_stamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_job_material_events_stamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_job_material_events_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_job_material_lines_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_tech_job_material_update() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.generate_material_plan(uuid, text, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refresh_job_kit(uuid, uuid, integer, numeric, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adjust_material_line(uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.link_material_line_sku(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_material_line(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_material_plan(uuid, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_job_kit(uuid, uuid, integer, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_material_line(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_material_line_sku(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_material_line(uuid, text) TO authenticated;
