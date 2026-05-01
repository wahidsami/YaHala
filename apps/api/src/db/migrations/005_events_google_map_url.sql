-- Event Google Maps link

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS google_map_url TEXT;
