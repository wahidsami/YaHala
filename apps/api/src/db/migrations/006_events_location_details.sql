-- Event location details

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS location_mode VARCHAR(20) DEFAULT 'maps',
    ADD COLUMN IF NOT EXISTS address_region TEXT,
    ADD COLUMN IF NOT EXISTS address_city TEXT,
    ADD COLUMN IF NOT EXISTS address_district TEXT,
    ADD COLUMN IF NOT EXISTS address_street TEXT,
    ADD COLUMN IF NOT EXISTS address_building_number TEXT,
    ADD COLUMN IF NOT EXISTS address_additional_number TEXT,
    ADD COLUMN IF NOT EXISTS address_postal_code TEXT,
    ADD COLUMN IF NOT EXISTS address_unit_number TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'events_location_mode_check'
          AND conrelid = 'events'::regclass
    ) THEN
        ALTER TABLE events
            ADD CONSTRAINT events_location_mode_check
            CHECK (location_mode IS NULL OR location_mode IN ('maps', 'manual'));
    END IF;
END $$;
