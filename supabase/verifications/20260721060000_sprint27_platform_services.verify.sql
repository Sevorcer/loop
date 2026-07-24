-- =============================================================================
-- Verification — 20260721060000_sprint27_platform_services
--
-- Asserts that all Sprint 27 platform service tables exist, RLS is enabled,
-- and representative org-scoped policies are present.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Platform service tables exist
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'storage_objects'),          'storage_objects table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gc_issue_requests'),        'gc_issue_requests table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gc_issue_attachments'),     'gc_issue_attachments table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'knowledge_items'),          'knowledge_items table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'knowledge_relationships'),  'knowledge_relationships table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'knowledge_usage'),          'knowledge_usage table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portal_projects'),          'portal_projects table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portal_milestones'),        'portal_milestones table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portal_documents'),         'portal_documents table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portal_photos'),            'portal_photos table must exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'performance_models'),       'performance_models table must exist';
END; $$;

-- ---------------------------------------------------------------------------
-- RLS enabled on all platform service tables
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'storage_objects'         AND c.rowsecurity = true), 'RLS must be enabled on storage_objects';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'gc_issue_requests'       AND c.rowsecurity = true), 'RLS must be enabled on gc_issue_requests';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'gc_issue_attachments'    AND c.rowsecurity = true), 'RLS must be enabled on gc_issue_attachments';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'knowledge_items'         AND c.rowsecurity = true), 'RLS must be enabled on knowledge_items';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'knowledge_relationships' AND c.rowsecurity = true), 'RLS must be enabled on knowledge_relationships';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'knowledge_usage'         AND c.rowsecurity = true), 'RLS must be enabled on knowledge_usage';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'portal_projects'         AND c.rowsecurity = true), 'RLS must be enabled on portal_projects';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'portal_milestones'       AND c.rowsecurity = true), 'RLS must be enabled on portal_milestones';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'portal_documents'        AND c.rowsecurity = true), 'RLS must be enabled on portal_documents';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'portal_photos'           AND c.rowsecurity = true), 'RLS must be enabled on portal_photos';
  ASSERT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'performance_models'      AND c.rowsecurity = true), 'RLS must be enabled on performance_models';
END; $$;

-- ---------------------------------------------------------------------------
-- Representative org-scoped policies present (policy change example)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'storage_objects'    AND policyname = 'storage_objects_org_select'),    'storage_objects_org_select policy must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gc_issue_requests'  AND policyname = 'gc_issue_requests_org_select'),   'gc_issue_requests_org_select policy must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'knowledge_items'    AND policyname = 'knowledge_items_org_select'),      'knowledge_items_org_select policy must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'portal_projects'    AND policyname = 'portal_projects_org_select'),      'portal_projects_org_select policy must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'performance_models' AND policyname = 'performance_models_org_select'),   'performance_models_org_select policy must exist';
END; $$;
