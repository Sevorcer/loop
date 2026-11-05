-- Verify: 20261121600000_job_customer_notifications
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'jobs'
  AND column_name IN ('customer_notifications_enabled', 'en_route_at')
ORDER BY column_name;
-- Expected: customer_notifications_enabled | boolean | false | NO
--           en_route_at                    | timestamp with time zone | (null) | YES

SELECT count(*) AS jobs_with_notifications_on
FROM jobs
WHERE customer_notifications_enabled = true;
-- Expected: 0 (opt-in starts off for every existing job)
