-- performance_models table — extracted from
-- supabase/migrations/20260721060000_sprint27_platform_services.sql
-- (Reporting feature). Safe to re-run: every statement is idempotent.
-- Run in the Supabase dashboard SQL editor on the LOOP production project.

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

ALTER TABLE performance_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_models FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "performance_models_org_select" ON performance_models;
CREATE POLICY "performance_models_org_select"
  ON performance_models FOR SELECT
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager','dispatch','tech','office','sales')
  );

DROP POLICY IF EXISTS "performance_models_mgr_insert" ON performance_models;
CREATE POLICY "performance_models_mgr_insert"
  ON performance_models FOR INSERT
  WITH CHECK (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager')
  );

DROP POLICY IF EXISTS "performance_models_mgr_update" ON performance_models;
CREATE POLICY "performance_models_mgr_update"
  ON performance_models FOR UPDATE
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager')
  );

DROP POLICY IF EXISTS "performance_models_mgr_delete" ON performance_models;
CREATE POLICY "performance_models_mgr_delete"
  ON performance_models FOR DELETE
  USING (
    org_id = current_org_id()
    AND current_app_role() IN ('owner','manager')
  );
