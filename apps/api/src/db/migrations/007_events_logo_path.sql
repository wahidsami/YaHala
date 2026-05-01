-- Event logo path

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS event_logo_path TEXT;
