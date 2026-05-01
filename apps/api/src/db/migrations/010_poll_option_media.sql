-- Poll option media support

ALTER TABLE poll_options
    ADD COLUMN IF NOT EXISTS icon_path TEXT;
