-- Verify: permission_role_overrides table exists with expected columns
SELECT id, org_id, role, table_name, action, allowed, created_at, updated_at
FROM permission_role_overrides
WHERE false;

-- Verify: permission_user_overrides table exists with expected columns
SELECT id, org_id, user_id, table_name, action, allowed, created_at, updated_at
FROM permission_user_overrides
WHERE false;

-- Verify: RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('permission_role_overrides', 'permission_user_overrides')
  AND rowsecurity = true;

-- Verify: unique constraints exist
SELECT conname
FROM pg_constraint
WHERE conrelid = 'permission_role_overrides'::regclass AND contype = 'u';

SELECT conname
FROM pg_constraint
WHERE conrelid = 'permission_user_overrides'::regclass AND contype = 'u';
