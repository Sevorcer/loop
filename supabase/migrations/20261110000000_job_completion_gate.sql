-- =============================================================================
-- Migration — Database-enforced job completion gates (security fix S5)
--
-- The closeout gates (photo / installed system / note / required QA, or a note
-- alone for visit mode) lived only in the app layer (src/services/jobs.ts,
-- getJobCompletionChecklist + updateJobStatus). The Supabase anon key ships in
-- the browser, so anyone whose RLS lets them UPDATE a job — owner, manager,
-- dispatch, office — could set status = 'Completed' straight against the table
-- and skip every gate. (Technicians are already limited to the status column by
-- S1's guard_tech_job_update allowlist, but still reach 'Completed'.)
--
-- This adds a BEFORE UPDATE trigger that mirrors the app's completion rules
-- exactly — no stricter, no looser — so no client can bypass them. It enforces
-- only the transition INTO 'Completed' from a non-Completed state; reopen /
-- cancel (transitions OUT of Completed) and non-status edits are never gated.
--
-- App rules mirrored (all definitions from src/services/jobs.ts and
-- src/features/jobs/utils/jobCompletionChecklist.ts at baf72db):
--
--   closeout_mode = 'visit'  -> a job note exists (B9: any note, any author)
--                               OR jobs.notes is non-empty.
--   closeout_mode = 'full'   -> tech photo  AND installed system
--                               AND job note AND required QA items complete.
--     tech photo        : a storage_objects row for the job that is NOT in the
--                          'job-signatures' bucket, has an image/* mime type,
--                          and was uploaded by a user whose app_role = 'tech'.
--                          A signature NEVER satisfies the photo gate (#297).
--     installed system  : an installed_systems row whose job_id = the job, or
--                          whose linked_workflow_ids contains the job id.
--     job note          : as visit, above.
--     required QA       : the latest job_activity 'qa' event's JSON has
--                          startupVerificationComplete, safetyReviewComplete
--                          and workAreaCleaned all true (missing/invalid => no).
--   B1 (multi-day)       : a job whose final scheduled day (company timezone,
--                          America/Los_Angeles) is after its start day cannot
--                          complete before that final day.
--
-- Trust boundary (importer-safe): the gate runs ONLY when there is a signed-in
-- app role (public.current_app_role() IS NOT NULL). The Service Fusion importer
-- (public.sf_import_apply_batch, granted to service_role only) and any direct
-- database / migration write have no signed-in user, so they are never gated —
-- bulk historical import of Completed jobs keeps working. This is the same
-- "no signed-in user = trusted" reasoning sf_import_apply_batch already uses.
--
-- Scope note: the historical importer writes Completed jobs via INSERT (and
-- re-imports via ON CONFLICT ... DO UPDATE with status unchanged, i.e. not a
-- transition into Completed), so a BEFORE UPDATE trigger gating only the
-- non-Completed -> Completed transition does not touch it even if the service
-- role were somehow bypassed. A direct INSERT of a status='Completed' row by a
-- signed-in client is NOT covered here (out of scope per the S5 brief, which
-- specifies a BEFORE UPDATE trigger); see the PR description for that residual
-- vector. Native job creation always inserts status='Scheduled'.
--
-- Interaction with S1 (guard_tech_job_update): independent BEFORE UPDATE
-- triggers; both simply RAISE or pass. S1 already blocks technicians from
-- changing closeout_mode (allowlist: techs may change only status). This
-- migration re-states that one rule as defense-in-depth so the completion
-- guarantee is self-contained, and otherwise does not touch S1.
--
-- UP:
--   - CREATE OR REPLACE FUNCTION public.guard_job_completion_gate().
--   - (Re)create the BEFORE UPDATE trigger guard_job_completion_gate on jobs.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP TRIGGER IF EXISTS guard_job_completion_gate ON public.jobs;
--   DROP FUNCTION IF EXISTS public.guard_job_completion_gate();
-- =============================================================================

CREATE OR REPLACE FUNCTION public.guard_job_completion_gate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_role  text := public.current_app_role();
  v_mode  text := coalesce(NEW.closeout_mode, 'full');
  v_start date;
  v_end   date;
  v_final date;
  v_note  boolean;
  v_photo boolean;
  v_system boolean;
  v_qa    jsonb;
  v_qa_ok boolean := false;
  v_missing text[] := '{}';
BEGIN
  -- Trusted, non-interactive writers (service_role importer, direct DB /
  -- migration writes) have no signed-in app role and are never gated.
  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  -- Defense-in-depth echo of S1: a technician may never change closeout_mode.
  -- (S1's allowlist already enforces this; office and above may set it per B4.)
  IF v_role = 'tech' AND NEW.closeout_mode IS DISTINCT FROM OLD.closeout_mode THEN
    RAISE EXCEPTION 'Technicians cannot change a job''s closeout mode'
      USING ERRCODE = '42501';
  END IF;

  -- Gate only the transition INTO Completed. Transitions out of Completed
  -- (reopen / cancel) and every non-completing update pass untouched.
  IF NOT (NEW.status = 'Completed' AND OLD.status IS DISTINCT FROM 'Completed') THEN
    RETURN NEW;
  END IF;

  -- B1: a multi-day job cannot complete before its final scheduled day.
  -- Company-timezone calendar days, read from the job's stored schedule (OLD:
  -- a status change does not move the schedule, matching the app which reads
  -- the existing job; also prevents a shorten-and-complete bypass in one write).
  v_start := (OLD.scheduled_start_at AT TIME ZONE 'America/Los_Angeles')::date;
  v_end   := (OLD.scheduled_end_at   AT TIME ZONE 'America/Los_Angeles')::date;
  v_final := coalesce(v_end, v_start);
  IF v_start IS NOT NULL
     AND v_final IS NOT NULL
     AND v_final > v_start
     AND (now() AT TIME ZONE 'America/Los_Angeles')::date < v_final THEN
    RAISE EXCEPTION
      'Cannot complete job — it runs through % and cannot be completed before its final scheduled day.',
      v_final
      USING ERRCODE = '42501';
  END IF;

  -- jobNotesCompleted: any job note (any author) OR a non-empty notes column.
  v_note := (btrim(coalesce(NEW.notes, '')) <> '')
    OR EXISTS (SELECT 1 FROM public.job_notes n WHERE n.job_id = NEW.id);

  IF v_mode = 'visit' THEN
    IF NOT v_note THEN
      RAISE EXCEPTION 'Cannot complete job — missing job notes.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Full closeout. Photo: a non-signature image uploaded by a technician.
  v_photo := EXISTS (
    SELECT 1
    FROM public.storage_objects so
    JOIN public.user_profiles up ON up.id = so.uploaded_by
    WHERE so.job_id = NEW.id
      AND so.org_id = NEW.org_id
      AND so.bucket <> 'job-signatures'
      AND lower(so.mime_type) LIKE 'image/%'
      AND up.app_role = 'tech'
  );

  -- Installed system linked to the job directly or via linked_workflow_ids.
  v_system := EXISTS (
    SELECT 1
    FROM public.installed_systems isy
    WHERE isy.org_id = NEW.org_id
      AND (isy.job_id = NEW.id OR NEW.id::text = ANY (isy.linked_workflow_ids))
  );

  -- Required QA: parse the latest 'qa' activity event's JSON description. A
  -- missing event or invalid JSON leaves every item false (incomplete),
  -- matching parseLatestQaChecklist's default-on-failure behaviour.
  BEGIN
    SELECT a.description::jsonb
      INTO v_qa
      FROM public.job_activity a
      WHERE a.job_id = NEW.id
        AND a.type = 'qa'
      ORDER BY a.created_at DESC
      LIMIT 1;

    v_qa_ok :=
         coalesce((v_qa ->> 'startupVerificationComplete')::boolean, false)
     AND coalesce((v_qa ->> 'safetyReviewComplete')::boolean, false)
     AND coalesce((v_qa ->> 'workAreaCleaned')::boolean, false);
  EXCEPTION
    WHEN others THEN
      v_qa_ok := false;
  END;

  IF NOT (v_photo AND v_system AND v_note AND v_qa_ok) THEN
    IF NOT v_photo  THEN v_missing := v_missing || 'missing at least one photo'; END IF;
    IF NOT v_system THEN v_missing := v_missing || 'missing installed systems'; END IF;
    IF NOT v_note   THEN v_missing := v_missing || 'missing job notes'; END IF;
    IF NOT v_qa_ok  THEN v_missing := v_missing || 'incomplete required QA items'; END IF;
    RAISE EXCEPTION 'Cannot complete job — %.', array_to_string(v_missing, ', ')
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Re-create the trigger so this migration is self-contained if run in
-- isolation. CREATE OR REPLACE FUNCTION already updated the bound function.
DROP TRIGGER IF EXISTS guard_job_completion_gate ON public.jobs;
CREATE TRIGGER guard_job_completion_gate
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_job_completion_gate();
