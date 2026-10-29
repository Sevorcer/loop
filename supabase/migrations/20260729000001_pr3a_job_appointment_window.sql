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
-- DOWN
-- Reverse the appointment window column. The backfill that wrote 'Morning'
-- into previously null rows cannot be distinguished from a value someone set,
-- so a rollback drops the column rather than trying to restore nulls.
--   ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_appointment_window_check;
--   ALTER TABLE jobs ALTER COLUMN appointment_window DROP DEFAULT;
--   ALTER TABLE jobs DROP COLUMN IF EXISTS appointment_window;
