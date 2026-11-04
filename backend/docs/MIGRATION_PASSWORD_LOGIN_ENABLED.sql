-- ==============================================================================
-- Taskoura Production Schema Migration: password_login_enabled
-- Target Database: PostgreSQL (Neon / Render)
-- Execution: Run in Neon Console SQL Editor or psql before/during deployment.
-- Safety: Non-destructive, idempotent, preserves all existing users and credentials.
-- ==============================================================================

-- Step 1: Add column as nullable first (safe if table already has rows)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_login_enabled boolean;

-- Step 2: Backfill existing records:
-- Existing users with a valid password hash have password login enabled (true).
-- Users without password credentials (OAuth-only) have password login disabled (false).
UPDATE users
SET password_login_enabled = (password_hash IS NOT NULL AND password_hash <> '')
WHERE password_login_enabled IS NULL;

-- Step 3: Establish a safe default for newly inserted records
ALTER TABLE users ALTER COLUMN password_login_enabled SET DEFAULT true;

-- Step 4: Apply NOT NULL constraint safely now that all rows have non-null values
ALTER TABLE users ALTER COLUMN password_login_enabled SET NOT NULL;

-- Verification Query (Expected: 0 rows returned)
SELECT id, email, password_login_enabled
FROM users
WHERE password_login_enabled IS NULL;

