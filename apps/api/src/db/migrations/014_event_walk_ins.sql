-- Walk-in guests checked in by scanner users

CREATE TABLE IF NOT EXISTS event_walk_ins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    client_guest_id UUID NOT NULL REFERENCES client_guests(id) ON DELETE CASCADE,
    scanner_user_id UUID REFERENCES scanner_users(id) ON DELETE SET NULL,
    check_in_status VARCHAR(20) NOT NULL DEFAULT 'checked_in' CHECK (check_in_status IN ('checked_in')),
    checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (event_id, client_guest_id)
);

CREATE INDEX IF NOT EXISTS idx_event_walk_ins_event
    ON event_walk_ins(event_id);

CREATE INDEX IF NOT EXISTS idx_event_walk_ins_client
    ON event_walk_ins(client_id);

CREATE INDEX IF NOT EXISTS idx_event_walk_ins_guest
    ON event_walk_ins(client_guest_id);
