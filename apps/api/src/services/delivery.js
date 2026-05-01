import crypto from 'crypto';
import pool from '../db/connection.js';
import { AppError } from '../middleware/errorHandler.js';
import { buildInvitationEmailContent, getPublicInvitationBaseUrl, sendResendEmail } from './resend.js';

const DEFAULT_MAX_RETRIES = Number.parseInt(process.env.DELIVERY_MAX_RETRIES || '3', 10);
const DEFAULT_RETRY_BASE_DELAY_MS = Number.parseInt(process.env.DELIVERY_RETRY_BASE_DELAY_MS || '60000', 10);

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function safeJson(value, fallback = {}) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'object') return value;

    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function normalizeLanguage(language, fallback = 'ar') {
    if (language === 'en' || language === 'ar') {
        return language;
    }

    return fallback === 'en' ? 'en' : 'ar';
}

function buildInvitationLink(token) {
    return `${getPublicInvitationBaseUrl()}/invite/${token}`;
}

function generateUuid() {
    return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

function buildQueuedPayload({ project, recipient, language, publicLink }) {
    const content = buildInvitationEmailContent({
        project,
        recipient,
        publicLink,
        language
    });

    return {
        channel: 'email',
        to: recipient.email,
        subject: content.subject,
        text: content.text,
        html: content.html,
        language,
        publicLink,
        recipient: {
            id: recipient.id,
            displayName: recipient.display_name,
            displayNameAr: recipient.display_name_ar
        },
        project: {
            id: project.id,
            name: project.name,
            nameAr: project.name_ar
        },
        source: 'admin'
    };
}

export async function enqueueEmailDeliveries({
    db,
    project,
    recipients,
    scheduledFor = null,
    createdBy = null
}) {
    const scheduledValue = scheduledFor ? new Date(scheduledFor) : null;
    if (scheduledValue && Number.isNaN(scheduledValue.getTime())) {
        throw new AppError('Scheduled date is invalid', 400, 'VALIDATION_ERROR');
    }

    const jobs = [];

    for (const recipient of recipients) {
        const language = normalizeLanguage(recipient.preferred_language, project.default_language || 'ar');
        const publicLink = buildInvitationLink(recipient.public_token);
        const payload = buildQueuedPayload({ project, recipient, language, publicLink });
        const deliveryJobId = generateUuid();

        await db.query(
            `
            INSERT INTO invitation_delivery_jobs (
                id,
                project_id,
                recipient_id,
                channel,
                status,
                scheduled_for,
                priority,
                attempt_count,
                payload,
                created_by,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, 'email', 'queued', $4, 5, 0, $5::jsonb, $6, NOW(), NOW())
            `,
            [
                deliveryJobId,
                project.id,
                recipient.id,
                scheduledValue ? scheduledValue.toISOString() : null,
                JSON.stringify(payload),
                createdBy
            ]
        );

        jobs.push({
            id: deliveryJobId,
            recipientId: recipient.id,
            email: recipient.email,
            scheduledFor: scheduledValue ? scheduledValue.toISOString() : null,
            payload
        });
    }

    return jobs;
}

async function claimDueJobs(db, { jobIds = null, limit = 50 } = {}) {
    const params = [];
    let whereClause = `
        channel = 'email'
        AND status IN ('queued', 'retry_scheduled')
        AND (scheduled_for IS NULL OR scheduled_for <= NOW())
    `;

    if (Array.isArray(jobIds) && jobIds.length) {
        whereClause += ` AND id = ANY($1::uuid[])`;
        params.push(jobIds);
    }

    params.push(limit);
    const limitIndex = params.length;

    const { rows } = await db.query(
        `
        WITH picked AS (
            SELECT id
            FROM invitation_delivery_jobs
            WHERE ${whereClause}
            ORDER BY COALESCE(scheduled_for, created_at) ASC, priority ASC, created_at ASC
            LIMIT $${limitIndex}
            FOR UPDATE SKIP LOCKED
        )
        UPDATE invitation_delivery_jobs j
        SET
            status = 'processing',
            attempt_count = attempt_count + 1,
            updated_at = NOW()
        FROM picked
        WHERE j.id = picked.id
        RETURNING j.*
        `,
        params
    );

    return rows;
}

async function recordAttempt(db, {
    deliveryJobId,
    attemptNo,
    status,
    requestPayload,
    responsePayload = {},
    httpStatus = null,
    errorMessage = null,
    providerEventId = null
}) {
    await db.query(
        `
        INSERT INTO invitation_delivery_attempts (
            id,
            delivery_job_id,
            attempt_no,
            request_payload,
            response_payload,
            http_status,
            status,
            error_message,
            provider_event_id,
            started_at,
            finished_at,
            created_at
        )
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, NOW(), NOW(), NOW())
        `,
        [
            generateUuid(),
            deliveryJobId,
            attemptNo,
            JSON.stringify(requestPayload || {}),
            JSON.stringify(responsePayload || {}),
            httpStatus,
            status,
            errorMessage,
            providerEventId
        ]
    );
}

async function finalizeSuccess(db, job, providerResponse) {
    const payload = safeJson(job.payload, {});
    const nowIso = new Date().toISOString();

    await db.query(
        `
        UPDATE invitation_delivery_jobs
        SET
            status = 'sent',
            provider_message_id = $2,
            sent_at = COALESCE(sent_at, NOW()),
            last_error = NULL,
            updated_at = NOW()
        WHERE id = $1
        `,
        [job.id, providerResponse?.id || null]
    );

    await db.query(
        `
        UPDATE invitation_recipients
        SET
            overall_status = CASE
                WHEN overall_status IN ('draft', 'queued', 'failed', 'retry_scheduled', 'processing') THEN 'sent'
                ELSE overall_status
            END,
            invited_at = COALESCE(invited_at, NOW()),
            updated_at = NOW()
        WHERE id = $1
        `,
        [job.recipient_id]
    );

    await db.query(
        `
        INSERT INTO invitation_events (
            id,
            project_id,
            recipient_id,
            event_type,
            event_name,
            event_data
        )
        VALUES ($1, $2, $3, 'delivery_sent', $4, $5)
        `,
        [
            generateUuid(),
            job.project_id,
            job.recipient_id,
            'Invitation email sent',
            JSON.stringify({
                channel: 'email',
                email: payload.to || null,
                language: payload.language || null,
                providerMessageId: providerResponse?.id || null,
                sentAt: nowIso
            })
        ]
    );
}

async function finalizeFailure(db, job, error) {
    const payload = safeJson(job.payload, {});
    const attemptNo = job.attempt_count || 1;
    const shouldRetry = attemptNo < DEFAULT_MAX_RETRIES;
    const nextScheduledFor = shouldRetry
        ? new Date(Date.now() + (DEFAULT_RETRY_BASE_DELAY_MS * Math.pow(2, attemptNo - 1)))
        : null;
    const nextStatus = shouldRetry ? 'retry_scheduled' : 'failed';
    const failedAt = shouldRetry ? null : new Date().toISOString();

    await recordAttempt(db, {
        deliveryJobId: job.id,
        attemptNo,
        status: 'failed',
        requestPayload: payload,
        responsePayload: {
            error: error.message
        },
        httpStatus: error.response?.status || null,
        errorMessage: error.message
    });

    await db.query(
        `
        UPDATE invitation_delivery_jobs
        SET
            status = $2::text,
            scheduled_for = $3,
            last_error = $4,
            failed_at = $5,
            updated_at = NOW()
        WHERE id = $1
        `,
        [job.id, nextStatus, nextScheduledFor, error.message, failedAt]
    );

    if (!shouldRetry) {
        await db.query(
            `
            UPDATE invitation_recipients
            SET
                overall_status = CASE
                    WHEN overall_status IN ('draft', 'queued', 'processing', 'retry_scheduled') THEN 'failed'
                    ELSE overall_status
                END,
                updated_at = NOW()
            WHERE id = $1
            `,
            [job.recipient_id]
        );

        await db.query(
            `
            INSERT INTO invitation_events (
                id,
                project_id,
                recipient_id,
                event_type,
                event_name,
                event_data
            )
            VALUES ($1, $2, $3, 'delivery_failed', $4, $5)
            `,
            [
                generateUuid(),
                job.project_id,
                job.recipient_id,
                'Invitation email failed',
                JSON.stringify({
                    channel: 'email',
                    email: payload.to || null,
                    error: error.message
                })
            ]
        );
    }

    return {
        shouldRetry,
        nextScheduledFor: nextScheduledFor ? nextScheduledFor.toISOString() : null
    };
}

async function processJob(job, { trace = false } = {}) {
    const db = await pool.connect();

    try {
        const payload = safeJson(job.payload, {});
        const requestPayload = {
            to: payload.to || null,
            subject: payload.subject || '',
            text: payload.text || '',
            html: payload.html || ''
        };
        const traceSteps = trace
            ? [{
                at: new Date().toISOString(),
                step: 'job_loaded',
                jobId: job.id,
                recipientId: job.recipient_id,
                to: requestPayload.to,
                attemptNo: job.attempt_count || 1,
                status: job.status
            }]
            : null;

        try {
            traceSteps?.push({
                at: new Date().toISOString(),
                step: 'provider_send_start',
                provider: 'resend',
                to: requestPayload.to
            });

            const providerResponse = await sendResendEmail(requestPayload);

            traceSteps?.push({
                at: new Date().toISOString(),
                step: 'provider_send_success',
                provider: 'resend',
                providerMessageId: providerResponse?.id || null,
                responseBody: providerResponse,
                responseSummary: providerResponse?.id || null
            });

            await db.query('BEGIN');
            await recordAttempt(db, {
                deliveryJobId: job.id,
                attemptNo: job.attempt_count || 1,
                status: 'sent',
                requestPayload,
                responsePayload: providerResponse,
                httpStatus: 200,
                providerEventId: providerResponse?.id || null
            });
            await finalizeSuccess(db, job, providerResponse);
            await db.query('COMMIT');

            return {
                jobId: job.id,
                status: 'sent',
                recipientId: job.recipient_id,
                scheduledFor: null,
                requestPayload,
                providerResponse,
                trace: traceSteps || undefined
            };
        } catch (error) {
            traceSteps?.push({
                at: new Date().toISOString(),
                step: 'provider_send_failed',
                provider: 'resend',
                error: error.message,
                httpStatus: error.response?.status || null,
                errorBody: error.response?.data || null,
                errorSummary: error.response?.data?.message || error.message
            });

            await db.query('BEGIN');
            const failureResult = await finalizeFailure(db, job, error);
            await db.query('COMMIT');

            return {
                jobId: job.id,
                status: failureResult.shouldRetry ? 'retry_scheduled' : 'failed',
                recipientId: job.recipient_id,
                scheduledFor: failureResult.nextScheduledFor,
                error: error.message,
                requestPayload,
                trace: traceSteps || undefined
            };
        }
    } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        db.release();
    }
}

export async function processEmailDeliveryQueue({ jobIds = null, limit = 50, trace = false } = {}) {
    const db = await pool.connect();

    try {
        await db.query('BEGIN');
        const jobs = await claimDueJobs(db, { jobIds, limit });
        await db.query('COMMIT');

        if (!jobs.length) {
            return {
                claimed: 0,
                sent: 0,
                failed: 0,
                retryScheduled: 0,
                jobs: [],
                trace: trace ? {
                    claimedJobs: [],
                    processedJobs: []
                } : undefined
            };
        }

        const results = [];
        let sent = 0;
        let failed = 0;
        let retryScheduled = 0;

        for (const job of jobs) {
            const result = await processJob(job, { trace });
            results.push(result);

            if (result.status === 'sent') {
                sent++;
            } else if (result.status === 'retry_scheduled') {
                retryScheduled++;
            } else {
                failed++;
            }
        }

        return {
            claimed: jobs.length,
            sent,
            failed,
            retryScheduled,
            jobs: results,
            trace: trace ? {
                claimedJobs: jobs.map((job) => ({
                    jobId: job.id,
                    recipientId: job.recipient_id,
                    channel: job.channel,
                    status: job.status,
                    attemptCount: job.attempt_count,
                    scheduledFor: job.scheduled_for ? new Date(job.scheduled_for).toISOString() : null,
                    createdAt: job.created_at ? new Date(job.created_at).toISOString() : null
                })),
                processedJobs: results
            } : undefined
        };
    } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        db.release();
    }
}
