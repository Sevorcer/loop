-- =============================================================================
-- Migration — "No system installed" attestation excuses startup QA
--
-- Field report 2026-11-06: with the crew's "no system installed"
-- attestation ticked, the completion gate still demanded
-- startupVerificationComplete under Required QA items — even though
-- nothing was installed, so nothing could have been started up.
--
-- The attestation (migration 20261126800000) already satisfies the
-- installed-system gate. This makes it excuse the startup-verification
-- QA item too, in the database gate, mirroring the app:
--   startup verification is required only when
--     requires_install_gates AND NOT no_system_installed.
--   Safety review + work area cleaned stay required for every full
--   closeout, attested or not.
--
-- App mirror: src/services/jobs.ts (getJobCompletionChecklist) and
-- src/features/jobs/components/JobCompletionChecklistCard.tsx.
--
-- Does not change rows. Safe to re-run (CREATE OR REPLACE).
-- MUST be applied before the matching app code ships.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.guard_job_completion_gate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
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
  v_stage_text text;
  v_requires_install boolean;
BEGIN
  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND v_role = 'tech'
     AND NEW.closeout_mode IS DISTINCT FROM OLD.closeout_mode THEN
    RAISE EXCEPTION 'Technicians cannot change a job''s closeout mode'
      USING ERRCODE = '42501';
  END IF;

  IF NOT (NEW.status = 'Completed' AND OLD.status IS DISTINCT FROM 'Completed') THEN
    RETURN NEW;
  END IF;

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

  v_note := (btrim(coalesce(NEW.notes, '')) <> '')
    OR EXISTS (SELECT 1 FROM public.job_notes n WHERE n.job_id = NEW.id);

  IF v_mode = 'visit' THEN
    IF NOT v_note THEN
      RAISE EXCEPTION 'Cannot complete job — missing job notes.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Stage detection (mirrors jobInstallStage.ts).
  v_stage_text := lower(btrim(coalesce(NEW.title, '')) || ' ' || btrim(coalesce(NEW.summary, '')));
  IF v_stage_text ~ '(commission(ed|ing)?|start[[:space:]-]?up|startup|fire[[:space:]-]?off|fired)'
     OR v_stage_text ~ '(install(ed|ing)?|hang(ing)?|set(ting)?)[[:alnum:][:space:]/+-]*(unit|system|cassette|air[[:space:]]*handler|heat[[:space:]]*pump|condenser|furnace|head|odu|idu)' THEN
    v_requires_install := true;
  ELSIF v_stage_text ~ '\yprep\y'
     OR v_stage_text ~ 'rough[[:space:]-]?in'
     OR (v_stage_text ~ '\ylinesets?\y'
         AND v_stage_text ~ '(pressur|insulat|rout|connect|repair|correct|protect|pipe|odu)')
     OR lower(btrim(coalesce(NEW.title, ''))) ~ '^\s*linesets?\y' THEN
    v_requires_install := false;
  ELSE
    v_requires_install := true;
  END IF;

  v_photo := EXISTS (
    SELECT 1
    FROM public.storage_objects so
    WHERE so.job_id = NEW.id
      AND so.org_id = NEW.org_id
      AND so.bucket <> 'job-signatures'
      AND lower(so.mime_type) LIKE 'image/%'
  );

  v_system := EXISTS (
    SELECT 1
    FROM public.installed_systems isy
    WHERE isy.org_id = NEW.org_id
      AND (isy.job_id = NEW.id OR NEW.id::text = ANY (isy.linked_workflow_ids))
  );

  -- The crew's "no system installed" attestation (migration 20261126800000)
  -- satisfies the installed-system gate the same way a system record does.
  v_system := v_system OR coalesce(NEW.no_system_installed, false);

  BEGIN
    SELECT a.description::jsonb
      INTO v_qa
      FROM public.job_activity a
      WHERE a.job_id = NEW.id
        AND a.type = 'qa'
      ORDER BY a.created_at DESC
      LIMIT 1;

    -- Startup verification is excused when install gates do not apply
    -- (prep / rough-in visit) OR when the crew attested that no system
    -- was installed — nothing installed means nothing was started up.
    -- Safety review + work area cleaned are always required.
    IF v_requires_install AND NOT coalesce(NEW.no_system_installed, false) THEN
      v_qa_ok :=
           coalesce((v_qa ->> 'startupVerificationComplete')::boolean, false)
       AND coalesce((v_qa ->> 'safetyReviewComplete')::boolean, false)
       AND coalesce((v_qa ->> 'workAreaCleaned')::boolean, false);
    ELSE
      v_qa_ok :=
           coalesce((v_qa ->> 'safetyReviewComplete')::boolean, false)
       AND coalesce((v_qa ->> 'workAreaCleaned')::boolean, false);
    END IF;
  EXCEPTION
    WHEN others THEN
      v_qa_ok := false;
  END;

  IF NOT (
       v_photo
   AND (NOT v_requires_install OR v_system)
   AND v_note
   AND v_qa_ok
  ) THEN
    IF NOT v_photo THEN v_missing := v_missing || 'missing at least one photo'; END IF;
    IF v_requires_install AND NOT v_system THEN
      v_missing := v_missing || 'missing installed systems';
    END IF;
    IF NOT v_note THEN v_missing := v_missing || 'missing job notes'; END IF;
    IF NOT v_qa_ok THEN v_missing := v_missing || 'incomplete required QA items'; END IF;
    RAISE EXCEPTION 'Cannot complete job — %.', array_to_string(v_missing, ', ')
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;
