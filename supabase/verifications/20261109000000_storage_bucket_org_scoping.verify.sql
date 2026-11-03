-- Asserts the cross-tenant storage hole is closed for the private `job-files`
-- and `feedback-screenshots` buckets, and that the `job-signatures` template
-- is untouched.
--
-- The hole was: storage.objects policies for these two buckets checked only
-- `bucket_id = '<bucket>'` for any authenticated user (no org scope, no row
-- ownership). After this migration every policy on these buckets carries an
-- EXISTS org-join and/or a role predicate, so no policy grants access by
-- bucket_id alone (except the deliberately-broad feedback INSERT, which is the
-- only create path open to all staff).
DO $$ BEGIN
  -- ── Buckets are still private ────────────────────────────────────────────
  ASSERT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'job-files' AND public = false
  ), 'job-files bucket must stay private';
  ASSERT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'feedback-screenshots' AND public = false
  ), 'feedback-screenshots bucket must stay private';

  -- ── Old permissive policies are gone ─────────────────────────────────────
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN (
        'job_files_authenticated_select',
        'job_files_authenticated_insert',
        'job_files_authenticated_update',
        'job_files_authenticated_delete',
        'feedback_screenshots_select_authenticated',
        'feedback_screenshots_insert_authenticated',
        'feedback_screenshots_update_authenticated',
        'feedback_screenshots_delete_authenticated'
      )
  ), 'the 8 permissive bucket-only storage policies must be dropped';

  -- ── No remaining job-files / feedback-screenshots READ/WRITE policy may ──
  -- ── grant access by bucket alone. Every SELECT/UPDATE/DELETE policy that ──
  -- ── mentions one of these buckets must also carry an EXISTS org-join AND a ──
  -- ── current_app_role predicate. (INSERT is checked separately below.)      ──
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd IN ('SELECT', 'UPDATE', 'DELETE')
      AND COALESCE(qual, '') ~ 'job-files|feedback-screenshots'
      AND NOT (
        COALESCE(qual, '') ILIKE '%exists%'
        AND COALESCE(qual, '') ILIKE '%current_app_role%'
      )
  ), 'every job-files/feedback-screenshots read/update/delete policy must carry an EXISTS org-join and a role check';

  -- ── job-files: new org-scoped policies exist with the right shape ─────────
  -- SELECT: all six visibility roles + EXISTS on public.jobs (org inherited).
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'job_files_storage_select'
      AND cmd = 'SELECT'
      AND qual ILIKE '%bucket_id = ''job-files''%'
      AND qual ILIKE '%current_app_role%'
      AND qual ILIKE '%''tech''%'
      AND qual ILIKE '%''sales''%'
      AND qual ILIKE '%exists%'
      AND qual ILIKE '%jobs%'
      AND qual ILIKE '%split_part%'
  ), 'job_files_storage_select must org-scope via EXISTS on public.jobs for the full visibility role set';

  -- INSERT: owner/manager/dispatch/tech/office + EXISTS on public.jobs.
  -- (dispatch is included to match the upload route's jobs.update gate.)
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'job_files_storage_insert'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%bucket_id = ''job-files''%'
      AND with_check ILIKE '%current_app_role%'
      AND with_check ILIKE '%''dispatch''%'
      AND with_check ILIKE '%''office''%'
      AND with_check ILIKE '%exists%'
      AND with_check ILIKE '%jobs%'
  ), 'job_files_storage_insert must org-scope writes via EXISTS on public.jobs and include the dispatch role';

  -- DELETE: owner/manager only, AND org-scoped via EXISTS on public.jobs so a
  -- cross-org owner/manager cannot delete another org's files.
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'job_files_storage_delete'
      AND cmd = 'DELETE'
      AND qual ILIKE '%bucket_id = ''job-files''%'
      AND qual ILIKE '%''owner''%'
      AND qual ILIKE '%''manager''%'
      AND qual NOT ILIKE '%''tech''%'
      AND qual NOT ILIKE '%''dispatch''%'
      AND qual ILIKE '%exists%'
      AND qual ILIKE '%jobs%'
  ), 'job_files_storage_delete must be owner/manager only and org-scoped via EXISTS on public.jobs';

  -- No UPDATE policy on job-files (write-once, append-only like signatures).
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd = 'UPDATE'
      AND COALESCE(qual, '') ILIKE '%job-files%'
  ), 'job-files must have no UPDATE policy (uploads are write-once)';

  -- ── feedback-screenshots: new org-scoped policies ─────────────────────────
  -- INSERT stays broad (any authenticated, bucket_id only) — the only
  -- intentionally bucket-only policy, because feedback is open to all staff and
  -- no org metadata row exists yet at insert time.
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'feedback_screenshots_storage_insert'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%bucket_id = ''feedback-screenshots''%'
      AND COALESCE(with_check, '') NOT ILIKE '%current_app_role%'
  ), 'feedback_screenshots_storage_insert must stay broad for authenticated but require bucket_id';

  -- SELECT/UPDATE/DELETE: owner/manager triage roles + EXISTS on
  -- public.storage_objects (RLS org-scoped; raw storage_path join).
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'feedback_screenshots_storage_select'
      AND cmd = 'SELECT'
      AND qual ILIKE '%bucket_id = ''feedback-screenshots''%'
      AND qual ILIKE '%''owner''%'
      AND qual ILIKE '%''manager''%'
      AND qual NOT ILIKE '%''tech''%'
      AND qual ILIKE '%exists%'
      AND qual ILIKE '%storage_objects%'
      AND qual ILIKE '%storage_path%'
  ), 'feedback_screenshots_storage_select must be owner/manager and org-scoped via storage_objects';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'feedback_screenshots_storage_update'
      AND cmd = 'UPDATE'
      AND qual ILIKE '%storage_objects%'
      AND qual ILIKE '%''owner''%'
      AND with_check ILIKE '%storage_objects%'
      AND with_check ILIKE '%''owner''%'
  ), 'feedback_screenshots_storage_update must be owner/manager and org-scoped via storage_objects (USING + WITH CHECK)';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'feedback_screenshots_storage_delete'
      AND cmd = 'DELETE'
      AND qual ILIKE '%bucket_id = ''feedback-screenshots''%'
      AND qual ILIKE '%''owner''%'
      AND qual ILIKE '%''manager''%'
      AND qual ILIKE '%exists%'
      AND qual ILIKE '%storage_objects%'
  ), 'feedback_screenshots_storage_delete must be owner/manager and org-scoped via storage_objects';

  -- ── job-signatures template is UNCHANGED (role sets + EXISTS form) ────────
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'job_signatures_storage_select'
      AND cmd = 'SELECT'
      AND qual ILIKE '%bucket_id = ''job-signatures''%'
      AND qual ILIKE '%current_app_role%'
      AND qual ILIKE '%''sales''%'
      AND qual ILIKE '%exists%'
      AND qual ILIKE '%jobs%'
  ), 'job_signatures_storage_select must be unchanged';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'job_signatures_storage_insert'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%bucket_id = ''job-signatures''%'
      AND with_check ILIKE '%exists%'
      AND with_check ILIKE '%jobs%'
  ), 'job_signatures_storage_insert must be unchanged';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'job_signatures_storage_delete'
      AND cmd = 'DELETE'
      AND qual ILIKE '%bucket_id = ''job-signatures''%'
      AND qual ILIKE '%''owner''%'
      AND qual ILIKE '%''manager''%'
  ), 'job_signatures_storage_delete must be unchanged';

  -- Exactly the three job-signatures storage policies, untouched in count.
  ASSERT (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname LIKE 'job_signatures_storage_%'
  ) = 3, 'job-signatures must still have exactly its 3 storage policies';

  -- ── Net-tightening invariant vs the old hole ─────────────────────────────
  -- The vulnerability was a policy whose predicate was `bucket_id = '<bucket>'`
  -- and nothing else. Assert no such bucket-only SELECT/UPDATE/DELETE policy
  -- survives for either bucket (feedback INSERT is the one intended broad path,
  -- asserted above). Equivalent to: no read/write policy references the bucket
  -- without also referencing either an EXISTS join or current_app_role.
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd IN ('SELECT', 'UPDATE', 'DELETE')
      AND (
        COALESCE(qual, '')       ILIKE '%feedback-screenshots%'
        OR COALESCE(qual, '')    ILIKE '%job-files%'
        OR COALESCE(with_check,'') ILIKE '%feedback-screenshots%'
        OR COALESCE(with_check,'') ILIKE '%job-files%'
      )
      AND COALESCE(qual, '')       NOT ILIKE '%exists%'
      AND COALESCE(with_check, '') NOT ILIKE '%exists%'
  ), 'no job-files/feedback-screenshots read/update/delete policy may grant access without an EXISTS org-join';
END; $$;
