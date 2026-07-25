-- Sprint 24: Initial schema baseline
--
-- This migration establishes the migration pipeline infrastructure.
-- It creates the schema foundation that subsequent feature migrations build upon.
--
-- Subsequent migrations follow the naming convention:
--   YYYYMMDDHHMMSS_short_description.sql
--
-- All migrations are applied in timestamp order and are irreversible by default.
-- To roll back a change, create a new forward migration that reverses it.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP EXTENSION IF EXISTS pgcrypto;
--   DROP EXTENSION IF EXISTS "uuid-ossp";

-- Enable commonly-used Postgres extensions.
-- These are safe to run multiple times (IF NOT EXISTS semantics).
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
