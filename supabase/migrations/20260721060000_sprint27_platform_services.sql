-- =============================================================================
-- Sprint 27 — Platform Services Tables, RLS, and Policies
--
-- This migration consolidates the authoritative schema from:
--   database/migrations/002_sprint27_platform_services.sql
--   database/policies/003_sprint27_policies.sql
--
-- Tables covered:
--   storage_objects, gc_issue_requests, gc_issue_attachments,
--   knowledge_items, knowledge_relationships, knowledge_usage,
--   portal_projects, portal_milestones, portal_documents, portal_photos,
--   performance_models
--
-- Note: installed_systems is intentionally excluded — it was already created
-- with a richer schema in 20260720000001_wave2_domains.sql and its RLS
-- policies were included there.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP TABLE IF EXISTS performance_models, portal_photos, portal_documents,
--     portal_milestones, portal_projects, knowledge_usage,
--     knowledge_relationships, knowledge_items, gc_issue_attachments,
--     gc_issue_requests, storage_objects CASCADE;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Storage object metadata
-- Tracks files stored in Supabase Storage with rich metadata and
-- role-aware access control.
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
  job_id        uuid REFERENCES jobs(id) ON DELETE SET NULL,
  property_id   uuid REFERENCES properties(id) ON DELETE SET NULL,
  visibility    text NOT NULL DEFAULT 'internal'
                CHECK (visibility IN ('internal','customer')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket, storage_path)
);

CREATE INDEX IF NOT EXISTS storage_objects_org_id_idx      ON storage_objects(org_id);
CREATE INDEX IF NOT EXISTS storage_objects_job_id_idx      ON storage_objects(job_id);
CREATE INDEX IF NOT EXISTS storage_objects_property_id_idx ON storage_objects(property_id);

-- ---------------------------------------------------------------------------
-- GC field issue requests
-- Field-initiated issue reports submitted by technicians/GC staff.
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
  property_id   uuid REFERENCES properties(id) ON DELETE SET NULL,
  job_id        uuid REFERENCES jobs(id) ON DELETE SET NULL,
  submitted_by  uuid REFERENCES auth.users(id),
  assigned_to   uuid REFERENCES auth.users(id),
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gc_issue_requests_org_id_idx      ON gc_issue_requests(org_id);
CREATE INDEX IF NOT EXISTS gc_issue_requests_status_idx      ON gc_issue_requests(status);
CREATE INDEX IF NOT EXISTS gc_issue_requests_priority_idx    ON gc_issue_requests(priority);
CREATE INDEX IF NOT EXISTS gc_issue_requests_job_id_idx      ON gc_issue_requests(job_id);
CREATE INDEX IF NOT EXISTS gc_issue_requests_property_id_idx ON gc_issue_requests(property_id);

-- ---------------------------------------------------------------------------
-- GC issue request attachments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS gc_issue_attachments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id),
  issue_request_id  uuid NOT NULL REFERENCES gc_issue_requests(id) ON DELETE CASCADE,
  storage_object_id uuid NOT NULL REFERENCES storage_objects(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gc_issue_attachments_issue_id_idx ON gc_issue_attachments(issue_request_id);

-- ---------------------------------------------------------------------------
-- Knowledge items (Company Brain)
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
                       CHECK (relationship_type IN (
                         'references','required_for','recommended_for','supersedes'
                       )),
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
-- Portal projects
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
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  project_id   uuid NOT NULL REFERENCES portal_projects(id) ON DELETE CASCADE,
  name         text NOT NULL,
  sequence     integer NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','in_progress','completed','skipped')),
  completed_at timestamptz,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
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
-- Performance models (Reporting)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS performance_models (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid NOT NULL REFERENCES organizations(id),
  title                     text NOT NULL,
  description               text NOT NULL DEFAULT '',
  owner                     text NOT NULL DEFAULT '',
  status                    text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('draft','active','revised','retired')),
  scope                     text NOT NULL DEFAULT 'company'
                            CHECK (scope IN ('company','team','location','function')),
  related_domains           text[] NOT NULL DEFAULT '{}',
  default_comparison_window text NOT NULL DEFAULT 'last-7-days',
  health_scoring_rules      jsonb NOT NULL DEFAULT '[]',
  benchmark_config          jsonb NOT NULL DEFAULT '{}',
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS performance_models_org_id_idx ON performance_models(org_id);
CREATE INDEX IF NOT EXISTS performance_models_status_idx ON performance_models(status);

-- =============================================================================
-- RLS — Reconcile policies with the application's existing authorization model
-- (least privilege; no unintended access broadening)
-- Source: database/policies/003_sprint27_policies.sql
-- =============================================================================

ALTER TABLE storage_objects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_objects      FORCE  ROW LEVEL SECURITY;

ALTER TABLE gc_issue_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE gc_issue_requests    FORCE  ROW LEVEL SECURITY;

ALTER TABLE gc_issue_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gc_issue_attachments FORCE  ROW LEVEL SECURITY;

ALTER TABLE knowledge_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items         FORCE  ROW LEVEL SECURITY;

ALTER TABLE knowledge_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_relationships FORCE  ROW LEVEL SECURITY;

ALTER TABLE knowledge_usage         ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_usage         FORCE  ROW LEVEL SECURITY;

ALTER TABLE portal_projects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_projects  FORCE  ROW LEVEL SECURITY;

ALTER TABLE portal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_milestones FORCE  ROW LEVEL SECURITY;

ALTER TABLE portal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_documents FORCE  ROW LEVEL SECURITY;

ALTER TABLE portal_photos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_photos    FORCE  ROW LEVEL SECURITY;

ALTER TABLE performance_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_models FORCE  ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- storage_objects
-- ---------------------------------------------------------------------------

CREATE POLICY "storage_objects_org_select"
  ON storage_objects FOR SELECT
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "storage_objects_org_insert"
  ON storage_objects FOR INSERT
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "storage_objects_org_update"
  ON storage_objects FOR UPDATE
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager')
  );

CREATE POLICY "storage_objects_org_delete"
  ON storage_objects FOR DELETE
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager')
  );

-- ---------------------------------------------------------------------------
-- gc_issue_requests
-- ---------------------------------------------------------------------------

CREATE POLICY "gc_issue_requests_org_select"
  ON gc_issue_requests FOR SELECT
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "gc_issue_requests_org_insert"
  ON gc_issue_requests FOR INSERT
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "gc_issue_requests_mgr_update"
  ON gc_issue_requests FOR UPDATE
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch')
  );

CREATE POLICY "gc_issue_requests_mgr_delete"
  ON gc_issue_requests FOR DELETE
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager')
  );

-- ---------------------------------------------------------------------------
-- gc_issue_attachments
-- ---------------------------------------------------------------------------

CREATE POLICY "gc_issue_attachments_org_select"
  ON gc_issue_attachments FOR SELECT
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "gc_issue_attachments_org_insert"
  ON gc_issue_attachments FOR INSERT
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "gc_issue_attachments_mgr_delete"
  ON gc_issue_attachments FOR DELETE
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager')
  );

-- ---------------------------------------------------------------------------
-- knowledge_items
-- ---------------------------------------------------------------------------

CREATE POLICY "knowledge_items_org_select"
  ON knowledge_items FOR SELECT
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "knowledge_items_mgr_insert"
  ON knowledge_items FOR INSERT
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager')
  );

CREATE POLICY "knowledge_items_mgr_update"
  ON knowledge_items FOR UPDATE
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager')
  );

CREATE POLICY "knowledge_items_mgr_delete"
  ON knowledge_items FOR DELETE
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager')
  );

-- ---------------------------------------------------------------------------
-- knowledge_relationships
-- ---------------------------------------------------------------------------

CREATE POLICY "knowledge_relationships_org_select"
  ON knowledge_relationships FOR SELECT
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "knowledge_relationships_mgr_insert"
  ON knowledge_relationships FOR INSERT
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager')
  );

CREATE POLICY "knowledge_relationships_mgr_delete"
  ON knowledge_relationships FOR DELETE
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager')
  );

-- ---------------------------------------------------------------------------
-- knowledge_usage
-- ---------------------------------------------------------------------------

CREATE POLICY "knowledge_usage_org_select"
  ON knowledge_usage FOR SELECT
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "knowledge_usage_org_insert"
  ON knowledge_usage FOR INSERT
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
  );

-- ---------------------------------------------------------------------------
-- portal_projects
-- Internal staff — full access; portal users — read-only
-- ---------------------------------------------------------------------------

CREATE POLICY "portal_projects_staff_all"
  ON portal_projects FOR ALL
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "portal_projects_portal_select"
  ON portal_projects FOR SELECT
  USING (
    org_id = current_org_id()
    AND current_app_role() = 'portal'
  );

-- ---------------------------------------------------------------------------
-- portal_milestones
-- ---------------------------------------------------------------------------

CREATE POLICY "portal_milestones_staff_all"
  ON portal_milestones FOR ALL
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "portal_milestones_portal_select"
  ON portal_milestones FOR SELECT
  USING (
    org_id = current_org_id()
    AND current_app_role() = 'portal'
  );

-- ---------------------------------------------------------------------------
-- portal_documents
-- Portal users only see customer-visible documents.
-- ---------------------------------------------------------------------------

CREATE POLICY "portal_documents_staff_all"
  ON portal_documents FOR ALL
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "portal_documents_portal_select"
  ON portal_documents FOR SELECT
  USING (
    org_id = current_org_id()
    AND current_app_role() = 'portal'
    AND visibility = 'customer'
  );

-- ---------------------------------------------------------------------------
-- portal_photos
-- Portal users only see customer-visible photos.
-- ---------------------------------------------------------------------------

CREATE POLICY "portal_photos_staff_all"
  ON portal_photos FOR ALL
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "portal_photos_portal_select"
  ON portal_photos FOR SELECT
  USING (
    org_id = current_org_id()
    AND current_app_role() = 'portal'
    AND customer_visible = true
  );

-- ---------------------------------------------------------------------------
-- performance_models
-- ---------------------------------------------------------------------------

CREATE POLICY "performance_models_org_select"
  ON performance_models FOR SELECT
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "performance_models_mgr_insert"
  ON performance_models FOR INSERT
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager')
  );

CREATE POLICY "performance_models_mgr_update"
  ON performance_models FOR UPDATE
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager')
  );

CREATE POLICY "performance_models_mgr_delete"
  ON performance_models FOR DELETE
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager')
  );
