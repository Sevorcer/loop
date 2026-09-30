-- Prevent duplicate job numbers (duplicate JOB-1006 incident, 2026-09-30).
-- Job numbers were derived from the job row count, so any deleted job made
-- the next created job reuse a number still in use. The app now derives the
-- next number from the highest JOB-<n> in use; this index is the backstop.
-- Existing duplicate job_number values must be renumbered before applying.
CREATE UNIQUE INDEX IF NOT EXISTS jobs_job_number_unique
  ON public.jobs (job_number)
  WHERE job_number <> '';
