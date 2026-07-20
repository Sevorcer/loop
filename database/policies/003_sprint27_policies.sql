-- =============================================================================
-- Policies 003 — Sprint 27 Platform Services RLS
--
-- Row-level security policies for tables added in migration 002.
-- All policies follow the same org-scoped pattern established in 002_role_policies.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- storage_objects
-- Staff (owner, manager, dispatch, tech, office, sales) can access.
-- Portal role cannot access raw storage objects.
-- ---------------------------------------------------------------------------

ALTER TABLE storage_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "storage_objects_org_select"
  ON storage_objects FOR SELECT
  USING (
    org_id = (
      SELECT org_id FROM user_profiles WHERE id = auth.uid()
    )
    AND (
      SELECT app_role FROM user_profiles WHERE id = auth.uid()
    ) IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "storage_objects_org_insert"
  ON storage_objects FOR INSERT
  WITH CHECK (
    org_id = (
      SELECT org_id FROM user_profiles WHERE id = auth.uid()
    )
    AND (
      SELECT app_role FROM user_profiles WHERE id = auth.uid()
    ) IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "storage_objects_org_update"
  ON storage_objects FOR UPDATE
  USING (
    org_id = (
      SELECT org_id FROM user_profiles WHERE id = auth.uid()
    )
    AND (
      SELECT app_role FROM user_profiles WHERE id = auth.uid()
    ) IN ('owner','manager')
  );

CREATE POLICY "storage_objects_org_delete"
  ON storage_objects FOR DELETE
  USING (
    org_id = (
      SELECT org_id FROM user_profiles WHERE id = auth.uid()
    )
    AND (
      SELECT app_role FROM user_profiles WHERE id = auth.uid()
    ) IN ('owner','manager')
  );

-- ---------------------------------------------------------------------------
-- gc_issue_requests
-- Tech/dispatch/office/manager/owner can read all org requests.
-- Tech can only insert (not update/delete others).
-- Manager/dispatch/owner can triage, update, resolve, and delete.
-- ---------------------------------------------------------------------------

ALTER TABLE gc_issue_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gc_issue_requests_org_select"
  ON gc_issue_requests FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "gc_issue_requests_org_insert"
  ON gc_issue_requests FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "gc_issue_requests_mgr_update"
  ON gc_issue_requests FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager','dispatch')
  );

CREATE POLICY "gc_issue_requests_mgr_delete"
  ON gc_issue_requests FOR DELETE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager')
  );

-- ---------------------------------------------------------------------------
-- gc_issue_attachments
-- Same staff access as gc_issue_requests.
-- ---------------------------------------------------------------------------

ALTER TABLE gc_issue_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gc_issue_attachments_org_select"
  ON gc_issue_attachments FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "gc_issue_attachments_org_insert"
  ON gc_issue_attachments FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "gc_issue_attachments_mgr_delete"
  ON gc_issue_attachments FOR DELETE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager')
  );

-- ---------------------------------------------------------------------------
-- installed_systems
-- All internal staff can read. Manager/owner can write.
-- ---------------------------------------------------------------------------

ALTER TABLE installed_systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "installed_systems_org_select"
  ON installed_systems FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "installed_systems_mgr_insert"
  ON installed_systems FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager')
  );

CREATE POLICY "installed_systems_mgr_update"
  ON installed_systems FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager')
  );

CREATE POLICY "installed_systems_owner_delete"
  ON installed_systems FOR DELETE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager')
  );

-- ---------------------------------------------------------------------------
-- knowledge_items  /  knowledge_relationships  /  knowledge_usage
-- All internal staff can read. Owner/manager can write.
-- ---------------------------------------------------------------------------

ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_items_org_select"
  ON knowledge_items FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "knowledge_items_mgr_insert"
  ON knowledge_items FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager')
  );

CREATE POLICY "knowledge_items_mgr_update"
  ON knowledge_items FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager')
  );

CREATE POLICY "knowledge_items_owner_delete"
  ON knowledge_items FOR DELETE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager')
  );

ALTER TABLE knowledge_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_relationships_org_select"
  ON knowledge_relationships FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "knowledge_relationships_mgr_insert"
  ON knowledge_relationships FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager')
  );

CREATE POLICY "knowledge_relationships_mgr_delete"
  ON knowledge_relationships FOR DELETE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager')
  );

ALTER TABLE knowledge_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_usage_org_select"
  ON knowledge_usage FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "knowledge_usage_org_insert"
  ON knowledge_usage FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager','dispatch','tech','office','sales')
  );

-- ---------------------------------------------------------------------------
-- portal_projects  /  portal_milestones  /  portal_documents  /  portal_photos
-- Internal staff can manage. Portal role can read customer-visible items only.
-- ---------------------------------------------------------------------------

ALTER TABLE portal_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_projects_staff_all"
  ON portal_projects FOR ALL
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "portal_projects_portal_select"
  ON portal_projects FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid()) = 'portal'
  );

ALTER TABLE portal_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_milestones_staff_all"
  ON portal_milestones FOR ALL
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "portal_milestones_portal_select"
  ON portal_milestones FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid()) = 'portal'
  );

ALTER TABLE portal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_documents_staff_all"
  ON portal_documents FOR ALL
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "portal_documents_portal_select"
  ON portal_documents FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid()) = 'portal'
    AND visibility = 'customer'
  );

ALTER TABLE portal_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_photos_staff_all"
  ON portal_photos FOR ALL
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "portal_photos_portal_select"
  ON portal_photos FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid()) = 'portal'
    AND customer_visible = true
  );

-- ---------------------------------------------------------------------------
-- performance_models
-- All internal staff can read. Owner/manager can write.
-- ---------------------------------------------------------------------------

ALTER TABLE performance_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "performance_models_org_select"
  ON performance_models FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager','dispatch','tech','office','sales')
  );

CREATE POLICY "performance_models_mgr_insert"
  ON performance_models FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager')
  );

CREATE POLICY "performance_models_mgr_update"
  ON performance_models FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager')
  );

CREATE POLICY "performance_models_owner_delete"
  ON performance_models FOR DELETE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid())
        IN ('owner','manager')
  );
