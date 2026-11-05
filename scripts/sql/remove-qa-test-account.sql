-- Remove QA Test Account: "QA Test Tech — DELETE ME"
-- Profile ID: 02ecdfe5-7541-482c-803a-bd770104de17
-- Created 2026-10-06, still appearing in dispatch/calendar people filters
--
-- Run via Supabase SQL Editor. Check for auth.users row after
-- (delete that from the Supabase Auth dashboard, not here).

BEGIN;

-- 1. Check for auth.users row (informational — delete via dashboard)
-- SELECT id, email, created_at FROM auth.users
--   WHERE id = '02ecdfe5-7541-482c-803a-bd770104de17';

-- 2. Remove from job_assignees
DELETE FROM job_assignees
WHERE user_id = '02ecdfe5-7541-482c-803a-bd770104de17';

-- 3. Remove from dispatch_plan_members (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dispatch_plan_members') THEN
    EXECUTE 'DELETE FROM dispatch_plan_members WHERE user_id = ''02ecdfe5-7541-482c-803a-bd770104de17''';
  END IF;
END $$;

-- 4. Remove from schedule_blocks (if assigned)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_blocks' AND column_name = 'user_id') THEN
    EXECUTE 'DELETE FROM schedule_blocks WHERE user_id = ''02ecdfe5-7541-482c-803a-bd770104de17''';
  END IF;
END $$;

-- 5. Remove from calendar_saved_group_members
DELETE FROM calendar_saved_group_members
WHERE user_id = '02ecdfe5-7541-482c-803a-bd770104de17';

-- 6. Remove the profile row
DELETE FROM user_profiles
WHERE id = '02ecdfe5-7541-482c-803a-bd770104de17';

COMMIT;

-- After running: check auth.users for the same ID in the Supabase dashboard.
-- If a row exists, delete it there (not via SQL to avoid auth cascade issues).
