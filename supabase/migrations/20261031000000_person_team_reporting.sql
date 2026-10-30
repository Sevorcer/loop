-- Person and team reporting, plus shared calendar groups.
--
-- LOOP has no invoices, line items, or job totals. job_financials is an empty
-- place to store a job's revenue in cents when that data exists. It does not
-- copy or invent amounts. Only the owner, a manager, and office staff can
-- read or write it. Technicians, dispatch, and sales are not granted a policy.
--
-- Saved calendar groups are the person filters the office shares. The
-- browser still remembers which people one user has selected. Technicians
-- are not granted a policy, so they cannot read the groups.
--
-- This migration does not update or delete existing rows.
--
-- DOWN
--   DROP TABLE IF EXISTS public.calendar_saved_group_members;
--   DROP TABLE IF EXISTS public.calendar_saved_groups;
--   DROP TABLE IF EXISTS public.job_financials;

-- ---------------------------------------------------------------------------
-- job revenue, separate from the job row so technicians cannot read it
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_financials (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id),
  job_id         uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  revenue_cents  bigint CHECK (revenue_cents IS NULL OR revenue_cents >= 0),
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
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "job_financials: finance insert" ON public.job_financials;
CREATE POLICY "job_financials: finance insert"
  ON public.job_financials FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "job_financials: finance update" ON public.job_financials;
CREATE POLICY "job_financials: finance update"
  ON public.job_financials FOR UPDATE
  USING (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "job_financials: finance delete" ON public.job_financials;
CREATE POLICY "job_financials: finance delete"
  ON public.job_financials FOR DELETE
  USING (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

REVOKE ALL ON TABLE public.job_financials FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_financials TO authenticated, service_role;

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
