-- ==============================================================================
-- Taskoura Schema Migration: BioLock Hardware Biometric Protection
-- Target Database: PostgreSQL (Neon / Render / Local)
-- Safety: Non-destructive, idempotent, preserves all existing tables and rows.
-- ==============================================================================

-- 1. Attachment restricted column (defaults to false so existing rows remain valid)
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS restricted BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. BioLock Devices Table
CREATE TABLE IF NOT EXISTS biolock_devices (
    id UUID PRIMARY KEY,
    owner_user_id UUID NOT NULL,
    name VARCHAR(120) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    key_version INTEGER NOT NULL DEFAULT 1,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_biolock_devices_owner ON biolock_devices (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_biolock_devices_status ON biolock_devices (status);

-- Partial index: Exactly one ACTIVE device per project leader
CREATE UNIQUE INDEX IF NOT EXISTS uk_biolock_devices_active_leader 
    ON biolock_devices (owner_user_id) 
    WHERE status = 'ACTIVE';

-- 3. Biometric Credentials Table (Sensor slot references, no biometric templates or images stored)
CREATE TABLE IF NOT EXISTS biometric_credentials (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    device_id UUID NOT NULL,
    sensor_slot_id INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    enrolled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    unused_since TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_biolock_cred_user ON biometric_credentials (user_id);
CREATE INDEX IF NOT EXISTS idx_biolock_cred_device ON biometric_credentials (device_id);
CREATE INDEX IF NOT EXISTS idx_biolock_cred_status ON biometric_credentials (status);

-- Partial index: Unique sensor slot on device while credential is not DELETED
CREATE UNIQUE INDEX IF NOT EXISTS uk_biolock_credentials_active_slot 
    ON biometric_credentials (device_id, sensor_slot_id) 
    WHERE status != 'DELETED';

-- Partial index: One non-DELETED credential per user per device
CREATE UNIQUE INDEX IF NOT EXISTS uk_biolock_credentials_active_user_device 
    ON biometric_credentials (user_id, device_id) 
    WHERE status != 'DELETED';

-- 4. Project Biometric Settings Table
CREATE TABLE IF NOT EXISTS project_biometric_settings (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    credential_id UUID,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_project_biometric_settings_project_id UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_proj_biolock_credential ON project_biometric_settings (credential_id);

-- 5. BioLock Jobs Table
CREATE TABLE IF NOT EXISTS biolock_jobs (
    id UUID PRIMARY KEY,
    type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
    device_id UUID NOT NULL,
    credential_id UUID,
    access_request_id UUID,
    slot INTEGER,
    challenge VARCHAR(128) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    claimed_at TIMESTAMP WITH TIME ZONE,
    lease_until TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    outcome VARCHAR(64),
    reason VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS idx_biolock_jobs_device ON biolock_jobs (device_id);
CREATE INDEX IF NOT EXISTS idx_biolock_jobs_status ON biolock_jobs (status);
CREATE INDEX IF NOT EXISTS idx_biolock_jobs_expires_at ON biolock_jobs (expires_at);
CREATE INDEX IF NOT EXISTS idx_biolock_jobs_lease_until ON biolock_jobs (lease_until);

-- 6. Device Nonces Table (HMAC Replay Protection)
CREATE TABLE IF NOT EXISTS device_nonces (
    id UUID PRIMARY KEY,
    device_id UUID NOT NULL,
    nonce VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uk_device_nonces_device_nonce UNIQUE (device_id, nonce)
);

CREATE INDEX IF NOT EXISTS idx_device_nonces_expires ON device_nonces (expires_at);

-- 7. Document Access Requests Table
CREATE TABLE IF NOT EXISTS document_access_requests (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    attachment_id UUID NOT NULL,
    task_id UUID,
    requester_id UUID NOT NULL,
    leader_id UUID NOT NULL,
    credential_id UUID NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    decided_at TIMESTAMP WITH TIME ZONE,
    access_expires_at TIMESTAMP WITH TIME ZONE,
    decided_by_device_id UUID,
    failure_reason VARCHAR(500),
    leader_email_status VARCHAR(32) NOT NULL DEFAULT 'NOT_SENT',
    leader_email_attempts INTEGER NOT NULL DEFAULT 0,
    leader_email_sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_doc_req_attachment ON document_access_requests (attachment_id);
CREATE INDEX IF NOT EXISTS idx_doc_req_requester ON document_access_requests (requester_id);
CREATE INDEX IF NOT EXISTS idx_doc_req_leader ON document_access_requests (leader_id);
CREATE INDEX IF NOT EXISTS idx_doc_req_status ON document_access_requests (status);
CREATE INDEX IF NOT EXISTS idx_doc_req_expires ON document_access_requests (expires_at);
CREATE INDEX IF NOT EXISTS idx_doc_req_access_expires ON document_access_requests (access_expires_at);

-- Partial unique index: Exactly one PENDING request per (attachmentId, requesterId)
CREATE UNIQUE INDEX IF NOT EXISTS uk_biolock_access_requests_pending 
    ON document_access_requests (attachment_id, requester_id) 
    WHERE status = 'PENDING';

-- 8. BioLock Audit Events Table
CREATE TABLE IF NOT EXISTS biolock_audit_events (
    id UUID PRIMARY KEY,
    type VARCHAR(64) NOT NULL,
    actor_user_id UUID,
    device_id UUID,
    project_id UUID,
    request_id UUID,
    job_id UUID,
    detail VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_biolock_audit_project ON biolock_audit_events (project_id);
CREATE INDEX IF NOT EXISTS idx_biolock_audit_device ON biolock_audit_events (device_id);
CREATE INDEX IF NOT EXISTS idx_biolock_audit_created ON biolock_audit_events (created_at);

-- ==============================================================================
-- Rollback Note:
-- To revert this migration:
-- DROP TABLE IF EXISTS biolock_audit_events;
-- DROP TABLE IF EXISTS document_access_requests;
-- DROP TABLE IF EXISTS device_nonces;
-- DROP TABLE IF EXISTS biolock_jobs;
-- DROP TABLE IF EXISTS project_biometric_settings;
-- DROP TABLE IF EXISTS biometric_credentials;
-- DROP TABLE IF EXISTS biolock_devices;
-- ALTER TABLE attachments DROP COLUMN IF EXISTS restricted;
-- ==============================================================================
