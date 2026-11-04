-- Phase 3 Task 2: job_inspections + inspection_corrections tables.
-- Inspections exist independently of permits (Collin's decision 7).
-- Safe to re-run (IF NOT EXISTS throughout).
--
-- MUST be applied to the production database before deploying the code that
-- reads/writes these tables (SQL editor in the Supabase dashboard).

-- ---------------------------------------------------------------------------
-- Inspection result enum
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inspection_result') THEN
    CREATE TYPE public.inspection_result AS ENUM (
      'scheduled',
      'passed',
      'failed',
      'partial',
      'rescheduled_by_city'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- job_inspections
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_inspections (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id),
  job_id                uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  permit_id             uuid REFERENCES public.job_permits(id),
  inspection_type       text NOT NULL DEFAULT 'other',
  scheduled_date        date,
  scheduled_window      text,
  booked_by             text NOT NULL DEFAULT 'office',
  inspector_name        text,
  result                public.inspection_result NOT NULL DEFAULT 'scheduled',
  result_date           date,
  rescheduled_date      date,
  parent_inspection_id  uuid REFERENCES public.job_inspections(id),
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Constraint: inspection_type in known set
ALTER TABLE public.job_inspections DROP CONSTRAINT IF EXISTS job_inspections_type_check;
ALTER TABLE public.job_inspections ADD CONSTRAINT job_inspections_type_check
  CHECK (inspection_type IN ('rough_in', 'cover', 'final', 'other'));

-- Constraint: booked_by in known set
ALTER TABLE public.job_inspections DROP CONSTRAINT IF EXISTS job_inspections_booked_by_check;
ALTER TABLE public.job_inspections ADD CONSTRAINT job_inspections_booked_by_check
  CHECK (booked_by IN ('office', 'gc_or_super', 'customer'));

CREATE INDEX IF NOT EXISTS job_inspections_job_id_idx ON public.job_inspections(job_id);
CREATE INDEX IF NOT EXISTS job_inspections_org_id_idx ON public.job_inspections(org_id);
CREATE INDEX IF NOT EXISTS job_inspections_scheduled_date_idx ON public.job_inspections(scheduled_date);
CREATE INDEX IF NOT EXISTS job_inspections_parent_id_idx ON public.job_inspections(parent_inspection_id);

-- ---------------------------------------------------------------------------
-- inspection_corrections
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inspection_corrections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id),
  inspection_id   uuid NOT NULL REFERENCES public.job_inspections(id) ON DELETE CASCADE,
  description     text NOT NULL,
  is_complete     boolean NOT NULL DEFAULT false,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inspection_corrections_inspection_id_idx
  ON public.inspection_corrections(inspection_id);
CREATE INDEX IF NOT EXISTS inspection_corrections_org_id_idx
  ON public.inspection_corrections(org_id);

-- ---------------------------------------------------------------------------
-- RLS: job_inspections
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_inspections FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_inspections'
      AND policyname = 'job_inspections: read for internal roles'
  ) THEN
    CREATE POLICY "job_inspections: read for internal roles"
      ON public.job_inspections FOR SELECT
      USING (
        current_app_role() IN ('owner','manager','dispatch','office','sales','tech')
        AND org_id = current_org_id()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_inspections'
      AND policyname = 'job_inspections: insert for office+'
  ) THEN
    CREATE POLICY "job_inspections: insert for office+"
      ON public.job_inspections FOR INSERT
      WITH CHECK (
        current_app_role() IN ('owner','manager','office')
        AND org_id = current_org_id()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_inspections'
      AND policyname = 'job_inspections: update for office+'
  ) THEN
    CREATE POLICY "job_inspections: update for office+"
      ON public.job_inspections FOR UPDATE
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

-- ---------------------------------------------------------------------------
-- RLS: inspection_corrections
-- ---------------------------------------------------------------------------
ALTER TABLE public.inspection_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_corrections FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inspection_corrections'
      AND policyname = 'inspection_corrections: read for internal roles'
  ) THEN
    CREATE POLICY "inspection_corrections: read for internal roles"
      ON public.inspection_corrections FOR SELECT
      USING (
        current_app_role() IN ('owner','manager','dispatch','office','sales','tech')
        AND org_id = current_org_id()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inspection_corrections'
      AND policyname = 'inspection_corrections: insert for office+'
  ) THEN
    CREATE POLICY "inspection_corrections: insert for office+"
      ON public.inspection_corrections FOR INSERT
      WITH CHECK (
        current_app_role() IN ('owner','manager','office')
        AND org_id = current_org_id()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inspection_corrections'
      AND policyname = 'inspection_corrections: update for office+'
  ) THEN
    CREATE POLICY "inspection_corrections: update for office+"
      ON public.inspection_corrections FOR UPDATE
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

-- ---------------------------------------------------------------------------
-- Triggers: auto-update updated_at on job_inspections
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.job_inspections_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_inspections_updated_at ON public.job_inspections;
CREATE TRIGGER job_inspections_updated_at
  BEFORE UPDATE ON public.job_inspections
  FOR EACH ROW EXECUTE FUNCTION public.job_inspections_set_updated_at();
