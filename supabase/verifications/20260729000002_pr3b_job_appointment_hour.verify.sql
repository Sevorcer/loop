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
      AND data_type = 'smallint'
      AND is_nullable = 'NO'
  ), 'jobs.appointment_window must be smallint and NOT NULL';
END;
$$;

DO $$
BEGIN
  ASSERT (
    SELECT column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'appointment_window'
  ) = '9', 'jobs.appointment_window default must be 9';
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
