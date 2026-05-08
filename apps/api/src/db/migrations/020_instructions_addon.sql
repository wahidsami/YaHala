CREATE TABLE IF NOT EXISTS instructions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(180) NOT NULL,
    name_ar VARCHAR(180),
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    content_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    editor_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES dashboard_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_instructions_client
    ON instructions(client_id);

CREATE INDEX IF NOT EXISTS idx_instructions_status
    ON instructions(status);

CREATE INDEX IF NOT EXISTS idx_instructions_created_at
    ON instructions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_instructions_name_lower
    ON instructions((LOWER(name)));
