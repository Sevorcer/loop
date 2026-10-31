-- Lock who can change a role, and who can write staff records.
--
-- Does not update or delete any existing rows. Safe to run more than once.
--
-- Profiles are created when an owner or manager invites someone (the server
-- uses the service role). Public sign-up is a Supabase Auth dashboard
-- setting, not a migration: turn off "Allow new users to sign up" before
-- this is relied on. The app has no public sign-up screen.
--
-- DOWN
--   DROP TRIGGER IF EXISTS guard_user_profile_write ON public.user_profiles;
--   DROP TRIGGER IF EXISTS guard_tech_job_task_update ON public.job_tasks;
--   DROP TRIGGER IF EXISTS guard_tech_dispatch_plan_update ON public.dispatch_plans;
--   DROP FUNCTION IF EXISTS private.guard_user_profile_write();
--   DROP FUNCTION IF EXISTS private.guard_tech_job_task_update();
--   DROP FUNCTION IF EXISTS private.guard_tech_dispatch_plan_update();
--   DROP FUNCTION IF EXISTS private.caller_is_assigned_to_job(uuid);
--   Drop the policies created below and recreate the previous definitions
--   from 20260719000001, 20260930000002, 20260930000004, and 20260930000005.
--   Restoring those definitions re-opens the holes. Grant the previous
--   anon privileges on user_profiles only if you accept that too.
--   ALTER FUNCTION public.dbhc_null_org_id() RESET search_path;
--   (and the same RESET for dbhc_orphan_fk, dbhc_required_indexes,
--   dbhc_rls_coverage, dbhc_migration_count). Then GRANT EXECUTE on those
--   functions back to PUBLIC if the health checks must be callable by anon.

-- ---------------------------------------------------------------------------
-- user_profiles: anon has no access. A signed-in person may update their
-- own name. Role, company, id, and email are not writable with their login.
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE public.user_profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.user_profiles FROM anon;
REVOKE ALL ON TABLE public.user_profiles FROM authenticated;
-- Table-level INSERT/UPDATE would make a later column grant a no-op.
-- The signed-in app only writes full_name and updated_at. Nothing deletes
-- a profile with the user's own login (deactivation bans the auth user).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLE public.user_profiles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLE public.user_profiles FROM anon;
GRANT SELECT ON TABLE public.user_profiles TO authenticated;
GRANT UPDATE (full_name, updated_at) ON TABLE public.user_profiles TO authenticated;
GRANT ALL ON TABLE public.user_profiles TO service_role;

-- Dashboard policies that were never stored in a migration.
DROP POLICY IF EXISTS "insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "update own profile" ON public.user_profiles;
-- Role changes go through the service role after the settings route checks
-- the caller. This broad owner update policy is no longer the write path.
DROP POLICY IF EXISTS "user_profiles: owner can update" ON public.user_profiles;

DROP POLICY IF EXISTS "user_profiles: user updates own name" ON public.user_profiles;
CREATE POLICY "user_profiles: user updates own name"
  ON public.user_profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "user_profiles: manager can insert" ON public.user_profiles;
CREATE POLICY "user_profiles: manager can insert"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (
    current_app_role() = 'manager'
    AND org_id = current_org_id()
    AND id IS DISTINCT FROM auth.uid()
  );

DROP POLICY IF EXISTS "user_profiles: manager can update" ON public.user_profiles;
CREATE POLICY "user_profiles: manager can update"
  ON public.user_profiles
  FOR UPDATE
  USING (
    current_app_role() = 'manager'
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() = 'manager'
    AND org_id = current_org_id()
  );

-- The settings page changes a role with the service role, after it has
-- checked the caller. This trigger still refuses the dangerous cases when
-- someone talks to the database directly.
CREATE OR REPLACE FUNCTION private.guard_user_profile_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  role_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;
    IF NEW.id = auth.uid() THEN
      RAISE EXCEPTION 'Choosing your own role or company is denied'
        USING ERRCODE = '42501';
    END IF;
    IF public.current_app_role() NOT IN ('owner', 'manager')
       OR NEW.org_id IS DISTINCT FROM public.current_org_id() THEN
      RAISE EXCEPTION 'Adding a teammate is denied'
        USING ERRCODE = '42501';
    END IF;
    IF (
         NEW.app_role = 'owner'
         OR (to_jsonb(NEW) ? 'role' AND (to_jsonb(NEW) ->> 'role') = 'owner')
       )
       AND public.current_app_role() IS DISTINCT FROM 'owner' THEN
      RAISE EXCEPTION 'Only an owner can grant the owner role'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.org_id IS DISTINCT FROM OLD.org_id
  THEN
    RAISE EXCEPTION 'Changing id or company is denied'
      USING ERRCODE = '42501';
  END IF;

  -- A logged-in person cannot change email. The service role (no auth.uid())
  -- may, so a future change-email action is not blocked.
  IF auth.uid() IS NOT NULL
     AND to_jsonb(NEW) ? 'email'
     AND (to_jsonb(NEW) -> 'email') IS DISTINCT FROM (to_jsonb(OLD) -> 'email')
  THEN
    RAISE EXCEPTION 'Changing email is denied'
      USING ERRCODE = '42501';
  END IF;

  role_changed := NEW.app_role IS DISTINCT FROM OLD.app_role
    OR (
      to_jsonb(NEW) ? 'role'
      AND (to_jsonb(NEW) -> 'role') IS DISTINCT FROM (to_jsonb(OLD) -> 'role')
    );

  IF role_changed THEN
    IF auth.uid() IS NOT NULL THEN
      IF auth.uid() = OLD.id THEN
        RAISE EXCEPTION 'Changing your own role is denied'
          USING ERRCODE = '42501';
      END IF;
      IF public.current_app_role() NOT IN ('owner', 'manager')
         OR public.current_org_id() IS DISTINCT FROM OLD.org_id THEN
        RAISE EXCEPTION 'Changing another person''s role is denied'
          USING ERRCODE = '42501';
      END IF;
      IF public.current_app_role() IS DISTINCT FROM 'owner'
         AND (
           (OLD.app_role = 'owner' AND NEW.app_role IS DISTINCT FROM 'owner')
           OR (NEW.app_role = 'owner' AND OLD.app_role IS DISTINCT FROM 'owner')
           OR (
             to_jsonb(NEW) ? 'role'
             AND (to_jsonb(NEW) -> 'role') IS DISTINCT FROM (to_jsonb(OLD) -> 'role')
             AND (
               (to_jsonb(OLD) ->> 'role') = 'owner'
               OR (to_jsonb(NEW) ->> 'role') = 'owner'
             )
           )
         )
      THEN
        RAISE EXCEPTION 'Only an owner can grant or remove the owner role'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    IF OLD.app_role = 'owner' AND NEW.app_role IS DISTINCT FROM 'owner' THEN
      PERFORM 1
      FROM public.user_profiles AS profile
      WHERE profile.org_id = OLD.org_id
        AND profile.app_role = 'owner'
        AND profile.id <> OLD.id
      FOR UPDATE;

      IF (
        SELECT count(*)
        FROM public.user_profiles AS profile
        WHERE profile.org_id = OLD.org_id
          AND profile.app_role = 'owner'
          AND profile.id <> OLD.id
      ) = 0 THEN
        RAISE EXCEPTION 'Removing the last owner is denied'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_user_profile_write() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.guard_user_profile_write() FROM anon;
GRANT EXECUTE ON FUNCTION private.guard_user_profile_write() TO authenticated, service_role;

DROP TRIGGER IF EXISTS guard_user_profile_write ON public.user_profiles;
CREATE TRIGGER guard_user_profile_write
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_user_profile_write();

-- ---------------------------------------------------------------------------
-- True when the signed-in technician is on this job.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.caller_is_assigned_to_job(target_job uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT target_job IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.jobs AS assigned_job
      WHERE assigned_job.id = target_job
        AND assigned_job.org_id = public.current_org_id()
        AND (
          assigned_job.assigned_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.job_assignees AS assignee
            WHERE assignee.job_id = assigned_job.id
              AND assignee.user_id = auth.uid()
              AND assignee.org_id = public.current_org_id()
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION private.caller_is_assigned_to_job(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.caller_is_assigned_to_job(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION private.caller_is_assigned_to_job(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- job_assignees: only office roles may add or remove a person.
-- Sales does not create jobs or assign crews. Read is unchanged.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "job_assignees: org insert" ON public.job_assignees;
CREATE POLICY "job_assignees: org insert"
  ON public.job_assignees
  FOR INSERT
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner', 'manager', 'office', 'dispatch')
  );

DROP POLICY IF EXISTS "job_assignees: org delete" ON public.job_assignees;
CREATE POLICY "job_assignees: org delete"
  ON public.job_assignees
  FOR DELETE
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner', 'manager', 'office', 'dispatch')
  );

-- ---------------------------------------------------------------------------
-- job_tasks: the old "org all" policy is read-only now. The name stays so
-- earlier checks that look it up by name still find it.
-- Office roles write. A technician may only check off a task on a job
-- they are assigned to.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "job_tasks: org all" ON public.job_tasks;
CREATE POLICY "job_tasks: org all"
  ON public.job_tasks
  FOR SELECT
  USING (org_id = current_org_id());

DROP POLICY IF EXISTS "job_tasks: insert for owner/manager/office" ON public.job_tasks;
CREATE POLICY "job_tasks: insert for owner/manager/office"
  ON public.job_tasks
  FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office', 'dispatch')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "job_tasks: update for office roles" ON public.job_tasks;
CREATE POLICY "job_tasks: update for office roles"
  ON public.job_tasks
  FOR UPDATE
  USING (
    current_app_role() IN ('owner', 'manager', 'office', 'dispatch')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office', 'dispatch')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "job_tasks: delete for owner" ON public.job_tasks;
DROP POLICY IF EXISTS "job_tasks: delete for office roles" ON public.job_tasks;
CREATE POLICY "job_tasks: delete for office roles"
  ON public.job_tasks
  FOR DELETE
  USING (
    current_app_role() IN ('owner', 'manager', 'office', 'dispatch')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "job_tasks: tech updates tasks on assigned jobs" ON public.job_tasks;
CREATE POLICY "job_tasks: tech updates tasks on assigned jobs"
  ON public.job_tasks
  FOR UPDATE
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND private.caller_is_assigned_to_job(job_id)
  )
  WITH CHECK (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND private.caller_is_assigned_to_job(job_id)
  );

CREATE OR REPLACE FUNCTION private.guard_tech_job_task_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'tech' THEN
    RETURN NEW;
  END IF;

  IF to_jsonb(NEW) - 'is_done' - 'completed_at' - 'completed_by' - 'updated_at'
     IS DISTINCT FROM
     to_jsonb(OLD) - 'is_done' - 'completed_at' - 'completed_by' - 'updated_at'
  THEN
    RAISE EXCEPTION 'Technicians may only check a job task off'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.completed_by IS NOT NULL AND NEW.completed_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'A technician can only record their own name on a checklist item'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_tech_job_task_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.guard_tech_job_task_update() FROM anon;
GRANT EXECUTE ON FUNCTION private.guard_tech_job_task_update() TO authenticated, service_role;

DROP TRIGGER IF EXISTS guard_tech_job_task_update ON public.job_tasks;
CREATE TRIGGER guard_tech_job_task_update
  BEFORE UPDATE ON public.job_tasks
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_tech_job_task_update();

-- ---------------------------------------------------------------------------
-- dispatch_plans: office roles write the plan. A technician may only change
-- the status on a job they are assigned to (start / finish).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "dispatch_plans: org write" ON public.dispatch_plans;
CREATE POLICY "dispatch_plans: org write"
  ON public.dispatch_plans
  FOR ALL
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner', 'manager', 'office', 'dispatch')
  )
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner', 'manager', 'office', 'dispatch')
  );

DROP POLICY IF EXISTS "dispatch_plans: tech updates assigned job status" ON public.dispatch_plans;
CREATE POLICY "dispatch_plans: tech updates assigned job status"
  ON public.dispatch_plans
  FOR UPDATE
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND private.caller_is_assigned_to_job(job_id)
  )
  WITH CHECK (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND private.caller_is_assigned_to_job(job_id)
  );

CREATE OR REPLACE FUNCTION private.guard_tech_dispatch_plan_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'tech' THEN
    RETURN NEW;
  END IF;

  IF to_jsonb(NEW) - 'dispatch_status' - 'updated_at'
     IS DISTINCT FROM
     to_jsonb(OLD) - 'dispatch_status' - 'updated_at'
  THEN
    RAISE EXCEPTION 'Technicians may only update dispatch status'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_tech_dispatch_plan_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.guard_tech_dispatch_plan_update() FROM anon;
GRANT EXECUTE ON FUNCTION private.guard_tech_dispatch_plan_update() TO authenticated, service_role;

DROP TRIGGER IF EXISTS guard_tech_dispatch_plan_update ON public.dispatch_plans;
CREATE TRIGGER guard_tech_dispatch_plan_update
  BEFORE UPDATE ON public.dispatch_plans
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_tech_dispatch_plan_update();

-- ---------------------------------------------------------------------------
-- installed_systems: office roles write. A technician may record equipment
-- on a job they are assigned to, or a system that is not tied to a job.
-- They cannot delete a system.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "installed_systems: org write" ON public.installed_systems;
CREATE POLICY "installed_systems: org write"
  ON public.installed_systems
  FOR ALL
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner', 'manager', 'office', 'dispatch')
  )
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner', 'manager', 'office', 'dispatch')
  );

DROP POLICY IF EXISTS "installed_systems: tech inserts field equipment" ON public.installed_systems;
CREATE POLICY "installed_systems: tech inserts field equipment"
  ON public.installed_systems
  FOR INSERT
  WITH CHECK (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND (
      job_id IS NULL
      OR private.caller_is_assigned_to_job(job_id)
    )
  );

DROP POLICY IF EXISTS "installed_systems: tech updates field equipment" ON public.installed_systems;
CREATE POLICY "installed_systems: tech updates field equipment"
  ON public.installed_systems
  FOR UPDATE
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND (
      job_id IS NULL
      OR private.caller_is_assigned_to_job(job_id)
    )
  )
  WITH CHECK (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND (
      job_id IS NULL
      OR private.caller_is_assigned_to_job(job_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Health-check helpers are internal. Fix the search path and stop anon
-- from calling them. The app runs them with the service role.
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.dbhc_null_org_id() SET search_path = public;
ALTER FUNCTION public.dbhc_orphan_fk() SET search_path = public;
ALTER FUNCTION public.dbhc_required_indexes() SET search_path = public;
ALTER FUNCTION public.dbhc_rls_coverage() SET search_path = public;
ALTER FUNCTION public.dbhc_migration_count() SET search_path = public;

REVOKE ALL ON FUNCTION public.dbhc_null_org_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dbhc_orphan_fk() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dbhc_required_indexes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dbhc_rls_coverage() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dbhc_migration_count() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.dbhc_null_org_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.dbhc_orphan_fk() TO service_role;
GRANT EXECUTE ON FUNCTION public.dbhc_required_indexes() TO service_role;
GRANT EXECUTE ON FUNCTION public.dbhc_rls_coverage() TO service_role;
GRANT EXECUTE ON FUNCTION public.dbhc_migration_count() TO service_role;
