-- =============================================================================
-- Migration — Material metrics capture (Inventory Lane 4, PR C, M5)
-- Plan: docs/briefs/inventory-lane4-plan-2026-11-05.md §2.10, §3.8
--
-- UP (expand-only; capture only — there are no reporting screens in Lane 4):
--   - job_readiness_snapshots   append-only: the job's readiness each time it changes,
--                               so "kit completeness at dispatch" can be read later
--   - job_material_events       append-only: missing / wrong part, substitution,
--                               unplanned use, supply-house run, kit feedback
--   Both are append-only (UPDATE and DELETE are refused; a deleted job takes its
--   rows with it). No costs are stored.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP TABLE IF EXISTS public.job_material_events;
--   DROP TABLE IF EXISTS public.job_readiness_snapshots;
--   DROP FUNCTION IF EXISTS public.fn_material_metrics_guard();
--   DROP FUNCTION IF EXISTS public.fn_job_readiness_snapshots_stamp();
--   DROP FUNCTION IF EXISTS public.fn_job_material_events_metrics_stamp();
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.job_readiness_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id          uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  taken_at        timestamptz NOT NULL DEFAULT now(),
  taken_by        uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  trigger         text NOT NULL CHECK (trigger IN ('plan_confirmed', 'state_changed', 'dispatched')),
  scheduled_date  date,
  rollup_state    text NOT NULL CHECK (rollup_state IN ('ok', 'arriving_in_time', 'short', 'at_risk')),
  lines_total     integer NOT NULL DEFAULT 0 CHECK (lines_total >= 0),
  lines_ok        integer NOT NULL DEFAULT 0 CHECK (lines_ok >= 0),
  lines_arriving  integer NOT NULL DEFAULT 0 CHECK (lines_arriving >= 0),
  lines_short     integer NOT NULL DEFAULT 0 CHECK (lines_short >= 0),
  lines_at_risk   integer NOT NULL DEFAULT 0 CHECK (lines_at_risk >= 0),
  lines_needs_sku integer NOT NULL DEFAULT 0 CHECK (lines_needs_sku >= 0),
  detail          jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS job_readiness_snapshots_job_idx
  ON public.job_readiness_snapshots (job_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS job_readiness_snapshots_org_idx
  ON public.job_readiness_snapshots (org_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS job_readiness_snapshots_taken_by_idx
  ON public.job_readiness_snapshots (taken_by);

CREATE TABLE IF NOT EXISTS public.job_material_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id      uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  line_id     uuid,   -- no FK: the record outlives a removed line
  item_id     uuid,
  event_type  text NOT NULL CHECK (event_type IN (
                'missing_part', 'wrong_part', 'substitution', 'unplanned_use',
                'supply_house_run', 'kit_feedback')),
  qty         numeric(12, 3),
  note        text CHECK (note IS NULL OR char_length(note) <= 1000),
  created_by  uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_material_events_item_same_org_fkey
    FOREIGN KEY (item_id, org_id) REFERENCES public.catalog_items (id, org_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS job_material_events_job_idx
  ON public.job_material_events (job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_material_events_type_idx
  ON public.job_material_events (org_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS job_material_events_item_idx
  ON public.job_material_events (item_id) WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS job_material_events_created_by_idx
  ON public.job_material_events (created_by);

-- Stamps: who and when come from the session, never the request body.
CREATE OR REPLACE FUNCTION public.fn_job_readiness_snapshots_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.taken_by := auth.uid();
  NEW.taken_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_job_material_events_metrics_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.created_by := auth.uid();
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

-- Append-only. A job being deleted cascades its rows away (the job row is already
-- gone by then); nothing else may edit or delete them.
CREATE OR REPLACE FUNCTION public.fn_material_metrics_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.jobs WHERE id = OLD.job_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% is append-only (% is not allowed)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_job_readiness_snapshots_stamp ON public.job_readiness_snapshots;
CREATE TRIGGER trg_job_readiness_snapshots_stamp
  BEFORE INSERT ON public.job_readiness_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.fn_job_readiness_snapshots_stamp();
DROP TRIGGER IF EXISTS trg_job_readiness_snapshots_guard ON public.job_readiness_snapshots;
CREATE TRIGGER trg_job_readiness_snapshots_guard
  BEFORE UPDATE OR DELETE ON public.job_readiness_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.fn_material_metrics_guard();

DROP TRIGGER IF EXISTS trg_job_material_events_metrics_stamp ON public.job_material_events;
CREATE TRIGGER trg_job_material_events_metrics_stamp
  BEFORE INSERT ON public.job_material_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_job_material_events_metrics_stamp();
DROP TRIGGER IF EXISTS trg_job_material_events_metrics_guard ON public.job_material_events;
CREATE TRIGGER trg_job_material_events_metrics_guard
  BEFORE UPDATE OR DELETE ON public.job_material_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_material_metrics_guard();

-- RLS ------------------------------------------------------------------------

REVOKE ALL ON public.job_readiness_snapshots FROM anon;
REVOKE ALL ON public.job_readiness_snapshots FROM authenticated;
REVOKE ALL ON public.job_material_events FROM anon;
REVOKE ALL ON public.job_material_events FROM authenticated;
GRANT SELECT, INSERT ON public.job_readiness_snapshots TO authenticated;
GRANT SELECT, INSERT ON public.job_material_events TO authenticated;

ALTER TABLE public.job_readiness_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_readiness_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.job_material_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_material_events FORCE ROW LEVEL SECURITY;

-- job_readiness_snapshots: office roles read and write; an assigned tech may write only
-- the 'dispatched' row (starting the job is what closes the kit-completeness window).
DROP POLICY IF EXISTS "job_readiness_snapshots: read for office roles" ON public.job_readiness_snapshots;
CREATE POLICY "job_readiness_snapshots: read for office roles"
  ON public.job_readiness_snapshots FOR SELECT TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
         AND org_id = (select current_org_id()));

DROP POLICY IF EXISTS "job_readiness_snapshots: insert for office roles" ON public.job_readiness_snapshots;
CREATE POLICY "job_readiness_snapshots: insert for office roles"
  ON public.job_readiness_snapshots FOR INSERT TO authenticated
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
              AND org_id = (select current_org_id())
              AND EXISTS (SELECT 1 FROM public.jobs AS j
                          WHERE j.id = job_readiness_snapshots.job_id
                            AND j.org_id = (select current_org_id())));

DROP POLICY IF EXISTS "job_readiness_snapshots: tech dispatched row on assigned jobs" ON public.job_readiness_snapshots;
CREATE POLICY "job_readiness_snapshots: tech dispatched row on assigned jobs"
  ON public.job_readiness_snapshots FOR INSERT TO authenticated
  WITH CHECK ((select current_app_role()) = 'tech'
              AND org_id = (select current_org_id())
              AND trigger = 'dispatched'
              AND private.caller_is_assigned_to_job(job_id));

-- job_material_events
DROP POLICY IF EXISTS "job_material_events: read for office roles" ON public.job_material_events;
CREATE POLICY "job_material_events: read for office roles"
  ON public.job_material_events FOR SELECT TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
         AND org_id = (select current_org_id()));

DROP POLICY IF EXISTS "job_material_events: tech reads assigned jobs" ON public.job_material_events;
CREATE POLICY "job_material_events: tech reads assigned jobs"
  ON public.job_material_events FOR SELECT TO authenticated
  USING ((select current_app_role()) = 'tech'
         AND org_id = (select current_org_id())
         AND private.caller_is_assigned_to_job(job_id));

DROP POLICY IF EXISTS "job_material_events: insert for office roles" ON public.job_material_events;
CREATE POLICY "job_material_events: insert for office roles"
  ON public.job_material_events FOR INSERT TO authenticated
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
              AND org_id = (select current_org_id())
              AND EXISTS (SELECT 1 FROM public.jobs AS j
                          WHERE j.id = job_material_events.job_id
                            AND j.org_id = (select current_org_id())));

DROP POLICY IF EXISTS "job_material_events: tech insert on assigned jobs" ON public.job_material_events;
CREATE POLICY "job_material_events: tech insert on assigned jobs"
  ON public.job_material_events FOR INSERT TO authenticated
  WITH CHECK ((select current_app_role()) = 'tech'
              AND org_id = (select current_org_id())
              AND private.caller_is_assigned_to_job(job_id));

REVOKE EXECUTE ON FUNCTION public.fn_job_readiness_snapshots_stamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_job_material_events_metrics_stamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_material_metrics_guard() FROM PUBLIC, anon, authenticated;
