-- Ensure guest duplicate checks are scoped per client, not global across all clients.
-- This migration:
-- 1) Drops legacy/global uniqueness constraints/indexes on client_guests email/mobile (if any exist).
-- 2) Adds partial unique indexes scoped by client_id.

DO $$
DECLARE
    rec RECORD;
BEGIN
    -- Drop UNIQUE constraints on client_guests that target email/mobile without client_id.
    FOR rec IN
        SELECT
            c.conname AS constraint_name
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'client_guests'
          AND c.contype = 'u'
          AND pg_get_constraintdef(c.oid) ILIKE '%email%'
          AND pg_get_constraintdef(c.oid) NOT ILIKE '%client_id%'
    LOOP
        EXECUTE format('ALTER TABLE public.client_guests DROP CONSTRAINT IF EXISTS %I', rec.constraint_name);
    END LOOP;

    FOR rec IN
        SELECT
            c.conname AS constraint_name
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'client_guests'
          AND c.contype = 'u'
          AND pg_get_constraintdef(c.oid) ILIKE '%mobile_number%'
          AND pg_get_constraintdef(c.oid) NOT ILIKE '%client_id%'
    LOOP
        EXECUTE format('ALTER TABLE public.client_guests DROP CONSTRAINT IF EXISTS %I', rec.constraint_name);
    END LOOP;

    -- Drop UNIQUE indexes on client_guests that target email/mobile without client_id.
    FOR rec IN
        SELECT
            i.indexname
        FROM pg_indexes i
        WHERE i.schemaname = 'public'
          AND i.tablename = 'client_guests'
          AND i.indexdef ILIKE 'CREATE UNIQUE INDEX%'
          AND i.indexdef ILIKE '%email%'
          AND i.indexdef NOT ILIKE '%client_id%'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', rec.indexname);
    END LOOP;

    FOR rec IN
        SELECT
            i.indexname
        FROM pg_indexes i
        WHERE i.schemaname = 'public'
          AND i.tablename = 'client_guests'
          AND i.indexdef ILIKE 'CREATE UNIQUE INDEX%'
          AND i.indexdef ILIKE '%mobile_number%'
          AND i.indexdef NOT ILIKE '%client_id%'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', rec.indexname);
    END LOOP;
END $$;

-- Enforce uniqueness only within each client.
CREATE UNIQUE INDEX IF NOT EXISTS ux_client_guests_client_email
    ON client_guests (client_id, LOWER(email))
    WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_client_guests_client_mobile
    ON client_guests (client_id, mobile_number)
    WHERE mobile_number IS NOT NULL;
