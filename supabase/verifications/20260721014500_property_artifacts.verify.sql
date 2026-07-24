-- =============================================================================
-- Verification — 20260721014500_property_artifacts
--
-- Asserts that property_documents and property_photos tables exist, have the
-- expected columns, RLS is enabled, and org-scoped policies are present.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tables exist
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'property_documents'), 'property_documents table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'property_photos'),    'property_photos table must exist';
END; $$;

-- ---------------------------------------------------------------------------
-- Required columns
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'property_documents' AND column_name = 'org_id'),      'property_documents.org_id must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'property_documents' AND column_name = 'property_id'),  'property_documents.property_id must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'property_documents' AND column_name = 'title'),         'property_documents.title must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'property_documents' AND column_name = 'storage_path'),  'property_documents.storage_path must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'property_photos'    AND column_name = 'org_id'),         'property_photos.org_id must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'property_photos'    AND column_name = 'property_id'),    'property_photos.property_id must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'property_photos'    AND column_name = 'url'),             'property_photos.url must exist';
END; $$;

-- ---------------------------------------------------------------------------
-- RLS enabled
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'property_documents' AND c.rowsecurity = true), 'RLS must be enabled on property_documents';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'property_photos'    AND c.rowsecurity = true), 'RLS must be enabled on property_photos';
END; $$;

-- ---------------------------------------------------------------------------
-- Org-scoped policies present
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'property_documents' AND policyname = 'property_documents: org read'),  'property_documents: org read policy must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'property_documents' AND policyname = 'property_documents: org write'), 'property_documents: org write policy must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'property_photos'    AND policyname = 'property_photos: org read'),      'property_photos: org read policy must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'property_photos'    AND policyname = 'property_photos: org write'),     'property_photos: org write policy must exist';
END; $$;

-- ---------------------------------------------------------------------------
-- Indexes present
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'property_documents' AND indexname = 'property_documents_org_property_idx'), 'property_documents_org_property_idx must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'property_photos'    AND indexname = 'property_photos_org_property_idx'),     'property_photos_org_property_idx must exist';
END; $$;
