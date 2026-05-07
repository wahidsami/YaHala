WITH ranked_projects AS (
    SELECT
        p.id,
        p.event_id,
        ROW_NUMBER() OVER (
            PARTITION BY p.event_id
            ORDER BY
                CASE WHEN p.status IN ('active', 'draft', 'paused') THEN 0 ELSE 1 END,
                p.updated_at DESC NULLS LAST,
                p.created_at DESC NULLS LAST
        ) AS rn
    FROM invitation_projects p
),
selected_projects AS (
    SELECT event_id, id AS project_id
    FROM ranked_projects
    WHERE rn = 1
)
UPDATE events e
SET
    primary_invitation_project_id = sp.project_id,
    updated_at = NOW()
FROM selected_projects sp
WHERE e.id = sp.event_id
  AND e.primary_invitation_project_id IS NULL;
