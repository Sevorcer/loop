-- Permission overrides — Phase 2 Permissions Editor
-- Allows org owners to customize the code-level permission matrix
-- per role and per user.

-- Role-level overrides (override code matrix for a whole role)
CREATE TABLE permission_role_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  role text NOT NULL,
  table_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('select', 'insert', 'update', 'delete')),
  allowed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, role, table_name, action)
);

-- Per-user overrides (grant/deny above role)
CREATE TABLE permission_user_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  table_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('select', 'insert', 'update', 'delete')),
  allowed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id, table_name, action)
);

ALTER TABLE permission_role_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_user_overrides ENABLE ROW LEVEL SECURITY;

-- Only owners can read/write overrides
CREATE POLICY "owner_only" ON permission_role_overrides
  FOR ALL USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid()) = 'owner'
  );

CREATE POLICY "owner_only" ON permission_user_overrides
  FOR ALL USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT app_role FROM user_profiles WHERE id = auth.uid()) = 'owner'
  );
