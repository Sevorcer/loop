-- P3 reporting (callbacks): allow 'Callback' as a job type.
--
-- Same pattern as 20260929000002_batch1_estimate_job_type.sql: drops whichever
-- check constraint enforces the old five-value list and re-adds it with
-- 'Callback' included. Safe to re-run. Must be applied before the P3 deploy,
-- otherwise creating a Callback job 500s on the constraint.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.jobs'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%Install%Service%Maintenance%Inspection%Estimate%'
  LOOP
    EXECUTE format('ALTER TABLE public.jobs DROP CONSTRAINT %I', r.conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.jobs'::regclass
      AND conname = 'jobs_type_check'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_type_check
      CHECK (type IN ('Install', 'Service', 'Maintenance', 'Inspection', 'Estimate', 'Callback'));
  END IF;
END $$;
