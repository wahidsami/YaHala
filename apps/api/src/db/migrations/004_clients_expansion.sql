-- Client expansion for enterprise profile metadata

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS logo_path TEXT,
    ADD COLUMN IF NOT EXISTS website_url VARCHAR(255),
    ADD COLUMN IF NOT EXISTS contact_person VARCHAR(150),
    ADD COLUMN IF NOT EXISTS company_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS company_sector VARCHAR(120),
    ADD COLUMN IF NOT EXISTS address_region VARCHAR(100),
    ADD COLUMN IF NOT EXISTS address_city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS address_district VARCHAR(100),
    ADD COLUMN IF NOT EXISTS address_street VARCHAR(150),
    ADD COLUMN IF NOT EXISTS address_building_number VARCHAR(30),
    ADD COLUMN IF NOT EXISTS address_additional_number VARCHAR(30),
    ADD COLUMN IF NOT EXISTS address_postal_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS address_unit_number VARCHAR(30);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'clients_company_type_check'
          AND conrelid = 'clients'::regclass
    ) THEN
        ALTER TABLE clients
            ADD CONSTRAINT clients_company_type_check
            CHECK (company_type IS NULL OR company_type IN ('gov', 'private'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_company_type
    ON clients(company_type);

CREATE INDEX IF NOT EXISTS idx_clients_company_sector
    ON clients(company_sector);

