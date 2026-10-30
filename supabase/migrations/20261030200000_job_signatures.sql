-- Customer signatures captured on a job.
--
-- A technician or office user draws the customer's signature on the job.
-- The image lives in the private job-signatures bucket. This table records
-- who signed, who captured it, and when. Rows are append-only.
--
-- Technicians can read and insert a signature only when the job is assigned
-- to them (assigned_user_id or job_assignees), the same scope as job notes.
-- Storage policies use the jobs row policies, so a technician cannot download
-- a signature image for a job they are not assigned to.
--
-- DOWN
--   DROP POLICY IF EXISTS "job_signatures_storage_delete" ON storage.objects;
--   DROP POLICY IF EXISTS "job_signatures_storage_insert" ON storage.objects;
--   DROP POLICY IF EXISTS "job_signatures_storage_select" ON storage.objects;
--   DELETE FROM storage.buckets WHERE id = 'job-signatures';
--   DROP TABLE IF EXISTS public.job_signatures;
-- Skip the bucket delete when signature files are still stored there.

INSERT INTO storage.buckets (id, name, public)
VALUES ('job-signatures', 'job-signatures', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "job_signatures_storage_select" ON storage.objects;
CREATE POLICY "job_signatures_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'job-signatures'
    AND public.current_app_role() IN ('owner', 'manager', 'dispatch', 'tech', 'office', 'sales')
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE split_part(name, '/', 1) = 'jobs'
        AND j.id::text = split_part(name, '/', 2)
    )
  );

DROP POLICY IF EXISTS "job_signatures_storage_insert" ON storage.objects;
CREATE POLICY "job_signatures_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'job-signatures'
    AND public.current_app_role() IN ('owner', 'manager', 'tech', 'office')
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE split_part(name, '/', 1) = 'jobs'
        AND j.id::text = split_part(name, '/', 2)
    )
  );

DROP POLICY IF EXISTS "job_signatures_storage_delete" ON storage.objects;
CREATE POLICY "job_signatures_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'job-signatures'
    AND public.current_app_role() IN ('owner', 'manager')
  );

CREATE TABLE IF NOT EXISTS public.job_signatures (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES public.organizations(id),
  job_id             uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  storage_object_id  uuid NOT NULL REFERENCES public.storage_objects(id),
  signer_name        text NOT NULL CHECK (char_length(btrim(signer_name)) > 0),
  captured_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  captured_by_name   text NOT NULL DEFAULT '',
  captured_by_role   text NOT NULL DEFAULT ''
                     CHECK (captured_by_role IN ('', 'owner', 'manager', 'dispatch', 'tech', 'office', 'sales')),
  captured_at        timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_signatures_org_job_captured_idx
  ON public.job_signatures (org_id, job_id, captured_at DESC);

ALTER TABLE public.job_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_signatures FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_signatures: read for owner/manager/dispatch/office/sales" ON public.job_signatures;
CREATE POLICY "job_signatures: read for owner/manager/dispatch/office/sales"
  ON public.job_signatures FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "job_signatures: tech reads signatures on assigned jobs" ON public.job_signatures;
CREATE POLICY "job_signatures: tech reads signatures on assigned jobs"
  ON public.job_signatures FOR SELECT
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND job_id IN (
      SELECT j.id
      FROM public.jobs j
      WHERE j.org_id = current_org_id()
        AND (
          j.assigned_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.job_assignees ja
            WHERE ja.job_id = j.id
              AND ja.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "job_signatures: insert for owner/manager/office" ON public.job_signatures;
CREATE POLICY "job_signatures: insert for owner/manager/office"
  ON public.job_signatures FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "job_signatures: tech inserts on assigned jobs" ON public.job_signatures;
CREATE POLICY "job_signatures: tech inserts on assigned jobs"
  ON public.job_signatures FOR INSERT
  WITH CHECK (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND captured_by = auth.uid()
    AND job_id IN (
      SELECT j.id
      FROM public.jobs j
      WHERE j.org_id = current_org_id()
        AND (
          j.assigned_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.job_assignees ja
            WHERE ja.job_id = j.id
              AND ja.user_id = auth.uid()
          )
        )
    )
  );
