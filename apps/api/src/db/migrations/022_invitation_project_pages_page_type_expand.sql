-- Expand invitation_project_pages.page_type check to support addon pages.

DO $$
DECLARE
    rec RECORD;
BEGIN
    -- Drop any existing page_type check constraints on invitation_project_pages.
    FOR rec IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'invitation_project_pages'
          AND c.contype = 'c'
          AND (
              c.conname = 'invitation_project_pages_page_type_check'
              OR pg_get_constraintdef(c.oid) ILIKE '%page_type%'
          )
    LOOP
        EXECUTE format('ALTER TABLE public.invitation_project_pages DROP CONSTRAINT IF EXISTS %I', rec.conname);
    END LOOP;
END $$;

ALTER TABLE invitation_project_pages
    ADD CONSTRAINT invitation_project_pages_page_type_check
    CHECK (
        page_type IN (
            'cover',
            'rsvp',
            'poll',
            'questionnaire',
            'instructions',
            'quiz',
            'competition',
            'terms',
            'custom',
            'guest_book',
            'files_downloads'
        )
    );
