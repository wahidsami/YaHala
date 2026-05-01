-- Invitation recipients client guest linkage

ALTER TABLE invitation_recipients
    ADD COLUMN IF NOT EXISTS client_guest_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'invitation_recipients_client_guest_id_fkey'
          AND conrelid = 'invitation_recipients'::regclass
    ) THEN
        ALTER TABLE invitation_recipients
            ADD CONSTRAINT invitation_recipients_client_guest_id_fkey
            FOREIGN KEY (client_guest_id)
            REFERENCES client_guests(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invitation_recipients_client_guest
    ON invitation_recipients(client_guest_id);
