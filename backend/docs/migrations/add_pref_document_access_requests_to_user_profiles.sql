-- ==============================================================================
-- Taskoura Schema Migration: Add Missing pref_document_access_requests Column
-- Target Database: PostgreSQL (Neon / Render / Local)
-- Safety: Non-destructive, idempotent, preserves all existing user_profiles rows.
-- Operational Note: Uses a transaction with SET LOCAL lock_timeout = '5s' to
--                   prevent long lock waits during catalog metadata update.
-- ==============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS pref_document_access_requests BOOLEAN NOT NULL DEFAULT TRUE;

COMMIT;
