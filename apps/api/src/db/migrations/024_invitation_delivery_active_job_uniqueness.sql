-- Prevent duplicate active email delivery jobs per recipient/project/channel.
-- 1) Resolve existing active duplicates deterministically.
-- 2) Add partial unique index as a schema-level idempotency guard.

WITH ranked_active_jobs AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY project_id, recipient_id, channel
            ORDER BY created_at ASC, id ASC
        ) AS rn
    FROM invitation_delivery_jobs
    WHERE status IN ('queued', 'processing', 'retry_scheduled')
)
UPDATE invitation_delivery_jobs j
SET
    status = 'failed',
    last_error = COALESCE(j.last_error, 'Marked failed by migration 024: duplicate active delivery job'),
    failed_at = COALESCE(j.failed_at, NOW()),
    updated_at = NOW()
FROM ranked_active_jobs r
WHERE j.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_invitation_delivery_jobs_active_unique
    ON invitation_delivery_jobs (project_id, recipient_id, channel)
    WHERE status IN ('queued', 'processing', 'retry_scheduled');
