-- =============================================================================
-- Migration 002 — Sprint 27 Platform Services
--
-- Adds tables required for:
--   - #57  Storage metadata + GC field issue requests
--   - #58  Copilot live search (installed_systems, knowledge_items, portal_projects,
--          performance_models)
--   - #59  Company Brain persistence, Reporting models, Project Portal live data
--
-- All tables follow the same conventions as Migration 001:
--   - org_id       multi-tenant row isolation
--   - id           UUID primary key
--   - audit stamps created_at / updated_at
-- =============================================================================

-- ---------------------------------------------------------------------------
-- #57 — Storage object metadata
-- Tracks files stored in Supabase Storage with rich metadata and
-- role-aware access control.  The bucket/path is the stable reference;
-- metadata rows are inserted by the storage service after a successful upload.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS storage_objects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  bucket        text NOT NULL,
  storage_path  text NOT NULL,
  file_name     text NOT NULL DEFAULT '',
  mime_type     text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes    bigint NOT NULL DEFAULT 0,
  uploaded_by   uuid REFERENCES auth.users(id),
  -- Optional entity references
  job_id        uuid REFERENCES jobs(id) ON DELETE SET NULL,
  property_id   uuid REFERENCES properties(id) ON DELETE SET NULL,
  -- Visibility: internal (staff-only) or customer (portal-visible)
  visibility    text NOT NULL DEFAULT 'internal'
                CHECK (visibility IN ('internal','customer')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket, storage_path)
);

CREATE INDEX IF NOT EXISTS storage_objects_org_id_idx     ON storage_objects(org_id);
CREATE INDEX IF NOT EXISTS storage_objects_job_id_idx     ON storage_objects(job_id);
CREATE INDEX IF NOT EXISTS storage_objects_property_id_idx ON storage_objects(property_id);

-- ---------------------------------------------------------------------------
-- #57 — GC field issue requests
-- Field-initiated issue reports submitted by technicians/GC staff.
-- Routed to the dispatcher/admin queue for triage.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS gc_issue_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  title         text NOT NULL,
  description   text NOT NULL DEFAULT '',
  priority      text NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low','medium','high','critical')),
  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','triaged','in_progress','resolved','closed')),
  -- Optional entity references
  property_id   uuid REFERENCES properties(id) ON DELETE SET NULL,
  job_id        uuid REFERENCES jobs(id) ON DELETE SET NULL,
  -- Submitted by an internal user
  submitted_by  uuid REFERENCES auth.users(id),
  -- Assigned to a dispatcher/admin for resolution
  assigned_to   uuid REFERENCES auth.users(id),
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gc_issue_requests_org_id_idx    ON gc_issue_requests(org_id);
CREATE INDEX IF NOT EXISTS gc_issue_requests_status_idx    ON gc_issue_requests(status);
CREATE INDEX IF NOT EXISTS gc_issue_requests_priority_idx  ON gc_issue_requests(priority);
CREATE INDEX IF NOT EXISTS gc_issue_requests_job_id_idx    ON gc_issue_requests(job_id);
CREATE INDEX IF NOT EXISTS gc_issue_requests_property_id_idx ON gc_issue_requests(property_id);

-- ---------------------------------------------------------------------------
-- #57 — GC issue request attachments
-- Photo/document attachments submitted with an issue request.
-- References a storage_objects row for the actual file.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS gc_issue_attachments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id),
  issue_request_id uuid NOT NULL REFERENCES gc_issue_requests(id) ON DELETE CASCADE,
  storage_object_id uuid NOT NULL REFERENCES storage_objects(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gc_issue_attachments_issue_id_idx ON gc_issue_attachments(issue_request_id);

-- ---------------------------------------------------------------------------
-- #58/#59 — Installed systems
-- Tracks HVAC and other installed equipment per property.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS installed_systems (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id),
  property_id      uuid REFERENCES properties(id) ON DELETE SET NULL,
  job_id           uuid REFERENCES jobs(id) ON DELETE SET NULL,
  system_name      text NOT NULL,
  customer_name    text NOT NULL DEFAULT '',
  property_name    text NOT NULL DEFAULT '',
  location         text NOT NULL DEFAULT '',
  lifecycle_status text NOT NULL DEFAULT 'Active'
                   CHECK (lifecycle_status IN ('Planned','Active','Needs Review')),
  serial_numbers   text[] NOT NULL DEFAULT '{}',
  equipment_type   text NOT NULL DEFAULT '',
  manufacturer     text NOT NULL DEFAULT '',
  model_number     text NOT NULL DEFAULT '',
  install_date     date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS installed_systems_org_id_idx      ON installed_systems(org_id);
CREATE INDEX IF NOT EXISTS installed_systems_property_id_idx ON installed_systems(property_id);
CREATE INDEX IF NOT EXISTS installed_systems_job_id_idx      ON installed_systems(job_id);

-- ---------------------------------------------------------------------------
-- #58/#59 — Knowledge items (Company Brain)
-- Organizational knowledge — SOPs, guides, bulletins, best practices.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS knowledge_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  title           text NOT NULL,
  summary         text NOT NULL DEFAULT '',
  body            text NOT NULL DEFAULT '',
  knowledge_type  text NOT NULL DEFAULT 'best_practice'
                  CHECK (knowledge_type IN (
                    'sop','installation_guide','service_bulletin',
                    'troubleshooting','safety_procedure','best_practice',
                    'policy','training','faq'
                  )),
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','reviewed','published','improved','archived')),
  version         integer NOT NULL DEFAULT 1,
  tags            text[] NOT NULL DEFAULT '{}',
  owner           text NOT NULL DEFAULT '',
  related_domains text[] NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_items_org_id_idx ON knowledge_items(org_id);
CREATE INDEX IF NOT EXISTS knowledge_items_status_idx ON knowledge_items(status);

-- ---------------------------------------------------------------------------
-- Knowledge relationships
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS knowledge_relationships (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organizations(id),
  knowledge_item_id    uuid NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  related_domain       text NOT NULL,
  related_entity_id    text NOT NULL,
  related_entity_label text NOT NULL DEFAULT '',
  relationship_type    text NOT NULL DEFAULT 'references'
                       CHECK (relationship_type IN ('references','required_for','recommended_for','supersedes')),
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_relationships_item_id_idx ON knowledge_relationships(knowledge_item_id);

-- ---------------------------------------------------------------------------
-- Knowledge usage tracking
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS knowledge_usage (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id),
  knowledge_item_id uuid NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  event             text NOT NULL
                    CHECK (event IN ('viewed','referenced','linked','updated')),
  context           text,
  timestamp         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_usage_item_id_idx ON knowledge_usage(knowledge_item_id);

-- ---------------------------------------------------------------------------
-- #58/#59 — Portal projects
-- Project Portal projects — visible to homeowners/GC/PM users.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS portal_projects (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid NOT NULL REFERENCES organizations(id),
  name                      text NOT NULL,
  address                   text NOT NULL DEFAULT '',
  status                    text NOT NULL DEFAULT 'not_started'
                            CHECK (status IN (
                              'not_started','in_progress','inspection_pending',
                              'completed','on_hold','cancelled'
                            )),
  completion_pct            integer NOT NULL DEFAULT 0
                            CHECK (completion_pct >= 0 AND completion_pct <= 100),
  estimated_completion_date date,
  next_milestone            text,
  project_manager           text NOT NULL DEFAULT '',
  photos_enabled            boolean NOT NULL DEFAULT false,
  last_synced_at            timestamptz NOT NULL DEFAULT now(),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_projects_org_id_idx ON portal_projects(org_id);
CREATE INDEX IF NOT EXISTS portal_projects_status_idx ON portal_projects(status);

-- ---------------------------------------------------------------------------
-- Portal project milestones
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS portal_milestones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  project_id  uuid NOT NULL REFERENCES portal_projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sequence    integer NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','in_progress','completed','skipped')),
  completed_at timestamptz,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_milestones_project_id_idx ON portal_milestones(project_id);

-- ---------------------------------------------------------------------------
-- Portal project documents
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS portal_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  project_id      uuid NOT NULL REFERENCES portal_projects(id) ON DELETE CASCADE,
  name            text NOT NULL,
  document_type   text NOT NULL DEFAULT 'other'
                  CHECK (document_type IN (
                    'proposal','signed_agreement','manual','warranty',
                    'inspection_report','maintenance_recommendation','other'
                  )),
  visibility      text NOT NULL DEFAULT 'internal'
                  CHECK (visibility IN ('internal','customer')),
  file_size_bytes bigint NOT NULL DEFAULT 0,
  mime_type       text NOT NULL DEFAULT 'application/octet-stream',
  storage_path    text,
  allowed_roles   text[],
  published_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_documents_project_id_idx ON portal_documents(project_id);

-- ---------------------------------------------------------------------------
-- Portal project photos
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS portal_photos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id),
  project_id       uuid NOT NULL REFERENCES portal_projects(id) ON DELETE CASCADE,
  caption          text,
  alt_text         text,
  category         text NOT NULL DEFAULT 'during'
                   CHECK (category IN (
                     'before','during','completed','equipment',
                     'mechanical_room','outdoor_unit','permits'
                   )),
  visibility       text NOT NULL DEFAULT 'internal'
                   CHECK (visibility IN ('internal','customer')),
  storage_path     text,
  url              text NOT NULL DEFAULT '',
  thumbnail_url    text NOT NULL DEFAULT '',
  customer_visible boolean NOT NULL DEFAULT false,
  allowed_roles    text[],
  taken_at         timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_photos_project_id_idx ON portal_photos(project_id);

-- ---------------------------------------------------------------------------
-- #58/#59 — Performance models (Reporting)
-- Model definitions that drive the Reporting domain.
-- Metric values are derived from operational data at query time.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS performance_models (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                     uuid NOT NULL REFERENCES organizations(id),
  title                      text NOT NULL,
  description                text NOT NULL DEFAULT '',
  owner                      text NOT NULL DEFAULT '',
  status                     text NOT NULL DEFAULT 'active'
                             CHECK (status IN ('draft','active','revised','retired')),
  scope                      text NOT NULL DEFAULT 'company'
                             CHECK (scope IN ('company','team','location','function')),
  related_domains            text[] NOT NULL DEFAULT '{}',
  default_comparison_window  text NOT NULL DEFAULT 'last-7-days',
  health_scoring_rules       jsonb NOT NULL DEFAULT '[]',
  benchmark_config           jsonb NOT NULL DEFAULT '{}',
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS performance_models_org_id_idx ON performance_models(org_id);
CREATE INDEX IF NOT EXISTS performance_models_status_idx ON performance_models(status);
