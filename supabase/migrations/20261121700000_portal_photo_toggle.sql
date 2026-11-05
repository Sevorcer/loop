-- Migration: portal_photos_visible on jobs
-- Controls whether customer-visible photos appear in the GC portal.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS portal_photos_visible boolean NOT NULL DEFAULT false;
