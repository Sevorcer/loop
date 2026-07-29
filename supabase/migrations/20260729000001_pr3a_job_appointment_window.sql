-- PR3A: Scheduling data foundation
-- Adds appointment window primitives for job scheduling.

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS appointment_window text;

UPDATE jobs
SET appointment_window = 'Morning'
WHERE appointment_window IS NULL;

ALTER TABLE jobs
ALTER COLUMN appointment_window SET DEFAULT 'Morning',
ALTER COLUMN appointment_window SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_appointment_window_check'
      AND conrelid = 'jobs'::regclass
  ) THEN
    ALTER TABLE jobs
    ADD CONSTRAINT jobs_appointment_window_check
    CHECK (appointment_window IN ('Morning', 'Afternoon'));
  END IF;
END;
$$;
