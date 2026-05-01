-- Client guests organization field

ALTER TABLE client_guests
    ADD COLUMN IF NOT EXISTS organization VARCHAR(160);

CREATE INDEX IF NOT EXISTS idx_client_guests_organization
    ON client_guests(organization);
