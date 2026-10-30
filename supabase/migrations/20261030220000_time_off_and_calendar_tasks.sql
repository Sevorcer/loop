-- Time off and standalone calendar tasks.
--
-- Time off is a person being unavailable (sick, a regular day off, vacation).
-- Calendar tasks are reminders that are not jobs (an inspection wait, an
-- errand, a note for the crew). Both are org-scoped.
--
-- Office roles (owner, manager, dispatch, office) create and change them.
-- A technician can read their own time off and cannot change it. A technician
-- can read a task assigned to them, or a task assigned to everyone, and may
-- only mark that task done. A trigger rejects any other change from a tech.
--
-- DOWN
--   DROP TRIGGER IF EXISTS guard_tech_calendar_task_update ON public.calendar_tasks;
--   DROP FUNCTION IF EXISTS public.guard_tech_calendar_task_update();
--   DROP FUNCTION IF EXISTS public.tech_can_see_calendar_task(uuid);
--   DROP TABLE IF EXISTS public.calendar_task_assignees;
--   DROP TABLE IF EXISTS public.calendar_tasks;
--   DROP TABLE IF EXISTS public.time_off;

-- ---------------------------------------------------------------------------
-- time_off
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.time_off (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id),
  user_id     uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  all_day     boolean NOT NULL DEFAULT false,
  reason      text NOT NULL CHECK (char_length(btrim(reason)) > 0),
  note        text NOT NULL DEFAULT '',
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_off_ends_after_start CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS time_off_org_window_idx
  ON public.time_off (org_id, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS time_off_user_idx
  ON public.time_off (org_id, user_id);

ALTER TABLE public.time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_off FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time_off: office read" ON public.time_off;
CREATE POLICY "time_off: office read"
  ON public.time_off FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "time_off: tech reads own" ON public.time_off;
CREATE POLICY "time_off: tech reads own"
  ON public.time_off FOR SELECT
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "time_off: office insert" ON public.time_off;
CREATE POLICY "time_off: office insert"
  ON public.time_off FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "time_off: office update" ON public.time_off;
CREATE POLICY "time_off: office update"
  ON public.time_off FOR UPDATE
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "time_off: office delete" ON public.time_off;
CREATE POLICY "time_off: office delete"
  ON public.time_off FOR DELETE
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

-- ---------------------------------------------------------------------------
-- calendar_tasks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.calendar_tasks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id),
  title            text NOT NULL CHECK (char_length(btrim(title)) > 0),
  description      text NOT NULL DEFAULT '',
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  all_day          boolean NOT NULL DEFAULT false,
  assign_everyone  boolean NOT NULL DEFAULT false,
  job_id           uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  customer_id      uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  done_at          timestamptz,
  done_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_tasks_ends_after_start CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS calendar_tasks_org_window_idx
  ON public.calendar_tasks (org_id, starts_at, ends_at);

ALTER TABLE public.calendar_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_tasks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_tasks: office read" ON public.calendar_tasks;
CREATE POLICY "calendar_tasks: office read"
  ON public.calendar_tasks FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "calendar_tasks: office insert" ON public.calendar_tasks;
CREATE POLICY "calendar_tasks: office insert"
  ON public.calendar_tasks FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "calendar_tasks: office update" ON public.calendar_tasks;
CREATE POLICY "calendar_tasks: office update"
  ON public.calendar_tasks FOR UPDATE
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "calendar_tasks: office delete" ON public.calendar_tasks;
CREATE POLICY "calendar_tasks: office delete"
  ON public.calendar_tasks FOR DELETE
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

-- A tech may set done_at / done_by and nothing else.
CREATE OR REPLACE FUNCTION public.guard_tech_calendar_task_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_app_role() = 'tech' THEN
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
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_tech_calendar_task_update ON public.calendar_tasks;
CREATE TRIGGER guard_tech_calendar_task_update
  BEFORE UPDATE ON public.calendar_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_tech_calendar_task_update();

-- ---------------------------------------------------------------------------
-- calendar_task_assignees
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.calendar_task_assignees (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id),
  task_id     uuid NOT NULL REFERENCES public.calendar_tasks(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS calendar_task_assignees_user_idx
  ON public.calendar_task_assignees (org_id, user_id);

ALTER TABLE public.calendar_task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_task_assignees FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_task_assignees: office all" ON public.calendar_task_assignees;
CREATE POLICY "calendar_task_assignees: office all"
  ON public.calendar_task_assignees FOR ALL
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

-- Avoids RLS recursion between tasks and assignees. Returns true only for
-- the signed-in tech, and only inside their org.
CREATE OR REPLACE FUNCTION public.tech_can_see_calendar_task(task uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.calendar_tasks item
    WHERE item.id = task
      AND item.org_id = current_org_id()
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
$$;

-- A tech can read every assignee on a task they are allowed to see, so the
-- card can list the names. They cannot add or remove people.
DROP POLICY IF EXISTS "calendar_task_assignees: tech reads visible" ON public.calendar_task_assignees;
CREATE POLICY "calendar_task_assignees: tech reads visible"
  ON public.calendar_task_assignees FOR SELECT
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND public.tech_can_see_calendar_task(task_id)
  );

DROP POLICY IF EXISTS "calendar_tasks: tech reads assigned" ON public.calendar_tasks;
CREATE POLICY "calendar_tasks: tech reads assigned"
  ON public.calendar_tasks FOR SELECT
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND public.tech_can_see_calendar_task(id)
  );

DROP POLICY IF EXISTS "calendar_tasks: tech marks done" ON public.calendar_tasks;
CREATE POLICY "calendar_tasks: tech marks done"
  ON public.calendar_tasks FOR UPDATE
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND public.tech_can_see_calendar_task(id)
  )
  WITH CHECK (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND public.tech_can_see_calendar_task(id)
  );
