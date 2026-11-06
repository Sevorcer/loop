-- =============================================================================
-- Migration — Let technicians set the "no system installed" attestation
--
-- Bug: a technician ticking "No system was installed on this job" on the
-- closeout checklist got "Technicians can only change job status, not other
-- job fields". The attestation (jobs.no_system_installed, _by, _at, migration
-- 20261126800000) was added after the S1 allowlist guard
-- (20261103000000_tech_job_update_allowlist.sql), which locks every column
-- except status for technicians. The API and UI allow every role to attest,
-- so the trigger refused a write the product intends.
--
-- Fix: keep the allowlist, and exempt exactly the three attestation columns,
-- with an integrity rule so a technician cannot forge someone else's name:
--   - attesting (no_system_installed = true) must stamp _by = the caller
--     (auth.uid()) and a non-null _at;
--   - clearing must null both _by and _at.
-- Every other column stays locked for technicians, including future ones.
-- Non-technician roles are unaffected (the function returns early for them).
--
-- UP:
--   - Replace public.guard_tech_job_update() (same trigger binding).
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   -- Re-apply public.guard_tech_job_update() exactly as defined in
--   -- 20261103000000_tech_job_update_allowlist.sql. That makes the attestation
--   -- office-only again.
-- =============================================================================

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

  -- "No system installed" attestation: any role may set or clear it, but the
  -- stamp must be honest (the caller, not another user).
  IF NEW.no_system_installed IS DISTINCT FROM OLD.no_system_installed
     OR NEW.no_system_installed_by IS DISTINCT FROM OLD.no_system_installed_by
     OR NEW.no_system_installed_at IS DISTINCT FROM OLD.no_system_installed_at THEN
    IF NEW.no_system_installed IS TRUE THEN
      IF NEW.no_system_installed_by IS DISTINCT FROM auth.uid()
         OR NEW.no_system_installed_at IS NULL THEN
        RAISE EXCEPTION
          'The no-system attestation must be stamped with the person setting it'
          USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.no_system_installed_by IS NOT NULL
          OR NEW.no_system_installed_at IS NOT NULL THEN
      RAISE EXCEPTION
        'Clearing the no-system attestation must also clear its stamp'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Allowlist: the whole row, minus status, updated_at and the attestation
  -- columns checked above, must be unchanged. A column added to `jobs` later
  -- is locked for technicians by default.
  IF (to_jsonb(NEW) - 'status' - 'updated_at'
        - 'no_system_installed' - 'no_system_installed_by' - 'no_system_installed_at')
       IS DISTINCT FROM
     (to_jsonb(OLD) - 'status' - 'updated_at'
        - 'no_system_installed' - 'no_system_installed_by' - 'no_system_installed_at') THEN
    RAISE EXCEPTION
      'Technicians can only change job status, not other job fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Idempotent re-bind, same as the migration this replaces.
DROP TRIGGER IF EXISTS guard_tech_job_update ON public.jobs;
CREATE TRIGGER guard_tech_job_update
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_tech_job_update();
