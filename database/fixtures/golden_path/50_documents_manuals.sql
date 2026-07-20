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
    '00000000-0000-4302-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4201-8000-000000000003',
    NULL,
    'document_uploaded',
    'Golden path permit packet uploaded',
    'Uploaded permit packet artifact for deterministic workflow.',
    '2026-07-20T08:30:00Z'
  ),
  (
    '00000000-0000-4302-8000-000000000004',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4201-8000-000000000003',
    NULL,
    'manual_linked',
    'Golden path manual linked',
    'Linked install manual for deterministic workflow.',
    '2026-07-20T08:40:00Z'
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
