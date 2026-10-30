-- PR3B: Appointment hour — replace Morning/Afternoon text with 1-12 integer hour
-- Backfill: Morning → 9, Afternoon → 1, anything else → 9

-- 1. Drop the old text-based constraint
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_appointment_window_check;

-- 2. Cast the column from text to smallint using the backfill mapping
ALTER TABLE jobs
  ALTER COLUMN appointment_window TYPE smallint
  USING CASE appointment_window
    WHEN 'Morning'   THEN 9
    WHEN 'Afternoon' THEN 1
    ELSE 9
  END;

-- 3. Ensure no nulls remain (all rows should already be non-null from the previous migration)
UPDATE jobs SET appointment_window = 9 WHERE appointment_window IS NULL;

-- 4. Update column default and NOT NULL constraint
ALTER TABLE jobs
  ALTER COLUMN appointment_window SET DEFAULT 9,
  ALTER COLUMN appointment_window SET NOT NULL;

-- 5. Add the new 1-12 range constraint
ALTER TABLE jobs
  ADD CONSTRAINT jobs_appointment_window_check
  CHECK (appointment_window BETWEEN 1 AND 12);
-- DOWN
-- The column was cast from text ('Morning'/'Afternoon') to smallint 1-12.
-- Reversing it is lossy: only hour 9 maps back to 'Morning' and hour 1 to
-- 'Afternoon'. Other hours were stored as 9 during the forward backfill.
--   ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_appointment_window_check;
--   ALTER TABLE jobs ALTER COLUMN appointment_window DROP NOT NULL;
--   ALTER TABLE jobs ALTER COLUMN appointment_window DROP DEFAULT;
--   ALTER TABLE jobs
--     ALTER COLUMN appointment_window TYPE text
--     USING CASE appointment_window
--       WHEN 1 THEN 'Afternoon'
--       ELSE 'Morning'
--     END;
--   ALTER TABLE jobs
--     ADD CONSTRAINT jobs_appointment_window_check
--     CHECK (appointment_window IN ('Morning', 'Afternoon'));
--   ALTER TABLE jobs ALTER COLUMN appointment_window SET DEFAULT 'Morning';
--   ALTER TABLE jobs ALTER COLUMN appointment_window SET NOT NULL;
