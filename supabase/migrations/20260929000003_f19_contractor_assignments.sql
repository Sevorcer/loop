-- F19: persist contractor assignments on jobs.
-- Idempotent: safe to run multiple times (e.g. re-run in the dashboard SQL editor).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'contractor_ids'
  ) THEN
    ALTER TABLE public.jobs
      ADD COLUMN contractor_ids uuid[] NOT NULL DEFAULT '{}';
  END IF;
END
$$;
