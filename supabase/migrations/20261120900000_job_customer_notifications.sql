-- Migration: per-job customer notification opt-in + on-the-way stamp
-- (live-review #35, Collin's model, 2026-11-04)
--
-- customer_notifications_enabled: OFF by default. Notifications are
-- OPTIONAL per job and never auto-fire on scheduling — the office flips
-- the toggle on when they want this customer emailed. Flipping it on
-- sends the "scheduled" email at that moment; while on, the on-the-way
-- and finished emails fire at those steps. Rescheduling sends nothing.
--
-- en_route_at: stamped the first time a tech taps "On The Way" on the
-- job. Idempotent — later taps do not move it.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS customer_notifications_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS en_route_at timestamptz;
