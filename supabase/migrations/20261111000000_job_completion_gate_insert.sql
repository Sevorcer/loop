-- =============================================================================
-- Migration — Close the INSERT-as-Completed residual on the completion gate
-- (security fix S5, follow-up to 20261110000000)
--
-- 20261110000000 added guard_job_completion_gate as a BEFORE UPDATE trigger, so
-- it gates the transition INTO 'Completed'. Residual vector (flagged in #327):
-- a signed-in client could still INSERT a row already marked 'Completed' and
-- skip every gate, because a BEFORE UPDATE trigger never fires on INSERT.
--
-- This closes it by binding the SAME function to a BEFORE INSERT trigger and
-- making the function TG_OP-aware (one source of truth for the gate matrix):
--
--   (1) Transition test — unchanged and correct for INSERT: on INSERT OLD is
--       NULL, so (OLD.status IS DISTINCT FROM 'Completed') is TRUE, and the
--       gate fires exactly when NEW.status = 'Completed'.
--   (2) B1 multi-day — reads the schedule from NEW on INSERT (there is no OLD),
--       and keeps reading OLD on UPDATE (preserving the shorten-and-complete
--       protection: a status-only update can't rewrite the end date to dodge
--       the block).
--   (3) Tech closeout_mode lock — scoped to UPDATE only: "changing"
--       closeout_mode needs a prior value, which doesn't exist on INSERT. Techs
--       cannot create jobs via RLS anyway, and the completion gate below still
--       blocks a tech from inserting a Completed job. (Explicitly INSERT-safe.)
--   (4) Signed-in-role gate — unchanged: current_app_role() IS NULL => no-op, so
--       the service_role importer (which INSERTs historical Completed jobs) and
--       direct DB / migration writes are never blocked.
--
-- Practical effect: a signed-in client can effectively never INSERT a Completed
-- job — the note/photo/installed-system/QA evidence cannot exist for a
-- brand-new row, so full mode always fails and visit mode fails without a note.
-- Jobs are born 'Scheduled' (src/services/jobs.ts createJob hard-codes it) and
-- reach 'Completed' only through the gated UPDATE path. Audited INSERT paths —
-- app createJob (Scheduled), the SF importer (service_role, skipped), the perf
-- script (drives Completed via the API status PATCH, not a direct INSERT), and
-- db-bootstrap-validate.sh (direct psql, no signed-in role) — none inserts a
-- Completed job under a signed-in app role.
--
-- The existing BEFORE UPDATE trigger from 20261110000000 is left in place and
-- now shares the updated (backward-compatible) function body.
--
-- UP:
--   - CREATE OR REPLACE FUNCTION public.guard_job_completion_gate() (TG_OP-aware).
--   - (Re)create the BEFORE INSERT trigger guard_job_completion_gate_insert.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP TRIGGER IF EXISTS guard_job_completion_gate_insert ON public.jobs;
--   -- and restore the 20261110000000 function body if the TG_OP branch must go.
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
  -- UPDATE-scoped — "changing" needs a prior value, so it does not apply on
  -- INSERT (techs cannot create jobs via RLS, and the completion gate below
  -- still blocks a tech from inserting a Completed job).
  IF TG_OP = 'UPDATE'
     AND v_role = 'tech'
     AND NEW.closeout_mode IS DISTINCT FROM OLD.closeout_mode THEN
    RAISE EXCEPTION 'Technicians cannot change a job''s closeout mode'
      USING ERRCODE = '42501';
  END IF;

  -- Gate only entry INTO Completed. On INSERT, OLD is NULL so
  -- (OLD.status IS DISTINCT FROM 'Completed') is TRUE and this fires whenever a
  -- row is inserted already Completed. On UPDATE it fires on the
  -- non-Completed -> Completed transition; reopen / cancel and non-completing
  -- edits pass untouched.
  IF NOT (NEW.status = 'Completed' AND OLD.status IS DISTINCT FROM 'Completed') THEN
    RETURN NEW;
  END IF;

  -- B1: a multi-day job cannot complete before its final scheduled day.
  -- Company-timezone calendar days. On INSERT read the schedule from NEW (no
  -- OLD exists); on UPDATE read OLD (a status change does not move the schedule
  -- and this blocks a shorten-and-complete bypass in a single write).
  IF TG_OP = 'INSERT' THEN
    v_start := (NEW.scheduled_start_at AT TIME ZONE 'America/Los_Angeles')::date;
    v_end   := (NEW.scheduled_end_at   AT TIME ZONE 'America/Los_Angeles')::date;
  ELSE
    v_start := (OLD.scheduled_start_at AT TIME ZONE 'America/Los_Angeles')::date;
    v_end   := (OLD.scheduled_end_at   AT TIME ZONE 'America/Los_Angeles')::date;
  END IF;
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

-- The BEFORE UPDATE trigger from 20261110000000 (guard_job_completion_gate) is
-- left in place and now uses the updated function. Add the BEFORE INSERT bind.
DROP TRIGGER IF EXISTS guard_job_completion_gate_insert ON public.jobs;
CREATE TRIGGER guard_job_completion_gate_insert
  BEFORE INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_job_completion_gate();
