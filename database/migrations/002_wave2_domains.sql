-- =============================================================================
-- Migration 002 — Wave 2 Domain Tables
-- Sprint 27 PR A (#56)
--
-- Adds Supabase-backed tables for Daily Plans, Dispatch, and Installed
-- Systems domains, replacing the previous localStorage / mock-data paths.
--
-- Apply after: migrations/001_core_schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- daily_plan_notes
-- Stores the per-date planning note entered by office staff each morning.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS daily_plan_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  date        text NOT NULL,                -- ISO date string: "YYYY-MM-DD"
  content     text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, date)
);

CREATE INDEX IF NOT EXISTS daily_plan_notes_org_date_idx ON daily_plan_notes(org_id, date);

-- ---------------------------------------------------------------------------
-- daily_plan_activations
-- Tracks activation state (planning → active → completed) for each date.
-- Also stores whether packets were sent for that date.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS daily_plan_activations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  date         text NOT NULL,              -- ISO date string: "YYYY-MM-DD"
  status       text NOT NULL DEFAULT 'planning'
               CHECK (status IN ('planning','active','completed')),
  started_at   timestamptz,
  packets_sent boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, date)
);

CREATE INDEX IF NOT EXISTS daily_plan_activations_org_date_idx ON daily_plan_activations(org_id, date);

-- ---------------------------------------------------------------------------
-- daily_plan_job_overrides
-- Per-job manual readiness overrides set during morning planning.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS daily_plan_job_overrides (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id),
  job_id           uuid NOT NULL,
  readiness_state  text CHECK (readiness_state IN ('ready','needs-attention')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, job_id)
);

CREATE INDEX IF NOT EXISTS daily_plan_job_overrides_org_job_idx ON daily_plan_job_overrides(org_id, job_id);

-- ---------------------------------------------------------------------------
-- crews
-- Field crew records.  Dispatch references these; it does not own crew
-- identity (that belongs to a future workforce domain).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  name            text NOT NULL,
  lead_installer  text NOT NULL DEFAULT '',
  members         jsonb NOT NULL DEFAULT '[]',
  certifications  text[] NOT NULL DEFAULT '{}',
  availability    text NOT NULL DEFAULT 'available'
                  CHECK (availability IN (
                    'available','partially_available','unavailable','on_job'
                  )),
  truck_name      text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crews_org_id_idx ON crews(org_id);

-- ---------------------------------------------------------------------------
-- dispatch_plans
-- Aggregate root for the Dispatch domain.  One plan per job.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dispatch_plans (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid NOT NULL REFERENCES organizations(id),
  job_id                    uuid REFERENCES jobs(id),
  job_number                text NOT NULL DEFAULT '',
  customer_name             text NOT NULL DEFAULT '',
  property_name             text NOT NULL DEFAULT '',
  job_type                  text NOT NULL DEFAULT '',
  dispatch_status           text NOT NULL DEFAULT 'ready_to_schedule'
                            CHECK (dispatch_status IN (
                              'ready_to_schedule','awaiting_materials',
                              'awaiting_technical_readiness',
                              'awaiting_customer_confirmation',
                              'awaiting_crew_availability',
                              'scheduled','in_progress','completed'
                            )),
  dispatchability           jsonb NOT NULL DEFAULT '{}',
  target_date               date,
  estimated_duration_hours  numeric NOT NULL DEFAULT 0,
  priority                  text NOT NULL DEFAULT 'normal'
                            CHECK (priority IN ('urgent','high','normal','low')),
  sequencing_notes          text,
  constraints               jsonb NOT NULL DEFAULT '[]',
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dispatch_plans_org_id_idx       ON dispatch_plans(org_id);
CREATE INDEX IF NOT EXISTS dispatch_plans_org_status_idx   ON dispatch_plans(org_id, dispatch_status);
CREATE INDEX IF NOT EXISTS dispatch_plans_org_job_id_idx   ON dispatch_plans(org_id, job_id);

-- ---------------------------------------------------------------------------
-- crew_assignments
-- Links a Dispatch Plan to a Crew.  References the aggregate root.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crew_assignments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES organizations(id),
  dispatch_plan_id        uuid NOT NULL REFERENCES dispatch_plans(id) ON DELETE CASCADE,
  job_id                  uuid REFERENCES jobs(id),
  crew_id                 uuid NOT NULL REFERENCES crews(id),
  crew_name               text NOT NULL DEFAULT '',
  lead_installer          text NOT NULL DEFAULT '',
  supporting_technicians  text[] NOT NULL DEFAULT '{}',
  status                  text NOT NULL DEFAULT 'proposed'
                          CHECK (status IN (
                            'proposed','confirmed','dispatched','reassigned','released'
                          )),
  assigned_at             timestamptz NOT NULL DEFAULT now(),
  reassignment_history    jsonb NOT NULL DEFAULT '[]',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crew_assignments_org_idx      ON crew_assignments(org_id);
CREATE INDEX IF NOT EXISTS crew_assignments_plan_idx     ON crew_assignments(dispatch_plan_id);

-- ---------------------------------------------------------------------------
-- schedule_blocks
-- Calendar rendering artifact — derived from a Dispatch Plan + assignment.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schedule_blocks (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL REFERENCES organizations(id),
  dispatch_plan_id         uuid NOT NULL REFERENCES dispatch_plans(id) ON DELETE CASCADE,
  job_id                   uuid REFERENCES jobs(id),
  crew_assignment_id       uuid REFERENCES crew_assignments(id) ON DELETE SET NULL,
  crew_name                text NOT NULL DEFAULT '',
  scheduled_date           date NOT NULL,
  scheduled_start_time     text NOT NULL DEFAULT '07:00',
  scheduled_end_time       text NOT NULL DEFAULT '16:00',
  estimated_duration_hours numeric NOT NULL DEFAULT 0,
  job_type                 text NOT NULL DEFAULT '',
  customer_name            text NOT NULL DEFAULT '',
  property_name            text NOT NULL DEFAULT '',
  dispatch_status          text NOT NULL DEFAULT 'scheduled',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schedule_blocks_org_idx       ON schedule_blocks(org_id);
CREATE INDEX IF NOT EXISTS schedule_blocks_date_idx      ON schedule_blocks(org_id, scheduled_date);

-- ---------------------------------------------------------------------------
-- dispatch_events
-- Immutable event log for all dispatch domain state changes.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dispatch_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id),
  dispatch_plan_id  uuid NOT NULL REFERENCES dispatch_plans(id) ON DELETE CASCADE,
  type              text NOT NULL,
  timestamp         timestamptz NOT NULL DEFAULT now(),
  description       text NOT NULL DEFAULT '',
  metadata          jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dispatch_events_org_idx  ON dispatch_events(org_id);
CREATE INDEX IF NOT EXISTS dispatch_events_plan_idx ON dispatch_events(dispatch_plan_id);

-- ---------------------------------------------------------------------------
-- technical_profiles
-- Normalized technical truth for an installed system.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS technical_profiles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id),
  technical_identity_id text NOT NULL DEFAULT '',
  system_name           text NOT NULL DEFAULT '',
  manufacturer          text NOT NULL DEFAULT '',
  equipment_type        text NOT NULL DEFAULT '',
  catalog_entry_ids     text[] NOT NULL DEFAULT '{}',
  match_state           text NOT NULL DEFAULT 'unmatched'
                        CHECK (match_state IN ('exact','possible','unmatched')),
  match_confidence      numeric NOT NULL DEFAULT 0,
  permit_fields         jsonb NOT NULL DEFAULT '{}',
  known_facts           jsonb NOT NULL DEFAULT '[]',
  discovered_facts      jsonb NOT NULL DEFAULT '[]',
  confirmation_note     text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS technical_profiles_org_id_idx ON technical_profiles(org_id);

-- ---------------------------------------------------------------------------
-- installed_systems
-- The physical HVAC/equipment systems associated with jobs and properties.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS installed_systems (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id),
  technical_identity_id text NOT NULL DEFAULT '',
  technical_profile_id  uuid REFERENCES technical_profiles(id),
  system_name           text NOT NULL DEFAULT '',
  lifecycle_status      text NOT NULL DEFAULT 'Planned'
                        CHECK (lifecycle_status IN ('Planned','Active','Needs Review')),
  customer_name         text NOT NULL DEFAULT '',
  property_id           uuid REFERENCES properties(id),
  property_name         text NOT NULL DEFAULT '',
  location              text NOT NULL DEFAULT '',
  estimate_id           text,
  job_id                uuid REFERENCES jobs(id),
  job_number            text,
  match_state           text NOT NULL DEFAULT 'unmatched'
                        CHECK (match_state IN ('exact','possible','unmatched')),
  match_confidence      numeric NOT NULL DEFAULT 0,
  install_date          text NOT NULL DEFAULT '',
  serial_numbers        text[] NOT NULL DEFAULT '{}',
  accessories           text[] NOT NULL DEFAULT '{}',
  linked_workflow_ids   text[] NOT NULL DEFAULT '{}',
  permit_ready          boolean NOT NULL DEFAULT false,
  operational_history   text[] NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS installed_systems_org_id_idx    ON installed_systems(org_id);
CREATE INDEX IF NOT EXISTS installed_systems_org_job_idx   ON installed_systems(org_id, job_id);
CREATE INDEX IF NOT EXISTS installed_systems_org_prop_idx  ON installed_systems(org_id, property_id);
