-- Verify: the four follow-up columns exist with the expected types/nullability
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'jobs'
  AND column_name IN ('follow_up_needed', 'follow_up_note', 'follow_up_marked_at', 'follow_up_marked_by')
ORDER BY column_name;
-- Expect 4 rows; follow_up_needed is boolean NOT NULL default false.

-- Verify: existing rows default to not flagged (expect 0)
SELECT count(*) AS flagged_rows FROM jobs WHERE follow_up_needed;

-- Verify: partial index for the open-follow-ups list exists
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'jobs' AND indexname = 'idx_jobs_follow_up_open';
