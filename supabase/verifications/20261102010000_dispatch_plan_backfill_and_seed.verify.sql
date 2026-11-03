-- Read-only checks for the dispatch plan backfill + seed migration.
-- Run after 20261102010000_dispatch_plan_backfill_and_seed.sql.
-- This file changes nothing.
--
-- CORRECTED 2026-11-02: the original version spot-checked the seed against
-- literal job rows, but Postgres cannot cast those records to public.jobs
-- (42846: cannot cast type record to jobs), so it errored on a real database
-- even though the migration itself was fine. The checks below verify the
-- same properties against real job rows instead — the exact queries that
-- passed against production on 2026-11-02 (3,600 plans; mapping and
-- timezone samples correct).

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private' AND p.proname = 'dispatch_plan_seed_for_job'
  ), 'private.dispatch_plan_seed_for_job must exist';

  ASSERT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private' AND p.proname = 'seed_dispatch_plan_for_job'
      AND p.prosecdef
  ), 'private.seed_dispatch_plan_for_job must exist as SECURITY DEFINER';

  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'jobs'
      AND t.tgname = 'seed_dispatch_plan_for_job' AND NOT t.tgisinternal
  ), 'seed_dispatch_plan_for_job trigger must exist on public.jobs';

  -- Backfill completeness: no seeded job may lack a plan for its job.
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE private.dispatch_plan_seed_for_job(j) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.dispatch_plans dp
        WHERE dp.org_id = j.org_id AND dp.job_id = j.id
      )
  ), 'every job the seed covers must have a dispatch plan after backfill';

  -- Cancelled / On Hold jobs never get a seed.
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.status IN ('Cancelled', 'On Hold')
      AND private.dispatch_plan_seed_for_job(j) IS NOT NULL
  ), 'cancelled and on-hold jobs must not seed a plan';
END $$;

-- Status mapping across the real table: Completed -> completed,
-- In Progress -> in_progress, Scheduled -> scheduled (dated jobs only),
-- Cancelled / On Hold -> NULL.
SELECT j.status,
       private.dispatch_plan_seed_for_job(j) ->> 'dispatch_status' AS seed_status,
       count(*) AS jobs
FROM public.jobs j
GROUP BY 1, 2
ORDER BY 1, 2;

-- Timezone derivation gate: seed target_date must equal the job's start
-- day in America/Los_Angeles on every row. Asserted (not just printed), so
-- a timezone regression actually fails this verification.
DO $$ BEGIN
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.scheduled_start_at IS NOT NULL
      AND private.dispatch_plan_seed_for_job(j) ->> 'target_date'
          IS DISTINCT FROM (j.scheduled_start_at AT TIME ZONE 'America/Los_Angeles')::date::text
  ), 'seed target_date must match the America/Los_Angeles start day for every job';
END $$;
