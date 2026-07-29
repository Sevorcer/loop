-- PR3C: Production-ready clock-time scheduling
--
-- Replaces the hour-only appointment_window model with explicit timestamptz
-- columns so dispatch can use real clock times for scheduling and routing.
--
-- New columns:
--   scheduled_start_at  – the committed start time for the job (primary scheduling truth)
--   scheduled_end_at    – optional committed end / completion time
--   arrival_window_start_at – start of the customer-facing arrival window
--   arrival_window_end_at   – end of the customer-facing arrival window
--
-- Legacy columns kept for one release window (backwards compat / read fallback):
--   scheduled_for      – date-only string (deprecated; use scheduled_start_at)
--   appointment_window – smallint hour (deprecated; use scheduled_start_at)
--
-- TODO(cleanup): Remove scheduled_for and appointment_window in the next
-- major cleanup PR once all callers have migrated to scheduled_start_at.
--
-- Backfill assumptions (documented):
--   • scheduled_for is interpreted as a UTC calendar date.
--   • appointment_window (1-12) is the UTC hour-of-day.
--   • Example: scheduled_for='2026-07-29', appointment_window=9 →
--     scheduled_start_at = '2026-07-29T09:00:00Z'
--   • Rows where scheduled_for IS NULL receive scheduled_start_at = NULL
--     (unknown — not guessed).
--   • appointment_window defaults to 9 (9 AM UTC) when NULL during backfill.

-- 1. Add the four new nullable timestamptz columns
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS scheduled_start_at   timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_end_at     timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_window_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_window_end_at   timestamptz;

-- 2. Backfill scheduled_start_at from legacy date + hour columns
UPDATE jobs
SET scheduled_start_at = (
  scheduled_for::date
  + make_interval(hours => COALESCE(appointment_window, 9)::int)
)::timestamptz
WHERE scheduled_for IS NOT NULL
  AND scheduled_start_at IS NULL;

-- 3. Add check constraints to enforce window ordering
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jobs_scheduled_window_order_check'
      AND conrelid = 'jobs'::regclass
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_scheduled_window_order_check
      CHECK (
        scheduled_end_at IS NULL
        OR scheduled_start_at IS NULL
        OR scheduled_start_at <= scheduled_end_at
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jobs_arrival_window_order_check'
      AND conrelid = 'jobs'::regclass
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_arrival_window_order_check
      CHECK (
        arrival_window_end_at IS NULL
        OR arrival_window_start_at IS NULL
        OR arrival_window_start_at <= arrival_window_end_at
      );
  END IF;
END;
$$;
