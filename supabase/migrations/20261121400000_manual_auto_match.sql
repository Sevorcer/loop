-- Migration: manual_auto_match (#8 Copilot auto-match of manuals)
--
-- public.record_manual_auto_match(system_id, matches jsonb) stores Copilot's
-- model-level manual matches for ONE installed system:
--   auto_linked — confidence >= 0.90 (the app threshold can only be stricter)
--   suggested   — 0.60 <= confidence < 0.90
-- Brand-only guesses (< 0.60) are never stored; they stay live suggestions.
--
-- Why a SECURITY DEFINER function: equipment is often entered by a tech,
-- and techs must not write installed_system_manuals directly (RLS keeps that
-- office-only). The function is the one narrow path for Copilot rows:
--   * caller must be owner/manager/dispatch/office/tech in the system's org;
--     a tech only for systems they could edit (no job, or a job they are
--     assigned to — same rule as "installed_systems: tech updates field equipment")
--   * every manual must be an ACTIVE drive_manual_files row in the same org
--   * only model_exact / model_family kinds, confidence bounds enforced here
--   * NEVER overwrites an office decision (confirmed / rejected rows win)
--   * replaces this system's previous Copilot rows (e.g. after a model edit)
-- Rows are written with source = 'copilot'; decided_by = the caller (trigger).
--
-- Depends on 20261121300000_installed_system_manuals.sql.
-- NOT APPLIED. Apply via the Supabase SQL editor after review, then run
-- 20261121400000_manual_auto_match.verify.sql.
--
-- DOWN (manual):
--   DROP FUNCTION IF EXISTS public.record_manual_auto_match(uuid, jsonb);

BEGIN;

CREATE OR REPLACE FUNCTION public.record_manual_auto_match(p_system_id uuid, p_matches jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org    uuid := public.current_org_id();
  v_role   text := public.current_app_role();
  v_job    uuid;
  v_sys_org uuid;
  v_item   jsonb;
  v_manual uuid;
  v_status text;
  v_kind   text;
  v_conf   numeric;
  v_reason text;
  v_keep   uuid[] := '{}';
  v_count  integer := 0;
BEGIN
  IF v_org IS NULL OR v_role IS NULL
     OR v_role NOT IN ('owner', 'manager', 'dispatch', 'office', 'tech') THEN
    RAISE EXCEPTION 'Not allowed to record manual matches' USING ERRCODE = '42501';
  END IF;

  SELECT s.org_id, s.job_id INTO v_sys_org, v_job
    FROM public.installed_systems AS s WHERE s.id = p_system_id;
  IF v_sys_org IS NULL OR v_sys_org <> v_org THEN
    RAISE EXCEPTION 'Installed system not found' USING ERRCODE = '42501';
  END IF;
  IF v_role = 'tech' AND v_job IS NOT NULL AND NOT private.caller_is_assigned_to_job(v_job) THEN
    RAISE EXCEPTION 'Technicians can only match equipment on their own jobs' USING ERRCODE = '42501';
  END IF;

  IF p_matches IS NULL OR jsonb_typeof(p_matches) <> 'array' THEN
    RAISE EXCEPTION 'matches must be a JSON array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_matches) > 20 THEN
    RAISE EXCEPTION 'too many matches (max 20)' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_matches) LOOP
    v_manual := (v_item->>'manual_id')::uuid;
    v_status := v_item->>'status';
    v_kind   := v_item->>'match_kind';
    v_conf   := (v_item->>'confidence')::numeric;
    v_reason := left(coalesce(v_item->>'reason', ''), 500);

    IF v_kind NOT IN ('model_exact', 'model_family') THEN
      RAISE EXCEPTION 'Only model-level matches are stored' USING ERRCODE = '22023';
    END IF;
    IF v_conf IS NULL OR v_conf < 0.6 OR v_conf > 1 THEN
      RAISE EXCEPTION 'confidence out of range' USING ERRCODE = '22023';
    END IF;
    IF v_status = 'auto_linked' AND v_conf < 0.9 THEN
      RAISE EXCEPTION 'auto_linked needs confidence >= 0.90' USING ERRCODE = '22023';
    END IF;
    IF v_status NOT IN ('auto_linked', 'suggested') THEN
      RAISE EXCEPTION 'status must be auto_linked or suggested' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.drive_manual_files AS f
       WHERE f.id = v_manual AND f.org_id = v_org AND f.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Manual not found' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.installed_system_manuals AS m
      (org_id, installed_system_id, manual_file_id, status, source, match_kind, confidence, reason)
    VALUES (v_org, p_system_id, v_manual, v_status, 'copilot', v_kind, round(v_conf, 3), v_reason)
    ON CONFLICT (installed_system_id, manual_file_id) DO UPDATE
      SET status = EXCLUDED.status,
          match_kind = EXCLUDED.match_kind,
          confidence = EXCLUDED.confidence,
          reason = EXCLUDED.reason
      WHERE m.source = 'copilot';

    v_keep := v_keep || v_manual;
    v_count := v_count + 1;
  END LOOP;

  -- Drop this system's stale Copilot rows (office decisions are untouched).
  DELETE FROM public.installed_system_manuals AS m
   WHERE m.installed_system_id = p_system_id
     AND m.source = 'copilot'
     AND NOT (m.manual_file_id = ANY (v_keep));

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_manual_auto_match(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_manual_auto_match(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.record_manual_auto_match(uuid, jsonb) IS
  '#8 Copilot: store model-level manual matches for one installed system (never overrides office decisions).';

COMMIT;
