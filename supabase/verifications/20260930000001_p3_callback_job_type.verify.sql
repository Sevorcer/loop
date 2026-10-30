-- Asserts jobs.type may be Callback. Estimate remains allowed.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.jobs'::regclass
      AND conname = 'jobs_type_check'
      AND pg_get_constraintdef(oid) ILIKE '%Callback%'
      AND pg_get_constraintdef(oid) ILIKE '%Estimate%'
  ), 'jobs_type_check must allow Callback and Estimate';
END; $$;
