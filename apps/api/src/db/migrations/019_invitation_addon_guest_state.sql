CREATE TABLE IF NOT EXISTS invitation_addon_guest_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES invitation_projects(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES invitation_recipients(id) ON DELETE CASCADE,
    page_id UUID NOT NULL REFERENCES invitation_project_pages(id) ON DELETE CASCADE,
    page_key VARCHAR(120) NOT NULL,
    addon_type VARCHAR(40) NOT NULL,
    addon_id UUID,
    is_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
    unlocked_by VARCHAR(40),
    unlocked_at TIMESTAMP,
    scanner_manual_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    scanner_manual_enabled_by UUID,
    scanner_manual_enabled_at TIMESTAMP,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMP,
    completion_source VARCHAR(40),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, recipient_id, page_id)
);

CREATE INDEX IF NOT EXISTS idx_addon_guest_state_project_recipient
    ON invitation_addon_guest_state (project_id, recipient_id);

CREATE INDEX IF NOT EXISTS idx_addon_guest_state_page_key
    ON invitation_addon_guest_state (project_id, page_key);

CREATE INDEX IF NOT EXISTS idx_addon_guest_state_unlock
    ON invitation_addon_guest_state (project_id, is_unlocked, is_completed);
