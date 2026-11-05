-- ============================================================================
-- Remove QA Test Account: "QA Test Tech — DELETE ME"
-- Profile ID: 02ecdfe5-7541-482c-803a-bd770104de17
--
-- This script removes the QA test profile and its dangling references.
-- It does NOT delete the auth.users row — that must be removed manually
-- from the Supabase dashboard (Authentication > Users).
--
-- Run against: production database
-- Prerequisites: none
-- Rollback: not supported (data deletion)
-- ============================================================================

BEGIN;

-- 1. Confirm the profile exists before proceeding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = '02ecdfe5-7541-482c-803a-bd770104de17'
  ) THEN
    RAISE EXCEPTION 'Profile 02ecdfe5-7541-482c-803a-bd770104de17 not found — aborting.';
  END IF;
END $$;

-- 2. Remove job_assignees rows (FK to user_profiles with ON DELETE CASCADE,
--    but we delete explicitly for visibility in the transaction log)
DELETE FROM public.job_assignees
WHERE user_id = '02ecdfe5-7541-482c-803a-bd770104de17';

-- 3. Remove dispatch-related references
--    dispatch_people has user_id FK with ON DELETE SET NULL, but clean up explicitly
DELETE FROM public.dispatch_people
WHERE user_id = '02ecdfe5-7541-482c-803a-bd770104de17';

-- 4. Remove time_off_requests (FK to user_profiles with ON DELETE CASCADE)
DELETE FROM public.time_off_requests
WHERE user_id = '02ecdfe5-7541-482c-803a-bd770104de17';

-- 5. Remove calendar_tasks (FK to user_profiles with ON DELETE CASCADE)
DELETE FROM public.calendar_tasks
WHERE user_id = '02ecdfe5-7541-482c-803a-bd770104de17';

-- 6. Remove person_team_members (FK to user_profiles with ON DELETE CASCADE)
DELETE FROM public.person_team_members
WHERE user_id = '02ecdfe5-7541-482c-803a-bd770104de17';

-- 7. Clear assigned_user_id on any jobs referencing this user
UPDATE public.jobs
SET assigned_user_id = NULL
WHERE assigned_user_id = '02ecdfe5-7541-482c-803a-bd770104de17';

-- 8. Delete the user_profiles row itself
DELETE FROM public.user_profiles
WHERE id = '02ecdfe5-7541-482c-803a-bd770104de17';

-- 9. Check for the auth.users row (DO NOT delete — remove from Supabase dashboard)
-- This SELECT is informational only; the result shows whether a matching
-- auth.users row still exists and needs manual removal.
SELECT id, email
FROM auth.users
WHERE id = '02ecdfe5-7541-482c-803a-bd770104de17';

COMMIT;
