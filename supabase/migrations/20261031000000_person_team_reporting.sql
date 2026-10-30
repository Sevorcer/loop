-- Person and team reporting, plus shared calendar groups.
--
-- LOOP has no invoices or line items. job_financials stores the price the
-- office enters on the job, in cents. It does not copy or invent amounts.
-- Owner, manager, office, and dispatch can read and write a price for a job
-- in their company. A technician can read the price only on a job they are
-- assigned to, and cannot change it. Sales and portal users are not granted
-- a policy. updated_by records the last person to change the price. The job
-- timeline records who changed it and when, without the dollar amount.
--
-- Saved calendar groups are the person filters the office shares. The
-- browser still remembers which people one user has selected. Technicians
-- are not granted a policy, so they cannot read the groups.
--
-- This migration does not update or delete existing rows.
--
-- DOWN
--   DROP TRIGGER IF EXISTS calendar_group_member_same_company ON public.calendar_saved_group_members;
--   DROP TRIGGER IF EXISTS job_financials_history_same_company ON public.job_financials_history;
--   DROP TRIGGER IF EXISTS job_financials_same_company ON public.job_financials;
--   DROP FUNCTION IF EXISTS private.enforce_calendar_group_member_same_company();
--   DROP FUNCTION IF EXISTS private.enforce_job_price_same_company();
--   DROP TABLE IF EXISTS public.calendar_saved_group_members;
--   DROP TABLE IF EXISTS public.calendar_saved_groups;
--   DROP TABLE IF EXISTS public.job_financials_history;
--   DROP TABLE IF EXISTS public.job_financials;

-- ---------------------------------------------------------------------------
-- job revenue, separate from the job row so technicians cannot read it
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_financials (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id),
  job_id         uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  revenue_cents  bigint CHECK (revenue_cents IS NULL OR revenue_cents >= 0),
  updated_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_financials_job_uidx UNIQUE (job_id)
);

CREATE INDEX IF NOT EXISTS job_financials_org_idx
  ON public.job_financials (org_id);

ALTER TABLE public.job_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_financials FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_financials: finance read" ON public.job_financials;
CREATE POLICY "job_financials: finance read"
  ON public.job_financials FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1
      FROM public.jobs priced_job
      WHERE priced_job.id = job_id
        AND priced_job.org_id = org_id
    )
  );

DROP POLICY IF EXISTS "job_financials: finance insert" ON public.job_financials;
CREATE POLICY "job_financials: finance insert"
  ON public.job_financials FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1
      FROM public.jobs priced_job
      WHERE priced_job.id = job_id
        AND priced_job.org_id = org_id
    )
  );

DROP POLICY IF EXISTS "job_financials: finance update" ON public.job_financials;
CREATE POLICY "job_financials: finance update"
  ON public.job_financials FOR UPDATE
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1
      FROM public.jobs priced_job
      WHERE priced_job.id = job_id
        AND priced_job.org_id = org_id
    )
  );

DROP POLICY IF EXISTS "job_financials: finance delete" ON public.job_financials;
CREATE POLICY "job_financials: finance delete"
  ON public.job_financials FOR DELETE
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "job_financials: tech reads assigned" ON public.job_financials;
CREATE POLICY "job_financials: tech reads assigned"
  ON public.job_financials FOR SELECT
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1
      FROM public.jobs priced_job
      WHERE priced_job.id = job_id
        AND priced_job.org_id = org_id
        AND (
          priced_job.assigned_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.job_assignees assignee
            WHERE assignee.job_id = priced_job.id
              AND assignee.user_id = auth.uid()
          )
        )
    )
  );

REVOKE ALL ON TABLE public.job_financials FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_financials TO authenticated, service_role;

-- Amounts from earlier prices. The timeline text does not include them.
CREATE TABLE IF NOT EXISTS public.job_financials_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id),
  job_id           uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  previous_cents   bigint CHECK (previous_cents IS NULL OR previous_cents >= 0),
  revenue_cents    bigint CHECK (revenue_cents IS NULL OR revenue_cents >= 0),
  changed_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_financials_history_job_idx
  ON public.job_financials_history (org_id, job_id, changed_at);

ALTER TABLE public.job_financials_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_financials_history FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_financials_history: finance read" ON public.job_financials_history;
CREATE POLICY "job_financials_history: finance read"
  ON public.job_financials_history FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1
      FROM public.jobs priced_job
      WHERE priced_job.id = job_id
        AND priced_job.org_id = org_id
    )
  );

DROP POLICY IF EXISTS "job_financials_history: finance insert" ON public.job_financials_history;
CREATE POLICY "job_financials_history: finance insert"
  ON public.job_financials_history FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1
      FROM public.jobs priced_job
      WHERE priced_job.id = job_id
        AND priced_job.org_id = org_id
    )
  );

REVOKE ALL ON TABLE public.job_financials_history FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.job_financials_history TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- shared calendar person groups
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.calendar_saved_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id),
  name        text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_saved_groups_id_org_uidx UNIQUE (id, org_id)
);

CREATE INDEX IF NOT EXISTS calendar_saved_groups_org_name_idx
  ON public.calendar_saved_groups (org_id, name);

CREATE TABLE IF NOT EXISTS public.calendar_saved_group_members (
  group_id    uuid NOT NULL,
  org_id      uuid NOT NULL,
  user_id     uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id),
  CONSTRAINT calendar_saved_group_members_group_org_fk
    FOREIGN KEY (group_id, org_id)
    REFERENCES public.calendar_saved_groups (id, org_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS calendar_saved_group_members_org_idx
  ON public.calendar_saved_group_members (org_id, user_id);

ALTER TABLE public.calendar_saved_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_saved_groups FORCE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_saved_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_saved_group_members FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_saved_groups: office read" ON public.calendar_saved_groups;
CREATE POLICY "calendar_saved_groups: office read"
  ON public.calendar_saved_groups FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "calendar_saved_groups: office insert" ON public.calendar_saved_groups;
CREATE POLICY "calendar_saved_groups: office insert"
  ON public.calendar_saved_groups FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "calendar_saved_groups: office update" ON public.calendar_saved_groups;
CREATE POLICY "calendar_saved_groups: office update"
  ON public.calendar_saved_groups FOR UPDATE
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "calendar_saved_groups: office delete" ON public.calendar_saved_groups;
CREATE POLICY "calendar_saved_groups: office delete"
  ON public.calendar_saved_groups FOR DELETE
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "calendar_saved_group_members: office read" ON public.calendar_saved_group_members;
CREATE POLICY "calendar_saved_group_members: office read"
  ON public.calendar_saved_group_members FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "calendar_saved_group_members: office insert" ON public.calendar_saved_group_members;
CREATE POLICY "calendar_saved_group_members: office insert"
  ON public.calendar_saved_group_members FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles member_profile
      WHERE member_profile.id = user_id
        AND member_profile.org_id = org_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.calendar_saved_groups saved_group
      WHERE saved_group.id = group_id
        AND saved_group.org_id = org_id
    )
  );

DROP POLICY IF EXISTS "calendar_saved_group_members: office delete" ON public.calendar_saved_group_members;
CREATE POLICY "calendar_saved_group_members: office delete"
  ON public.calendar_saved_group_members FOR DELETE
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = current_org_id()
  );

REVOKE ALL ON TABLE public.calendar_saved_groups FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.calendar_saved_group_members FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.calendar_saved_groups TO authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.calendar_saved_group_members TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- same-company checks that still run when row security is bypassed
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.enforce_job_price_same_company()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs priced_job
    WHERE priced_job.id = NEW.job_id
      AND priced_job.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'job price must belong to a job in the same company';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_job_price_same_company() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.enforce_job_price_same_company() TO authenticated, service_role;

DROP TRIGGER IF EXISTS job_financials_same_company ON public.job_financials;
CREATE TRIGGER job_financials_same_company
  BEFORE INSERT OR UPDATE ON public.job_financials
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_job_price_same_company();

DROP TRIGGER IF EXISTS job_financials_history_same_company ON public.job_financials_history;
CREATE TRIGGER job_financials_history_same_company
  BEFORE INSERT OR UPDATE ON public.job_financials_history
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_job_price_same_company();

CREATE OR REPLACE FUNCTION private.enforce_calendar_group_member_same_company()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_profiles member_profile
    JOIN public.calendar_saved_groups saved_group
      ON saved_group.id = NEW.group_id
     AND saved_group.org_id = NEW.org_id
    WHERE member_profile.id = NEW.user_id
      AND member_profile.org_id = saved_group.org_id
  ) THEN
    RAISE EXCEPTION 'calendar group members must belong to the same company as the group';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_calendar_group_member_same_company() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.enforce_calendar_group_member_same_company() TO authenticated, service_role;

DROP TRIGGER IF EXISTS calendar_group_member_same_company ON public.calendar_saved_group_members;
CREATE TRIGGER calendar_group_member_same_company
  BEFORE INSERT OR UPDATE ON public.calendar_saved_group_members
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_calendar_group_member_same_company();

-- Price timeline rows keep the existing read policies. Dispatch reads them
-- with the rest of the company timeline. A technician reads them on assigned
-- jobs. The text stored there does not include a dollar amount.
