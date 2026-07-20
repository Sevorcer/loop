INSERT INTO organizations (
  id,
  name,
  created_at,
  updated_at
)
VALUES
  (
    '00000000-0000-4000-8000-000000000001',
    'LOOP Demo Org',
    '2026-01-01T09:00:00Z',
    '2026-01-01T09:00:00Z'
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;
