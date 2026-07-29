DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'appointment_window'
  ), 'jobs.appointment_window column must exist';
END;
$$;

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'appointment_window'
      AND is_nullable = 'NO'
      AND column_default LIKE '%Morning%'
  ), 'jobs.appointment_window must be NOT NULL with default Morning';
END;
$$;

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_appointment_window_check'
      AND conrelid = 'jobs'::regclass
  ), 'jobs_appointment_window_check constraint must exist';
END;
$$;
