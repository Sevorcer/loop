-- Dispatch plans for jobs that never got one (2026-11-02)
--
-- The dispatch board reads dispatch_plans, but plans were only ever created
-- by the app (ensureDispatchPlanForJob in src/services/jobs.ts, on job
-- create/update). Jobs inserted straight into the table — above all the
-- ~3,000 jobs the Service Fusion importer wrote through
-- sf_import_apply_batch — have no plan, so the board showed almost nothing
-- even though the jobs exist.
--
-- This migration:
--   1. Adds private.dispatch_plan_seed_for_job(jobs), the one place that
--      derives a plan's fields from a job, mirroring ensureDispatchPlanForJob:
--        target_date       = the job's start day in America/Los_Angeles
--                            (the company zone src/lib/timezone.ts defaults
--                            to, and the day the dedupe migration
--                            20261030180000 already kept plans on), else
--                            scheduled_for; no date, no plan — the app
--                            returns early the same way;
--        estimated hours   = the scheduled window, rounded to 0.1h, else 4;
--        dispatch_status   = Completed → completed, In Progress →
--                            in_progress, otherwise scheduled;
--        dispatchability   = the app's default shape, crew satisfied when
--                            the job carries an assignee label;
--        priority          = High → high, Low → low, otherwise normal.
--      Cancelled jobs get no plan: the app maps them to a 'cancelled'
--      dispatch status that the dispatch_plans status CHECK does not
--      allow, so its plan insert already fails silently today; On Hold
--      ('on_hold') is in the same position, so both are skipped here.
--   2. Backfills one plan for every existing job the seed covers that has
--      none. Re-runnable: the unique index dispatch_plans_one_per_job_uidx
--      on (org_id, job_id) plus ON CONFLICT DO NOTHING makes a second run
--      a no-op.
--   3. Adds an AFTER INSERT trigger on jobs so future direct-SQL writes
--      (re-imports, scripts) get the same plan the app would have made.
--      App-created jobs are unaffected in outcome: the plan exists by the
--      time ensureDispatchPlanForJob looks, and it keeps and refreshes
--      that plan. Plan placement on later job edits stays with the app.
--
-- DOWN
--   Backfilled rows are data, not schema; rolling back leaves them (they
--   are the plans the board needs). Schema rollback only:
--   DROP TRIGGER IF EXISTS seed_dispatch_plan_for_job ON public.jobs;
--   DROP FUNCTION IF EXISTS private.seed_dispatch_plan_for_job();
--   DROP FUNCTION IF EXISTS private.dispatch_plan_seed_for_job(public.jobs);

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.dispatch_plan_seed_for_job(job public.jobs)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $seed$
  SELECT CASE
    WHEN job.status IN ('Cancelled', 'On Hold') THEN NULL
    WHEN COALESCE(
           (job.scheduled_start_at AT TIME ZONE 'America/Los_Angeles')::date,
           job.scheduled_for
         ) IS NULL THEN NULL
    ELSE jsonb_build_object(
      'target_date', COALESCE(
        (job.scheduled_start_at AT TIME ZONE 'America/Los_Angeles')::date,
        job.scheduled_for
      ),
      'estimated_duration_hours', CASE
        WHEN job.scheduled_start_at IS NOT NULL
         AND job.scheduled_end_at IS NOT NULL
         AND job.scheduled_end_at > job.scheduled_start_at
        THEN round(
          (EXTRACT(EPOCH FROM (job.scheduled_end_at - job.scheduled_start_at)) / 3600.0)::numeric,
          1
        )
        ELSE 4
      END,
      'dispatch_status', CASE job.status
        WHEN 'Completed' THEN 'completed'
        WHEN 'In Progress' THEN 'in_progress'
        ELSE 'scheduled'
      END,
      'dispatchability', jsonb_build_object(
        'isDispatchable', true,
        'materialReadiness', jsonb_build_object('state', 'not_satisfied', 'reason', ''),
        'technicalReadiness', jsonb_build_object('state', 'not_satisfied', 'reason', ''),
        'customerReadiness', jsonb_build_object('state', 'not_satisfied', 'reason', ''),
        'crewReadiness', jsonb_build_object(
          'state', CASE WHEN btrim(COALESCE(job.assigned_to, '')) <> '' THEN 'satisfied' ELSE 'not_satisfied' END,
          'reason', ''
        )
      ),
      'priority', CASE job.priority
        WHEN 'High' THEN 'high'
        WHEN 'Low' THEN 'low'
        ELSE 'normal'
      END
    )
  END;
$seed$;

REVOKE ALL ON FUNCTION private.dispatch_plan_seed_for_job(public.jobs) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.dispatch_plan_seed_for_job(public.jobs) FROM anon;
GRANT EXECUTE ON FUNCTION private.dispatch_plan_seed_for_job(public.jobs) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Backfill: one plan for every seeded job that has none
-- ---------------------------------------------------------------------------

INSERT INTO public.dispatch_plans (
  org_id, job_id, job_number, customer_name, property_name, job_type,
  dispatch_status, dispatchability, target_date, estimated_duration_hours,
  priority, constraints
)
SELECT
  j.org_id,
  j.id,
  j.job_number,
  j.customer_name,
  j.property_name,
  j.type,
  seed.seed ->> 'dispatch_status',
  seed.seed -> 'dispatchability',
  (seed.seed ->> 'target_date')::date,
  (seed.seed ->> 'estimated_duration_hours')::numeric,
  seed.seed ->> 'priority',
  '[]'::jsonb
FROM public.jobs j
CROSS JOIN LATERAL (
  SELECT private.dispatch_plan_seed_for_job(j) AS seed
) seed
WHERE seed.seed IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.dispatch_plans dp
    WHERE dp.org_id = j.org_id
      AND dp.job_id = j.id
  )
ON CONFLICT (org_id, job_id) WHERE job_id IS NOT NULL DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed a plan whenever a job row is inserted directly
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.seed_dispatch_plan_for_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $seed_trigger$
DECLARE
  seed jsonb := private.dispatch_plan_seed_for_job(NEW);
BEGIN
  IF seed IS NOT NULL THEN
    INSERT INTO public.dispatch_plans (
      org_id, job_id, job_number, customer_name, property_name, job_type,
      dispatch_status, dispatchability, target_date, estimated_duration_hours,
      priority, constraints
    ) VALUES (
      NEW.org_id,
      NEW.id,
      NEW.job_number,
      NEW.customer_name,
      NEW.property_name,
      NEW.type,
      seed ->> 'dispatch_status',
      seed -> 'dispatchability',
      (seed ->> 'target_date')::date,
      (seed ->> 'estimated_duration_hours')::numeric,
      seed ->> 'priority',
      '[]'::jsonb
    )
    ON CONFLICT (org_id, job_id) WHERE job_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$seed_trigger$;

REVOKE ALL ON FUNCTION private.seed_dispatch_plan_for_job() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.seed_dispatch_plan_for_job() FROM anon;
GRANT EXECUTE ON FUNCTION private.seed_dispatch_plan_for_job() TO authenticated, service_role;

DROP TRIGGER IF EXISTS seed_dispatch_plan_for_job ON public.jobs;
CREATE TRIGGER seed_dispatch_plan_for_job
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION private.seed_dispatch_plan_for_job();
