-- Asserts jobs.type may be Estimate. Later migrations also allow Callback;
-- this check only requires Estimate to still be permitted.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.jobs'::regclass
      AND conname = 'jobs_type_check'
      AND pg_get_constraintdef(oid) ILIKE '%Estimate%'
  ), 'jobs_type_check must allow Estimate';
END; $$;
