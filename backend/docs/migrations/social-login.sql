-- ==============================================================================
-- Taskoura Schema Migration: Social Login (password_login_enabled)
-- Target Database: PostgreSQL (Neon / Render / Local)
-- Safety: Non-destructive, idempotent, preserves all existing users and credentials.
-- ==============================================================================

-- Apply Migration:
-- Adds the password_login_enabled column with a NOT NULL constraint and DEFAULT true.
-- Existing rows automatically evaluate to true, preserving existing password login.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_login_enabled boolean NOT NULL DEFAULT true;

-- Verification Query (Expected: all rows should have password_login_enabled = true):
SELECT id, email, password_login_enabled FROM users;

-- ==============================================================================
-- Rollback Note:
-- To revert this column addition (caution: will remove tracking of OAuth-only accounts):
-- ALTER TABLE users DROP COLUMN IF EXISTS password_login_enabled;
-- ==============================================================================

