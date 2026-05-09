-- Expand invitation_events.event_type to include questionnaire submissions.

DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'invitation_events'
          AND c.contype = 'c'
          AND c.conname = 'invitation_events_event_type_check'
    LOOP
        EXECUTE format('ALTER TABLE public.invitation_events DROP CONSTRAINT IF EXISTS %I', rec.conname);
    END LOOP;
END $$;

ALTER TABLE invitation_events
ADD CONSTRAINT invitation_events_event_type_check
CHECK (
    event_type IN (
        'open',
        'poll_vote',
        'questionnaire_submit',
        'rsvp_submit',
        'delivery_sent',
        'delivery_failed'
    )
);

