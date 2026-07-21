-- =============================================================================
-- Migration — Property Artifacts (Documents + Photos)
-- Sprint 28 PR B
--
-- UP:
--   - Create property_documents and property_photos tables.
--   - Enable RLS with explicit org-scoped read/write policies.
--
-- DOWN (manual rollback):
--   DROP POLICY IF EXISTS "property_documents: org read" ON property_documents;
--   DROP POLICY IF EXISTS "property_documents: org write" ON property_documents;
--   DROP POLICY IF EXISTS "property_photos: org read" ON property_photos;
--   DROP POLICY IF EXISTS "property_photos: org write" ON property_photos;
--   DROP TABLE IF EXISTS property_documents;
--   DROP TABLE IF EXISTS property_photos;
-- =============================================================================

CREATE TABLE IF NOT EXISTS property_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title       text NOT NULL,
  category    text NOT NULL DEFAULT 'General',
  status      text NOT NULL DEFAULT 'Ready'
              CHECK (status IN ('Ready', 'Pending Review', 'Missing')),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  storage_path text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_documents_org_property_idx
  ON property_documents(org_id, property_id);
CREATE INDEX IF NOT EXISTS property_documents_uploaded_idx
  ON property_documents(org_id, uploaded_at DESC);

CREATE TABLE IF NOT EXISTS property_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  property_id  uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title        text NOT NULL,
  category     text NOT NULL DEFAULT 'General',
  status       text NOT NULL DEFAULT 'Complete'
               CHECK (status IN ('Complete', 'Required', 'Flagged')),
  captured_at  timestamptz NOT NULL DEFAULT now(),
  url          text,
  thumbnail_url text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_photos_org_property_idx
  ON property_photos(org_id, property_id);
CREATE INDEX IF NOT EXISTS property_photos_captured_idx
  ON property_photos(org_id, captured_at DESC);

ALTER TABLE property_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_documents FORCE ROW LEVEL SECURITY;

ALTER TABLE property_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_photos FORCE ROW LEVEL SECURITY;

CREATE POLICY "property_documents: org read"
  ON property_documents FOR SELECT
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner', 'manager', 'dispatch', 'tech', 'office', 'sales')
  );

CREATE POLICY "property_documents: org write"
  ON property_documents FOR ALL
  USING (org_id = current_org_id())
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner', 'manager', 'office', 'sales')
  );

CREATE POLICY "property_photos: org read"
  ON property_photos FOR SELECT
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner', 'manager', 'dispatch', 'tech', 'office', 'sales')
  );

CREATE POLICY "property_photos: org write"
  ON property_photos FOR ALL
  USING (org_id = current_org_id())
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner', 'manager', 'office', 'sales')
  );
