-- Client owned guests directory

CREATE TABLE IF NOT EXISTS client_guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    avatar_path TEXT,
    name VARCHAR(120) NOT NULL,
    position VARCHAR(120),
    email VARCHAR(255),
    mobile_number VARCHAR(30),
    gender VARCHAR(20) DEFAULT 'male' CHECK (gender IN ('male', 'female', 'other')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'banned')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_guests_client
    ON client_guests(client_id);

CREATE INDEX IF NOT EXISTS idx_client_guests_status
    ON client_guests(status);

CREATE INDEX IF NOT EXISTS idx_client_guests_gender
    ON client_guests(gender);

