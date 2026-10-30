-- People on jobs, a completion snapshot, and calendar-task security.
--
-- Dispatch stops treating a crew as the thing you assign. The people on a
-- job stay in job_assignees. Existing crew rows are left in place. Where a
-- dispatch plan still points at a crew, the crew's member names are copied
-- onto the job when they match a user in the same company, so the schedule
-- is not emptied.
--
-- The first time a job becomes Completed, the people on it are copied into
-- job_completion_team and left there if someone is moved later.
--
-- public.tech_can_see_calendar_task was SECURITY DEFINER in the exposed
-- public schema. It now lives in private, which the Data API does not
-- expose, and anon/public cannot execute it. A tech who marks a calendar
-- task done always gets done_by = auth.uid(), ignoring a client-supplied id.
--
-- DOWN
--   DROP TRIGGER IF EXISTS snapshot_job_completion_team ON public.jobs;
--   DROP FUNCTION IF EXISTS private.snapshot_job_completion_team();
--   DROP TABLE IF EXISTS public.job_completion_team;
--   DROP TRIGGER IF EXISTS guard_tech_calendar_task_update ON public.calendar_tasks;
--   Recreate public.guard_tech_calendar_task_update and
--   public.tech_can_see_calendar_task from
--   20261030220000_time_off_and_calendar_tasks.sql, point the trigger and
--   the tech policies back at those public functions, then
--   DROP FUNCTION IF EXISTS private.guard_tech_calendar_task_update();
--   DROP FUNCTION IF EXISTS private.tech_can_see_calendar_task(uuid);
--   Crew rows and job_assignees rows added by the backfill can stay.

-- ---------------------------------------------------------------------------
-- private schema for helper functions the Data API must not expose
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA private
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- calendar task visibility, out of the exposed schema
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.tech_can_see_calendar_task(task uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $see$
  SELECT EXISTS (
    SELECT 1
    FROM public.calendar_tasks item
    WHERE item.id = task
      AND item.org_id = public.current_org_id()
      AND (
        item.assign_everyone
        OR EXISTS (
          SELECT 1
          FROM public.calendar_task_assignees assignee
          WHERE assignee.task_id = item.id
            AND assignee.user_id = auth.uid()
        )
      )
  );
$see$;

REVOKE ALL ON FUNCTION private.tech_can_see_calendar_task(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.tech_can_see_calendar_task(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION private.tech_can_see_calendar_task(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "calendar_task_assignees: tech reads visible" ON public.calendar_task_assignees;
CREATE POLICY "calendar_task_assignees: tech reads visible"
  ON public.calendar_task_assignees FOR SELECT
  USING (
    public.current_app_role() = 'tech'
    AND org_id = public.current_org_id()
    AND private.tech_can_see_calendar_task(task_id)
  );

DROP POLICY IF EXISTS "calendar_tasks: tech reads assigned" ON public.calendar_tasks;
CREATE POLICY "calendar_tasks: tech reads assigned"
  ON public.calendar_tasks FOR SELECT
  USING (
    public.current_app_role() = 'tech'
    AND org_id = public.current_org_id()
    AND private.tech_can_see_calendar_task(id)
  );

DROP POLICY IF EXISTS "calendar_tasks: tech marks done" ON public.calendar_tasks;
CREATE POLICY "calendar_tasks: tech marks done"
  ON public.calendar_tasks FOR UPDATE
  USING (
    public.current_app_role() = 'tech'
    AND org_id = public.current_org_id()
    AND private.tech_can_see_calendar_task(id)
  )
  WITH CHECK (
    public.current_app_role() = 'tech'
    AND org_id = public.current_org_id()
    AND private.tech_can_see_calendar_task(id)
  );

-- A tech may set done_at and nothing else. done_by is always the signed-in
-- user, never an id sent by the client.
CREATE OR REPLACE FUNCTION private.guard_tech_calendar_task_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $guard$
BEGIN
  IF public.current_app_role() = 'tech' THEN
    IF NEW.title IS DISTINCT FROM OLD.title
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
      OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
      OR NEW.all_day IS DISTINCT FROM OLD.all_day
      OR NEW.assign_everyone IS DISTINCT FROM OLD.assign_everyone
      OR NEW.job_id IS DISTINCT FROM OLD.job_id
      OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
      OR NEW.org_id IS DISTINCT FROM OLD.org_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'techs may only mark a calendar task done';
    END IF;
    IF NEW.done_at IS NULL THEN
      NEW.done_by := NULL;
    ELSE
      NEW.done_by := auth.uid();
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$guard$;

REVOKE ALL ON FUNCTION private.guard_tech_calendar_task_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.guard_tech_calendar_task_update() FROM anon;
GRANT EXECUTE ON FUNCTION private.guard_tech_calendar_task_update() TO authenticated, service_role;

DROP TRIGGER IF EXISTS guard_tech_calendar_task_update ON public.calendar_tasks;
CREATE TRIGGER guard_tech_calendar_task_update
  BEFORE UPDATE ON public.calendar_tasks
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_tech_calendar_task_update();

DROP FUNCTION IF EXISTS public.tech_can_see_calendar_task(uuid);
DROP FUNCTION IF EXISTS public.guard_tech_calendar_task_update();

-- ---------------------------------------------------------------------------
-- who was on the job when it was completed
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_completion_team (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.organizations(id),
  job_id       uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  person_name  text NOT NULL CHECK (char_length(btrim(person_name)) > 0),
  captured_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_completion_team_org_job_idx
  ON public.job_completion_team (org_id, job_id);

CREATE INDEX IF NOT EXISTS job_completion_team_user_idx
  ON public.job_completion_team (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS job_completion_team_job_user_uidx
  ON public.job_completion_team (job_id, user_id)
  WHERE user_id IS NOT NULL;

-- Policies are added after the backfill so the migration can copy history
-- before row security is forced.
DROP POLICY IF EXISTS "job_completion_team: read" ON public.job_completion_team;
CREATE POLICY "job_completion_team: read"
  ON public.job_completion_team FOR SELECT
  USING (
    org_id = public.current_org_id()
    AND (
      public.current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
      OR (
        public.current_app_role() = 'tech'
        AND (
          user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.jobs job
            WHERE job.id = job_completion_team.job_id
              AND job.org_id = job_completion_team.org_id
              AND (
                job.assigned_user_id = auth.uid()
                OR EXISTS (
                  SELECT 1
                  FROM public.job_assignees assignee
                  WHERE assignee.job_id = job.id
                    AND assignee.user_id = auth.uid()
                )
              )
          )
        )
      )
    )
  );

CREATE OR REPLACE FUNCTION private.snapshot_job_completion_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $snap$
BEGIN
  IF NEW.status = 'Completed'
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'Completed')
    AND NOT EXISTS (
      SELECT 1 FROM public.job_completion_team existing WHERE existing.job_id = NEW.id
    )
  THEN
    INSERT INTO public.job_completion_team (org_id, job_id, user_id, person_name)
    SELECT
      NEW.org_id,
      NEW.id,
      assignee.user_id,
      COALESCE(
        NULLIF(btrim(profile.full_name), ''),
        NULLIF(btrim(profile.email), ''),
        'Team member'
      )
    FROM public.job_assignees assignee
    LEFT JOIN public.user_profiles profile ON profile.id = assignee.user_id
    WHERE assignee.job_id = NEW.id;

    IF NOT FOUND AND btrim(COALESCE(NEW.assigned_to, '')) <> '' THEN
      INSERT INTO public.job_completion_team (org_id, job_id, user_id, person_name)
      SELECT NEW.org_id, NEW.id, NULL, btrim(part)
      FROM regexp_split_to_table(replace(NEW.assigned_to, '+', ','), '\s*,\s*') AS part
      WHERE btrim(part) <> '';
    END IF;
  END IF;
  RETURN NEW;
END;
$snap$;

REVOKE ALL ON FUNCTION private.snapshot_job_completion_team() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.snapshot_job_completion_team() FROM anon;
GRANT EXECUTE ON FUNCTION private.snapshot_job_completion_team() TO authenticated, service_role;

DROP TRIGGER IF EXISTS snapshot_job_completion_team ON public.jobs;
CREATE TRIGGER snapshot_job_completion_team
  AFTER INSERT OR UPDATE OF status ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION private.snapshot_job_completion_team();

-- ---------------------------------------------------------------------------
-- copy the current crew's people onto the job, without deleting crews
-- ---------------------------------------------------------------------------

WITH latest AS (
  SELECT DISTINCT ON (assignment.job_id)
    assignment.org_id,
    assignment.job_id,
    assignment.crew_id,
    assignment.lead_installer,
    assignment.supporting_technicians
  FROM public.crew_assignments assignment
  WHERE assignment.job_id IS NOT NULL
    AND assignment.status IS DISTINCT FROM 'released'
  ORDER BY assignment.job_id, assignment.assigned_at DESC, assignment.created_at DESC
),
crew_names AS (
  SELECT latest.org_id, latest.job_id, btrim(latest.lead_installer) AS person_name
  FROM latest
  WHERE btrim(latest.lead_installer) <> ''
  UNION
  SELECT latest.org_id, latest.job_id, btrim(name) AS person_name
  FROM latest
  CROSS JOIN LATERAL unnest(latest.supporting_technicians) AS name
  WHERE btrim(name) <> ''
  UNION
  SELECT latest.org_id, latest.job_id, btrim(member->>'name') AS person_name
  FROM latest
  JOIN public.crews crew ON crew.id = latest.crew_id
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(crew.members) = 'array' THEN crew.members
      ELSE '[]'::jsonb
    END
  ) AS member
  WHERE jsonb_typeof(member) = 'object'
    AND btrim(COALESCE(member->>'name', '')) <> ''
)
INSERT INTO public.job_assignees (job_id, user_id, org_id)
SELECT DISTINCT names.job_id, profile.id, names.org_id
FROM crew_names names
JOIN public.user_profiles profile
  ON profile.org_id = names.org_id
 AND lower(btrim(profile.full_name)) = lower(names.person_name)
ON CONFLICT (job_id, user_id) DO NOTHING;

UPDATE public.jobs job
SET assigned_user_id = picked.user_id
FROM (
  SELECT DISTINCT ON (assignee.job_id) assignee.job_id, assignee.user_id
  FROM public.job_assignees assignee
  ORDER BY assignee.job_id, assignee.created_at, assignee.user_id
) picked
WHERE job.id = picked.job_id
  AND job.assigned_user_id IS NULL;

UPDATE public.jobs job
SET assigned_to = labels.label
FROM (
  SELECT
    assignee.job_id,
    string_agg(
      COALESCE(NULLIF(btrim(profile.full_name), ''), NULLIF(btrim(profile.email), ''), 'Team member'),
      ' + '
      ORDER BY lower(COALESCE(profile.full_name, profile.email, ''))
    ) AS label
  FROM public.job_assignees assignee
  LEFT JOIN public.user_profiles profile ON profile.id = assignee.user_id
  GROUP BY assignee.job_id
) labels
WHERE job.id = labels.job_id
  AND labels.label IS NOT NULL
  AND (
    btrim(COALESCE(job.assigned_to, '')) = ''
    OR EXISTS (
      SELECT 1
      FROM public.crew_assignments assignment
      WHERE assignment.job_id = job.id
        AND (
          lower(btrim(job.assigned_to)) = lower(btrim(assignment.crew_name))
          OR lower(btrim(job.assigned_to)) = lower(btrim(assignment.lead_installer))
        )
    )
  );

-- Jobs already completed are snapshotted from whoever is on them now.
-- Earlier reassignment was not stored, so this is the best record we have.
INSERT INTO public.job_completion_team (org_id, job_id, user_id, person_name)
SELECT
  job.org_id,
  job.id,
  assignee.user_id,
  COALESCE(
    NULLIF(btrim(profile.full_name), ''),
    NULLIF(btrim(profile.email), ''),
    'Team member'
  )
FROM public.jobs job
JOIN public.job_assignees assignee ON assignee.job_id = job.id
LEFT JOIN public.user_profiles profile ON profile.id = assignee.user_id
WHERE job.status = 'Completed'
  AND NOT EXISTS (
    SELECT 1 FROM public.job_completion_team existing WHERE existing.job_id = job.id
  );

INSERT INTO public.job_completion_team (org_id, job_id, user_id, person_name)
SELECT job.org_id, job.id, NULL, btrim(part)
FROM public.jobs job
CROSS JOIN LATERAL regexp_split_to_table(replace(job.assigned_to, '+', ','), '\s*,\s*') AS part
WHERE job.status = 'Completed'
  AND btrim(COALESCE(job.assigned_to, '')) <> ''
  AND btrim(part) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.job_completion_team existing WHERE existing.job_id = job.id
  );

ALTER TABLE public.job_completion_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_completion_team FORCE ROW LEVEL SECURITY;
