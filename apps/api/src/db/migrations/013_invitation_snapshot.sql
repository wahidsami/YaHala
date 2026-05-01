-- Invitation snapshot versioning

ALTER TABLE invitation_recipients
    ADD COLUMN IF NOT EXISTS invitation_snapshot JSONB,
    ADD COLUMN IF NOT EXISTS invitation_snapshot_hash TEXT,
    ADD COLUMN IF NOT EXISTS invitation_snapshot_at TIMESTAMP;

