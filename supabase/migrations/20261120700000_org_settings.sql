-- Migration: org_settings
-- Phase 1 (Collin, 2026-11-04): org-level settings storage. First setting:
-- financials_visibility — who may see financial detail and revenue totals.
-- Values: 'owner' (default when no row exists), 'owner_manager',
-- 'revenue_roles'. Only the owner account may change settings (enforced in
-- the API/service layer; RLS here is org isolation like every other table).

CREATE TABLE IF NOT EXISTS org_settings (
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key         text NOT NULL,
  value       jsonb NOT NULL,
  updated_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, key)
);

ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_org_settings"
  ON org_settings
  FOR ALL
  USING (org_id = (
    SELECT org_id FROM user_profiles WHERE id = auth.uid()
  ));
