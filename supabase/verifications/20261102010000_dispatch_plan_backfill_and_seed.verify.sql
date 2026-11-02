-- Read-only checks for the dispatch plan backfill + seed migration.
-- Run after 20261102010000_dispatch_plan_backfill_and_seed.sql.
-- This file changes nothing (the job-row literals below are never inserted).

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

  -- Seed derivation spot checks against literal job rows.
  ASSERT (
    SELECT (private.dispatch_plan_seed_for_job(j) ->> 'dispatch_status')
    FROM (SELECT NULL::uuid AS org_id, 'Scheduled'::text AS status,
                 NULL::text AS priority, NULL::text AS assigned_to,
                 NULL::timestamptz AS scheduled_start_at,
                 NULL::timestamptz AS scheduled_end_at,
                 DATE '2026-11-05' AS scheduled_for) j
  ) = 'scheduled', 'seed must map a Scheduled job to a scheduled plan';

  ASSERT (
    SELECT (private.dispatch_plan_seed_for_job(j) ->> 'target_date')
    FROM (SELECT NULL::uuid AS org_id, 'Scheduled'::text AS status,
                 NULL::text AS priority, NULL::text AS assigned_to,
                 NULL::timestamptz AS scheduled_start_at,
                 NULL::timestamptz AS scheduled_end_at,
                 DATE '2026-11-05' AS scheduled_for) j
  ) = '2026-11-05', 'seed must fall back to scheduled_for for target_date';

  ASSERT (
    SELECT (private.dispatch_plan_seed_for_job(j) ->> 'dispatch_status')
    FROM (SELECT NULL::uuid AS org_id, 'Completed'::text AS status,
                 NULL::text AS priority, NULL::text AS assigned_to,
                 NULL::timestamptz AS scheduled_start_at,
                 NULL::timestamptz AS scheduled_end_at,
                 DATE '2026-11-05' AS scheduled_for) j
  ) = 'completed', 'seed must map a Completed job to a completed plan';

  -- 2026-11-05T01:30Z is Nov 4 in America/Los_Angeles.
  ASSERT (
    SELECT (private.dispatch_plan_seed_for_job(j) ->> 'target_date')
    FROM (SELECT NULL::uuid AS org_id, 'Scheduled'::text AS status,
                 NULL::text AS priority, NULL::text AS assigned_to,
                 '2026-11-05T01:30:00Z'::timestamptz AS scheduled_start_at,
                 NULL::timestamptz AS scheduled_end_at,
                 NULL::date AS scheduled_for) j
  ) = '2026-11-04', 'seed must derive target_date in America/Los_Angeles';

  ASSERT private.dispatch_plan_seed_for_job(j) IS NULL
    FROM (SELECT NULL::uuid AS org_id, 'Cancelled'::text AS status,
                 NULL::text AS priority, NULL::text AS assigned_to,
                 NULL::timestamptz AS scheduled_start_at,
                 NULL::timestamptz AS scheduled_end_at,
                 DATE '2026-11-05' AS scheduled_for) j;

  ASSERT private.dispatch_plan_seed_for_job(j) IS NULL
    FROM (SELECT NULL::uuid AS org_id, 'Scheduled'::text AS status,
                 NULL::text AS priority, NULL::text AS assigned_to,
                 NULL::timestamptz AS scheduled_start_at,
                 NULL::timestamptz AS scheduled_end_at,
                 NULL::date AS scheduled_for) j;

  -- Backfill completeness: no seeded job may lack a plan for its job.
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE private.dispatch_plan_seed_for_job(j) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.dispatch_plans dp
        WHERE dp.org_id = j.org_id AND dp.job_id = j.id
      )
  ), 'every job the seed covers must have a dispatch plan after backfill';
END $$;
