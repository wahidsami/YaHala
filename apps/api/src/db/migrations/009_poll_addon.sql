-- Poll addon foundation

CREATE TABLE IF NOT EXISTS polls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    title_ar VARCHAR(160),
    subtitle VARCHAR(220),
    subtitle_ar VARCHAR(220),
    description TEXT,
    description_ar TEXT,
    cover_image_path TEXT,
    theme_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    layout_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'ended', 'archived')),
    poll_mode VARCHAR(20) NOT NULL DEFAULT 'named' CHECK (poll_mode IN ('named', 'anonymous')),
    allow_multiple_choice BOOLEAN NOT NULL DEFAULT FALSE,
    require_login BOOLEAN NOT NULL DEFAULT FALSE,
    start_date TIMESTAMP NULL,
    end_date TIMESTAMP NULL,
    max_votes_per_user INT NOT NULL DEFAULT 1,
    show_results_mode VARCHAR(20) NOT NULL DEFAULT 'after_vote'
        CHECK (show_results_mode IN ('immediately', 'after_vote', 'after_end', 'hidden')),
    created_by UUID REFERENCES dashboard_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_polls_client
    ON polls(client_id);

CREATE INDEX IF NOT EXISTS idx_polls_event
    ON polls(event_id);

CREATE INDEX IF NOT EXISTS idx_polls_status
    ON polls(status);

CREATE INDEX IF NOT EXISTS idx_polls_mode
    ON polls(poll_mode);

CREATE TABLE IF NOT EXISTS poll_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    text VARCHAR(220) NOT NULL,
    text_ar VARCHAR(220),
    image_path TEXT,
    icon VARCHAR(80),
    color_override VARCHAR(40),
    sort_order INT NOT NULL DEFAULT 0,
    votes_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_poll_options_poll
    ON poll_options(poll_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_poll_options_votes
    ON poll_options(votes_count);

CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES client_guests(id) ON DELETE SET NULL,
    session_id VARCHAR(128),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (guest_id IS NOT NULL OR session_id IS NOT NULL),
    CHECK (NOT (guest_id IS NOT NULL AND session_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll
    ON poll_votes(poll_id);

CREATE INDEX IF NOT EXISTS idx_poll_votes_option
    ON poll_votes(option_id);

CREATE INDEX IF NOT EXISTS idx_poll_votes_guest
    ON poll_votes(guest_id);

CREATE INDEX IF NOT EXISTS idx_poll_votes_session
    ON poll_votes(session_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_poll_votes_guest_option
    ON poll_votes(poll_id, guest_id, option_id)
    WHERE guest_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_poll_votes_session_option
    ON poll_votes(poll_id, session_id, option_id)
    WHERE session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION sync_poll_option_votes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE poll_options
        SET votes_count = votes_count + 1,
            updated_at = NOW()
        WHERE id = NEW.option_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE poll_options
        SET votes_count = GREATEST(votes_count - 1, 0),
            updated_at = NOW()
        WHERE id = OLD.option_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.option_id <> OLD.option_id THEN
            UPDATE poll_options
            SET votes_count = GREATEST(votes_count - 1, 0),
                updated_at = NOW()
            WHERE id = OLD.option_id;

            UPDATE poll_options
            SET votes_count = votes_count + 1,
                updated_at = NOW()
            WHERE id = NEW.option_id;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_poll_votes_sync_count ON poll_votes;
CREATE TRIGGER trg_poll_votes_sync_count
AFTER INSERT OR UPDATE OF option_id OR DELETE ON poll_votes
FOR EACH ROW
EXECUTE FUNCTION sync_poll_option_votes_count();
