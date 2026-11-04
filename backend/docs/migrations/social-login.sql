-- ==============================================================================
-- Taskoura Schema Migration: Social Login (password_login_enabled & OAuth tables)
-- Target Database: PostgreSQL (Neon / Render / Local)
-- Safety: Non-destructive, idempotent, preserves all existing users and credentials.
-- ==============================================================================

-- Apply Migration:
-- 1. Adds the password_login_enabled column with a NOT NULL constraint and DEFAULT true.
-- Existing rows automatically evaluate to true, preserving existing password login.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_login_enabled boolean NOT NULL DEFAULT true;

-- 2. Ensures the oauth_identities table exists
CREATE TABLE IF NOT EXISTS oauth_identities (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    email_at_link VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT uk_oauth_provider_provider_user_id UNIQUE (provider, provider_user_id),
    CONSTRAINT uk_oauth_user_id_provider UNIQUE (user_id, provider)
);

-- 3. Ensures the oauth_login_codes table exists
CREATE TABLE IF NOT EXISTS oauth_login_codes (
    id UUID PRIMARY KEY,
    hashed_code VARCHAR(128) NOT NULL UNIQUE,
    user_id UUID NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_oauth_login_codes_hashed ON oauth_login_codes (hashed_code);

-- Verification Query (Expected: all rows should have password_login_enabled = true):
SELECT id, email, password_login_enabled FROM users;

-- ==============================================================================
-- Rollback Note:
-- To revert this migration:
-- DROP TABLE IF EXISTS oauth_login_codes;
-- DROP TABLE IF EXISTS oauth_identities;
-- ALTER TABLE users DROP COLUMN IF EXISTS password_login_enabled;
-- ==============================================================================
