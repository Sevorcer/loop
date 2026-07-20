INSERT INTO customers (
  id,
  org_id,
  name,
  primary_contact,
  email,
  phone,
  city,
  status,
  property_count,
  open_jobs,
  last_activity,
  created_at,
  updated_at
)
VALUES
  (
    '00000000-0000-4001-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    'Riverstone HOA',
    'Board Coordinator',
    'board@riverstonehoa.example.com',
    '(555) 900-2104',
    'Redmond',
    'Active',
    1,
    1,
    '2026-07-20',
    '2026-01-06T09:00:00Z',
    '2026-07-20T09:00:00Z'
  )
ON CONFLICT (id) DO UPDATE
SET
  org_id = EXCLUDED.org_id,
  name = EXCLUDED.name,
  primary_contact = EXCLUDED.primary_contact,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  city = EXCLUDED.city,
  status = EXCLUDED.status,
  property_count = EXCLUDED.property_count,
  open_jobs = EXCLUDED.open_jobs,
  last_activity = EXCLUDED.last_activity,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;
