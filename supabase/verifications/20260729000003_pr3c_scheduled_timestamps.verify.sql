-- Verification for 20260729000003_pr3c_scheduled_timestamps.sql
-- Asserts that all four new timestamptz columns exist on the jobs table
-- and that both ordering check constraints are present.

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'scheduled_start_at'
      AND data_type = 'timestamp with time zone'
  ), 'jobs.scheduled_start_at (timestamptz) must exist';
END;
$$;

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'scheduled_end_at'
      AND data_type = 'timestamp with time zone'
  ), 'jobs.scheduled_end_at (timestamptz) must exist';
END;
$$;

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'arrival_window_start_at'
      AND data_type = 'timestamp with time zone'
  ), 'jobs.arrival_window_start_at (timestamptz) must exist';
END;
$$;

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'arrival_window_end_at'
      AND data_type = 'timestamp with time zone'
  ), 'jobs.arrival_window_end_at (timestamptz) must exist';
END;
$$;

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_scheduled_window_order_check'
      AND conrelid = 'jobs'::regclass
  ), 'jobs_scheduled_window_order_check constraint must exist';
END;
$$;

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_arrival_window_order_check'
      AND conrelid = 'jobs'::regclass
  ), 'jobs_arrival_window_order_check constraint must exist';
END;
$$;

-- Legacy columns must still exist during the compatibility window
DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'scheduled_for'
  ), 'jobs.scheduled_for must still exist (backwards-compat window)';
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
  ), 'jobs.appointment_window must still exist (backwards-compat window)';
END;
$$;
