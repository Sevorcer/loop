-- =============================================================================
-- Migration — Technician job-update allowlist (closes closeout_mode tampering)
-- Security fix S1
--
-- The jobs API already blocks technicians from editing job details, but the
-- Supabase anon key ships in the browser, so a technician with their own
-- session can PATCH the `jobs` table directly and skip the API. The only
-- server-side guard on that path was `guard_tech_job_update`, which used a
-- DENYLIST of columns. When `closeout_mode` was added (2026-11-02) it was not
-- added to the denylist, so a technician could set `closeout_mode = 'visit'`
-- (and other unlisted columns) directly and self-certify a visit-mode
-- closeout with no photo, installed system, or QA.
--
-- This migration rewrites the guard as an ALLOWLIST: a technician may change
-- only `status` (the field workflow) — every other column, including any
-- column added to `jobs` in the future, is locked for technicians by default.
--
-- UP:
--   - Replace function public.guard_tech_job_update() with an allowlist check.
--   - Re-create the BEFORE UPDATE trigger that uses it (idempotent).
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   -- Restore the previous denylist implementation from
--   -- 20261030170000_tech_scope_and_dispatch_writes.sql, then:
--   --   DROP TRIGGER IF EXISTS guard_tech_job_update ON public.jobs;
--   --   CREATE TRIGGER guard_tech_job_update
--   --     BEFORE UPDATE ON public.jobs
--   --     FOR EACH ROW EXECUTE FUNCTION public.guard_tech_job_update();
-- =============================================================================

-- ---------------------------------------------------------------------------
-- guard_tech_job_update — allowlist
-- A technician may change only the job status. Cancelling stays office-only.
-- Everything else must be byte-for-byte unchanged.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_tech_job_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_app_role() IS DISTINCT FROM 'tech' THEN
    RETURN NEW;
  END IF;

  -- Technicians move a job through the field workflow
  -- (Scheduled -> In Progress -> Completed / On Hold). Cancelling is office-only.
  IF NEW.status = 'Cancelled' AND OLD.status IS DISTINCT FROM 'Cancelled' THEN
    RAISE EXCEPTION 'Technicians cannot cancel jobs' USING ERRCODE = '42501';
  END IF;

  -- Allowlist: the whole row, minus the status column and the updated_at
  -- bookkeeping column, must be unchanged. Comparing the row this way means a
  -- column added to `jobs` later is locked for technicians by default — a new
  -- field like closeout_mode can never silently become tech-writable again.
  IF (to_jsonb(NEW) - 'status' - 'updated_at')
       IS DISTINCT FROM
     (to_jsonb(OLD) - 'status' - 'updated_at') THEN
    RAISE EXCEPTION
      'Technicians can only change job status, not other job fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Re-create the trigger so this migration is self-contained if run in
-- isolation. CREATE OR REPLACE FUNCTION already updated the bound function.
DROP TRIGGER IF EXISTS guard_tech_job_update ON public.jobs;
CREATE TRIGGER guard_tech_job_update
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_tech_job_update();
