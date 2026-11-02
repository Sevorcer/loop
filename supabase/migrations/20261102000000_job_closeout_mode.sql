-- Per-job closeout mode (2026-11-02)
-- Adds closeout_mode to jobs so the office can pick how a job closes out:
--   'full'  — completion requires a tech photo, an installed system linked
--             to the job, a job note, and the required QA items (unchanged).
--   'visit' — completion requires a job note only, for single-visit jobs
--             such as inspection finals where the install gates do not fit.
-- Every existing job defaults to 'full', so nothing changes until the
-- office flips a job to 'visit'. The app reads and writes the column with
-- a fallback, so it keeps working before this migration is applied.
--
-- DOWN
--   ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_closeout_mode_check;
--   ALTER TABLE public.jobs DROP COLUMN IF EXISTS closeout_mode;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS closeout_mode TEXT NOT NULL DEFAULT 'full';

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_closeout_mode_check CHECK (closeout_mode IN ('full', 'visit'));
