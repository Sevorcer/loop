-- Job bids: per-job bid record with amount, status, optional file attachment,
-- and history tracking. Part of the Money Layer.
--
-- One "current" bid per job (is_current = true). When a new bid is inserted
-- the application layer sets the previous current bid's is_current to false.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_bids (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id),
  job_id      uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL,
  status      text NOT NULL CHECK (status IN ('draft', 'sent', 'accepted', 'declined')),
  file_id     uuid,
  is_current  boolean NOT NULL DEFAULT true,
  notes       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid
);

CREATE INDEX IF NOT EXISTS job_bids_org_job_current_idx
  ON public.job_bids (org_id, job_id, is_current);

-- ---------------------------------------------------------------------------
-- Same-company trigger (reuses the existing enforcer)
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS job_bids_same_company ON public.job_bids;
CREATE TRIGGER job_bids_same_company
  BEFORE INSERT OR UPDATE ON public.job_bids
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_sf_record_same_company();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

ALTER TABLE public.job_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_bids FORCE ROW LEVEL SECURITY;

-- Read: owner, manager, dispatch, office, sales
DROP POLICY IF EXISTS "job_bids: read for money roles" ON public.job_bids;
CREATE POLICY "job_bids: read for money roles"
  ON public.job_bids FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
  );

-- Insert: owner, manager, office
DROP POLICY IF EXISTS "job_bids: insert for office+" ON public.job_bids;
CREATE POLICY "job_bids: insert for office+"
  ON public.job_bids FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

-- Update: owner, manager, office
DROP POLICY IF EXISTS "job_bids: update for office+" ON public.job_bids;
CREATE POLICY "job_bids: update for office+"
  ON public.job_bids FOR UPDATE
  USING (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

-- Delete: owner only
DROP POLICY IF EXISTS "job_bids: delete for owner" ON public.job_bids;
CREATE POLICY "job_bids: delete for owner"
  ON public.job_bids FOR DELETE
  USING (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );
