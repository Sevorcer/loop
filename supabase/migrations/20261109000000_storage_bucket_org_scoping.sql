-- =============================================================================
-- Migration — Org-scope the job-files and feedback-screenshots storage buckets
--
-- Security fix: the storage.objects RLS policies for the private `job-files`
-- and `feedback-screenshots` buckets only checked `bucket_id = '<bucket>'` for
-- any `authenticated` user. That let any logged-in user from ANY org (any
-- role, including tech) SELECT / INSERT / UPDATE / DELETE every org's job
-- photos and feedback screenshots — a cross-tenant read/write hole. Both
-- buckets are private, so this is RLS-only.
--
-- The already-correct `job-signatures` bucket is the template:
--   * role-set per action, and
--   * an EXISTS join to an RLS-protected public table so org-scoping is
--     inherited from that table's policies (the caller only "sees" rows in
--     their own org, so the EXISTS is false for another org's object).
--
-- This migration DROPs the 8 permissive policies by name and CREATEs
-- org-scoped replacements. The `job-signatures` policies are NOT touched.
--
-- job-files  — mirrors job-signatures: EXISTS on public.jobs
--   (public.jobs RLS enforces the caller's org). Role sets match
--   job-signatures per action. DELETE additionally carries the EXISTS join
--   (job-signatures' DELETE does not) so a cross-org owner/manager cannot
--   delete another org's files — required by this PR's cross-org guarantee.
--   No UPDATE policy: uploads are write-once (upsert:false) and paths are
--   unique, exactly like job-signatures (append-only).
--
-- feedback-screenshots — scoped via an EXISTS join to public.storage_objects
--   on (bucket, storage_path = objects.name). public.storage_objects is
--   RLS-protected and org-scoped (org_id = current_org_id()), has a
--   UNIQUE(bucket, storage_path), and a metadata row is written synchronously
--   for every upload (repositories/storage.uploadFile). It stores the RAW
--   storage path, unlike feedback_reports.screenshot_url which stores the
--   URL-encoded `/api/feedback/screenshots/<encoded>` form (fragile to
--   reconstruct in SQL) — so storage_objects is the reliable org join.
--   INSERT stays broad for authenticated (anyone may file feedback with a
--   screenshot) but still requires bucket_id; at INSERT time neither the
--   storage_objects metadata row nor the feedback_reports row exists yet, so
--   no EXISTS is possible there. SELECT/UPDATE/DELETE are org-scoped AND
--   narrowed to the triage roles (owner/manager) — screenshots are only ever
--   surfaced in the owner/manager ops triage screen.
--
-- Auth/role helper calls are wrapped as (select ...) so Postgres evaluates
-- them once per statement (initplan form, consistent with PR #306).
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP POLICY IF EXISTS "job_files_storage_select" ON storage.objects;
--   DROP POLICY IF EXISTS "job_files_storage_insert" ON storage.objects;
--   DROP POLICY IF EXISTS "job_files_storage_delete" ON storage.objects;
--   DROP POLICY IF EXISTS "feedback_screenshots_storage_select" ON storage.objects;
--   DROP POLICY IF EXISTS "feedback_screenshots_storage_insert" ON storage.objects;
--   DROP POLICY IF EXISTS "feedback_screenshots_storage_update" ON storage.objects;
--   DROP POLICY IF EXISTS "feedback_screenshots_storage_delete" ON storage.objects;
--   -- To restore the (insecure) prior state you would recreate the old
--   -- bucket_id-only policies; do NOT — they are the vulnerability.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- job-files — replace the 4 permissive policies with org-scoped ones.
-- Mirrors job-signatures (EXISTS on public.jobs; org inherited from jobs RLS).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "job_files_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "job_files_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "job_files_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "job_files_authenticated_delete" ON storage.objects;

-- Anyone who can see the job can read its files.
CREATE POLICY "job_files_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'job-files'
    AND (select public.current_app_role()) IN ('owner', 'manager', 'dispatch', 'tech', 'office', 'sales')
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE split_part(name, '/', 1) = 'jobs'
        AND j.id::text = split_part(name, '/', 2)
    )
  );

-- Anyone who can update the job can upload its files.
CREATE POLICY "job_files_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'job-files'
    AND (select public.current_app_role()) IN ('owner', 'manager', 'tech', 'office')
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE split_part(name, '/', 1) = 'jobs'
        AND j.id::text = split_part(name, '/', 2)
    )
  );

-- Only owner/manager may delete, and only within their own org (EXISTS on jobs).
CREATE POLICY "job_files_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'job-files'
    AND (select public.current_app_role()) IN ('owner', 'manager')
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE split_part(name, '/', 1) = 'jobs'
        AND j.id::text = split_part(name, '/', 2)
    )
  );

-- ---------------------------------------------------------------------------
-- feedback-screenshots — replace the 4 permissive policies with org-scoped ones.
-- Org-scoped via EXISTS on public.storage_objects (RLS org-scoped; raw path).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "feedback_screenshots_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "feedback_screenshots_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "feedback_screenshots_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "feedback_screenshots_delete_authenticated" ON storage.objects;

-- Anyone authenticated may upload a feedback screenshot (feedback is open to
-- all staff). The metadata row that carries org_id is written right after by
-- the upload path, so no org join is possible — nor needed — at INSERT time.
CREATE POLICY "feedback_screenshots_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-screenshots'
  );

-- Only owner/manager (feedback triage) may read, and only an object whose
-- org-scoped metadata row is visible to them (same org).
CREATE POLICY "feedback_screenshots_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND (select public.current_app_role()) IN ('owner', 'manager')
    AND EXISTS (
      SELECT 1
      FROM public.storage_objects so
      WHERE so.bucket = 'feedback-screenshots'
        AND so.storage_path = name
    )
  );

CREATE POLICY "feedback_screenshots_storage_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND (select public.current_app_role()) IN ('owner', 'manager')
    AND EXISTS (
      SELECT 1
      FROM public.storage_objects so
      WHERE so.bucket = 'feedback-screenshots'
        AND so.storage_path = name
    )
  )
  WITH CHECK (
    bucket_id = 'feedback-screenshots'
    AND (select public.current_app_role()) IN ('owner', 'manager')
    AND EXISTS (
      SELECT 1
      FROM public.storage_objects so
      WHERE so.bucket = 'feedback-screenshots'
        AND so.storage_path = name
    )
  );

CREATE POLICY "feedback_screenshots_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND (select public.current_app_role()) IN ('owner', 'manager')
    AND EXISTS (
      SELECT 1
      FROM public.storage_objects so
      WHERE so.bucket = 'feedback-screenshots'
        AND so.storage_path = name
    )
  );

-- =============================================================================
-- POST-MIGRATION CHECKLIST
--   1. Companion verification file:
--      supabase/verifications/20261109000000_storage_bucket_org_scoping.verify.sql
--   2. Assertions: old permissive policies gone; new policies carry an
--      EXISTS/role predicate (no bucket-only access); job-signatures unchanged.
--   3. -- DOWN rollback notes present above (CI check 7).
--   4. bash scripts/update-migration-checksums.sh && bash scripts/verify-migrations.sh
-- =============================================================================
