-- =============================================================================
-- Migration — Full closeout photo gate: any signed-in uploader (not tech-only)
-- (follow-up to the S5 completion gate, 20261110000000 / 20261111000000)
--
-- Decision (Collin, 2026-11-03): the Full-mode photo requirement is satisfied
-- by a non-signature image uploaded by ANY signed-in org member — owner,
-- manager, dispatch, office, or tech — not only a technician. Customer
-- signatures still never count (#297): the 'job-signatures' bucket is a file
-- but not a job photo.
--
-- This CREATE OR REPLACEs public.guard_job_completion_gate(), changing only the
-- Full-mode photo EXISTS check: drop the join to user_profiles and the
-- app_role = 'tech' condition; keep the bucket (<> 'job-signatures') and mime
-- (image/%) conditions. Mirrors the matching app-layer change in
-- src/services/jobs.ts (photosUploaded). Every other gate — visit note, B1
-- multi-day, installed system, required QA, the tech closeout_mode lock, the
-- service-role no-op — is unchanged.
--
-- The function stays TG_OP-aware and is shared by both triggers
-- (guard_job_completion_gate BEFORE UPDATE, guard_job_completion_gate_insert
-- BEFORE INSERT); CREATE OR REPLACE FUNCTION updates both in place, so no
-- trigger DDL is needed here.
--
-- UP:
--   - CREATE OR REPLACE FUNCTION public.guard_job_completion_gate() with the
--     any-role photo check.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   Restore the photo EXISTS check from 20261111000000 (join user_profiles,
--   require app_role = 'tech') via CREATE OR REPLACE FUNCTION.
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

  -- Full closeout. Photo: a non-signature image uploaded by ANY signed-in org
  -- member (role-agnostic as of 2026-11-03). A 'job-signatures' object never
  -- counts (#297).
  v_photo := EXISTS (
    SELECT 1
    FROM public.storage_objects so
    WHERE so.job_id = NEW.id
      AND so.org_id = NEW.org_id
      AND so.bucket <> 'job-signatures'
      AND lower(so.mime_type) LIKE 'image/%'
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
