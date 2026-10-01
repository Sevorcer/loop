-- Split job checklist into field ("Job Checklist") and office ("Office Checklist") sections.
ALTER TABLE job_tasks ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'field';
