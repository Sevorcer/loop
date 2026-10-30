-- One dispatch plan per job, and append-only job notes.
--
-- Dispatch plans were created once per calendar day in a job's start/end
-- range. A same-day Pacific appointment whose end falls on the next UTC date
-- (2:00–5:00 PM Pacific is 21:00–00:00 UTC) got two plans. The board then
-- draws every plan for a job onto that job's company day, so the copies show
-- up as duplicate cards and as a crew overlap with themselves.
--
-- This migration keeps a single plan per job: the one whose target_date is
-- the job's company start day in America/Los_Angeles (the same zone as
-- src/lib/timezone.ts), otherwise the newest plan. Every other plan for that
-- job is deleted. schedule_blocks, crew_assignments, and dispatch_events
-- reference dispatch_plans with ON DELETE CASCADE, so children of a deleted
-- plan go with it. Children of the kept plan are not touched.
--
-- At authoring time the only extra plans in production were:
--   JOB-1020 plan a9138ef0-f924-42d1-91ef-b7822cfac774 (target 2026-10-31).
--     Kept 59a57147-08f5-4f3c-9191-07e97bcf3699 (target 2026-10-30).
--   JOB-1010 plans 73d5ac26-3ae5-4d21-88c7-5e5b9c2f7264 (target 2026-10-01)
--     and 8e338df3-d75c-4c9d-a479-38e3d272d097 (target 2026-10-02).
--     Kept 4bf0dbc2-acc3-41fe-917a-f48666dd3a5c (target 2026-09-30).
-- None of those extra plans had schedule blocks, crew assignments, or
-- dispatch events. The DELETE is by the rule above, not by those ids, so a
-- plan created after this note is cleaned the same way.
--
-- Job notes move from the single jobs.notes column into job_notes, one row
-- per note, with author, role, and timestamp. Existing non-empty jobs.notes
-- text is copied into the first row. The column is left in place so nothing
-- is dropped from jobs. The copy prefers the latest note activity's author
-- and time when one exists; otherwise the author is "Earlier note".
--
-- UP:
--   - Delete extra dispatch_plans so each job has one plan
--   - Unique index on (org_id, job_id) where job_id is not null
--   - Create job_notes (append-only) and copy jobs.notes into it
--   - Let office insert job_activity, and let techs read/insert activity on
--     jobs they are assigned to via assigned_user_id or job_assignees
--
-- DOWN
--   The deleted dispatch_plans rows are not restored by rolling this file
--   back. Schema rollback only:
--   DROP INDEX IF EXISTS public.dispatch_plans_one_per_job_uidx;
--   DROP TABLE IF EXISTS public.job_notes;
--   DROP POLICY IF EXISTS "job_activity: insert for owner/manager/dispatch/office" ON public.job_activity;
--   CREATE POLICY "job_activity: insert for owner/manager/dispatch"
--     ON public.job_activity FOR INSERT
--     WITH CHECK (
--       current_app_role() IN ('owner','manager','dispatch')
--       AND org_id = current_org_id()
--     );
--   DROP POLICY IF EXISTS "job_activity: tech inserts on own assigned jobs" ON public.job_activity;
--   CREATE POLICY "job_activity: tech inserts on own assigned jobs"
--     ON public.job_activity FOR INSERT
--     WITH CHECK (
--       current_app_role() = 'tech'
--       AND org_id = current_org_id()
--       AND actor_id = auth.uid()
--       AND job_id IN (
--         SELECT id FROM public.jobs
--         WHERE assigned_user_id = auth.uid()
--           AND org_id = current_org_id()
--       )
--     );
--   DROP POLICY IF EXISTS "job_activity: tech reads own job activity" ON public.job_activity;
--   CREATE POLICY "job_activity: tech reads own job activity"
--     ON public.job_activity FOR SELECT
--     USING (
--       current_app_role() = 'tech'
--       AND org_id = current_org_id()
--       AND job_id IN (
--         SELECT id FROM public.jobs
--         WHERE assigned_user_id = auth.uid()
--           AND org_id = current_org_id()
--       )
--     );

-- ---------------------------------------------------------------------------
-- One plan per job
-- ---------------------------------------------------------------------------

WITH ranked AS (
  SELECT
    dp.id,
    row_number() OVER (
      PARTITION BY dp.org_id, dp.job_id
      ORDER BY
        CASE
          WHEN dp.target_date = COALESCE(
            (j.scheduled_start_at AT TIME ZONE 'America/Los_Angeles')::date,
            j.scheduled_for
          ) THEN 0
          ELSE 1
        END,
        dp.updated_at DESC,
        dp.created_at DESC,
        dp.id DESC
    ) AS rn
  FROM public.dispatch_plans dp
  JOIN public.jobs j ON j.id = dp.job_id
  WHERE dp.job_id IS NOT NULL
)
DELETE FROM public.dispatch_plans dp
USING ranked
WHERE dp.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS dispatch_plans_one_per_job_uidx
  ON public.dispatch_plans (org_id, job_id)
  WHERE job_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- job_notes — append-only history
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.organizations(id),
  job_id       uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  body         text NOT NULL CHECK (char_length(btrim(body)) > 0),
  author_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name  text NOT NULL DEFAULT '',
  author_role  text NOT NULL DEFAULT ''
               CHECK (author_role IN ('', 'owner', 'manager', 'dispatch', 'tech', 'office', 'sales')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_notes_org_job_created_idx
  ON public.job_notes (org_id, job_id, created_at DESC);

INSERT INTO public.job_notes (org_id, job_id, body, author_id, author_name, author_role, created_at)
SELECT
  j.org_id,
  j.id,
  btrim(j.notes),
  latest.actor_id,
  COALESCE(NULLIF(btrim(up.full_name), ''), 'Earlier note'),
  CASE
    WHEN up.app_role IN ('owner', 'manager', 'dispatch', 'tech', 'office', 'sales') THEN up.app_role
    ELSE ''
  END,
  COALESCE(latest.created_at, j.updated_at, j.created_at, now())
FROM public.jobs j
LEFT JOIN LATERAL (
  SELECT ja.actor_id, ja.created_at
  FROM public.job_activity ja
  WHERE ja.job_id = j.id
    AND ja.type = 'note'
  ORDER BY ja.created_at DESC
  LIMIT 1
) latest ON true
LEFT JOIN public.user_profiles up ON up.id = latest.actor_id
WHERE btrim(j.notes) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.job_notes existing WHERE existing.job_id = j.id
  );

ALTER TABLE public.job_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_notes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_notes: read for owner/manager/dispatch/office/sales" ON public.job_notes;
CREATE POLICY "job_notes: read for owner/manager/dispatch/office/sales"
  ON public.job_notes FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "job_notes: tech reads notes on assigned jobs" ON public.job_notes;
CREATE POLICY "job_notes: tech reads notes on assigned jobs"
  ON public.job_notes FOR SELECT
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND job_id IN (
      SELECT j.id
      FROM public.jobs j
      WHERE j.org_id = current_org_id()
        AND (
          j.assigned_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.job_assignees ja
            WHERE ja.job_id = j.id
              AND ja.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "job_notes: insert for owner/manager/dispatch/office" ON public.job_notes;
CREATE POLICY "job_notes: insert for owner/manager/dispatch/office"
  ON public.job_notes FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "job_notes: tech inserts on assigned jobs" ON public.job_notes;
CREATE POLICY "job_notes: tech inserts on assigned jobs"
  ON public.job_notes FOR INSERT
  WITH CHECK (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND author_id = auth.uid()
    AND job_id IN (
      SELECT j.id
      FROM public.jobs j
      WHERE j.org_id = current_org_id()
        AND (
          j.assigned_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.job_assignees ja
            WHERE ja.job_id = j.id
              AND ja.user_id = auth.uid()
          )
        )
    )
  );

-- No UPDATE or DELETE policies: notes are append-only.

-- ---------------------------------------------------------------------------
-- job_activity — office can record a note; techs follow job assignment scope
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "job_activity: insert for owner/manager/dispatch" ON public.job_activity;
DROP POLICY IF EXISTS "job_activity: insert for owner/manager/dispatch/office" ON public.job_activity;
CREATE POLICY "job_activity: insert for owner/manager/dispatch/office"
  ON public.job_activity FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "job_activity: tech reads own job activity" ON public.job_activity;
CREATE POLICY "job_activity: tech reads own job activity"
  ON public.job_activity FOR SELECT
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND job_id IN (
      SELECT j.id
      FROM public.jobs j
      WHERE j.org_id = current_org_id()
        AND (
          j.assigned_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.job_assignees ja
            WHERE ja.job_id = j.id
              AND ja.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "job_activity: tech inserts on own assigned jobs" ON public.job_activity;
CREATE POLICY "job_activity: tech inserts on own assigned jobs"
  ON public.job_activity FOR INSERT
  WITH CHECK (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND actor_id = auth.uid()
    AND job_id IN (
      SELECT j.id
      FROM public.jobs j
      WHERE j.org_id = current_org_id()
        AND (
          j.assigned_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.job_assignees ja
            WHERE ja.job_id = j.id
              AND ja.user_id = auth.uid()
          )
        )
    )
  );
