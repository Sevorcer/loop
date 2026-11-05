-- Verify: job_share_links RLS hardening
-- Expect: the org_isolation_job_share_links policy is gone; exactly three
-- policies exist (office read / office create / office revoke), all TO
-- authenticated; no DELETE policy; RLS enabled and forced.

SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'job_share_links'
ORDER BY policyname;

SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'job_share_links';
