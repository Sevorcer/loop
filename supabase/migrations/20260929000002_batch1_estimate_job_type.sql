-- Batch 1 friction fix (F12): allow 'Estimate' as a job type.
--
-- The baseline schema constrains jobs.type with an inline CHECK. This drops
-- whichever check constraint enforces the old four-value list and re-adds it
-- with 'Estimate' included. Safe to re-run. Must be applied before the
-- batch-1 deploy, otherwise creating an Estimate job 500s on the constraint.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.jobs'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%Install%Service%Maintenance%Inspection%'
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
      CHECK (type IN ('Install', 'Service', 'Maintenance', 'Inspection', 'Estimate'));
  END IF;
END $$;
