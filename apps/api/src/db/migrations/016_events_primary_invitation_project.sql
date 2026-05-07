ALTER TABLE events
ADD COLUMN IF NOT EXISTS primary_invitation_project_id UUID REFERENCES invitation_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_primary_invitation_project
ON events(primary_invitation_project_id);
