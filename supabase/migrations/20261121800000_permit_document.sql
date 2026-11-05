-- Migration: document_storage_id on job_permits
-- References a storage_objects row for the digital permit document copy.
ALTER TABLE public.job_permits
  ADD COLUMN IF NOT EXISTS document_storage_id uuid REFERENCES public.storage_objects(id);
