INSERT INTO job_activity (
  id,
  org_id,
  job_id,
  actor_id,
  type,
  title,
  description,
  created_at
)
VALUES
  (
    '00000000-0000-4302-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4201-8000-000000000001',
    NULL,
    'document_uploaded',
    'Permit packet uploaded',
    'Attached permit packet for baseline install workflow.',
    '2026-07-16T10:00:00Z'
  ),
  (
    '00000000-0000-4302-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4201-8000-000000000002',
    NULL,
    'manual_linked',
    'Service manual linked',
    'Linked compressor service manual for baseline service call.',
    '2026-07-16T10:10:00Z'
  )
ON CONFLICT (id) DO UPDATE
SET
  org_id = EXCLUDED.org_id,
  job_id = EXCLUDED.job_id,
  actor_id = EXCLUDED.actor_id,
  type = EXCLUDED.type,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  created_at = EXCLUDED.created_at;
