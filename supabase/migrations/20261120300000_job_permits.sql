-- Phase 3 Task 1: job_permits table for tracking permit lifecycle.
-- Mirrors Zowe's permit sheet columns. Safe to re-run (IF NOT EXISTS).
--
-- MUST be applied to the production database before deploying the code that
-- reads/writes job_permits (SQL editor in the Supabase dashboard).

-- ---------------------------------------------------------------------------
-- Permit status enum
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permit_status') THEN
    CREATE TYPE public.permit_status AS ENUM (
      'applied',
      'intake_scheduled',
      'corrections_needed',
      'resubmitted',
      'waiting_on_city',
      'issued'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_permits (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id),
  job_id                uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  jurisdiction          text NOT NULL,
  permit_type           text NOT NULL,
  permit_number         text,
  status                public.permit_status NOT NULL DEFAULT 'applied',
  applied_at            timestamptz,
  intake_appointment_at timestamptz,
  issued_at             timestamptz,
  corrections_notes     text,
  notes                 text,
  voided_at             timestamptz,
  voided_by             uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_permits_job_id_idx ON public.job_permits(job_id);
CREATE INDEX IF NOT EXISTS job_permits_org_id_idx ON public.job_permits(org_id);
CREATE INDEX IF NOT EXISTS job_permits_status_idx ON public.job_permits(status);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_permits FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Read: all internal operational roles (tech sees assigned-job permits only via RLS)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_permits'
      AND policyname = 'job_permits: read for internal roles'
  ) THEN
    CREATE POLICY "job_permits: read for internal roles"
      ON public.job_permits FOR SELECT
      USING (
        current_app_role() IN ('owner','manager','dispatch','office','sales','tech')
        AND org_id = current_org_id()
      );
  END IF;

  -- Insert: office and above
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_permits'
      AND policyname = 'job_permits: insert for office+'
  ) THEN
    CREATE POLICY "job_permits: insert for office+"
      ON public.job_permits FOR INSERT
      WITH CHECK (
        current_app_role() IN ('owner','manager','office')
        AND org_id = current_org_id()
      );
  END IF;

  -- Update: office and above
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_permits'
      AND policyname = 'job_permits: update for office+'
  ) THEN
    CREATE POLICY "job_permits: update for office+"
      ON public.job_permits FOR UPDATE
      USING (
        current_app_role() IN ('owner','manager','office')
        AND org_id = current_org_id()
      )
      WITH CHECK (
        current_app_role() IN ('owner','manager','office')
        AND org_id = current_org_id()
      );
  END IF;
END $$;

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION public.job_permits_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_permits_updated_at ON public.job_permits;
CREATE TRIGGER job_permits_updated_at
  BEFORE UPDATE ON public.job_permits
  FOR EACH ROW EXECUTE FUNCTION public.job_permits_set_updated_at();
