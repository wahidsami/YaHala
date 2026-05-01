import { Router } from 'express';
import pool from '../db/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/providers', requirePermission('settings.view'), async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            `
            SELECT
                COUNT(*) FILTER (WHERE status = 'queued')::int AS queued_count,
                COUNT(*) FILTER (WHERE status = 'processing')::int AS processing_count,
                COUNT(*) FILTER (WHERE status = 'sent')::int AS sent_count,
                COUNT(*) FILTER (WHERE status = 'retry_scheduled')::int AS retry_scheduled_count,
                COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count
            FROM invitation_delivery_jobs
            `
        );

        const summary = rows[0] || {};

        res.json({
            data: {
                email: {
                    provider: 'resend',
                    configured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
                    fromEmail: process.env.RESEND_FROM_EMAIL || '',
                    baseUrl: process.env.PUBLIC_INVITATION_BASE_URL || 'http://localhost:5173',
                    apiKeyConfigured: Boolean(process.env.RESEND_API_KEY)
                },
                worker: {
                    pollIntervalMs: Number.parseInt(process.env.DELIVERY_POLL_INTERVAL_MS || '15000', 10),
                    maxRetries: Number.parseInt(process.env.DELIVERY_MAX_RETRIES || '3', 10),
                    retryBaseDelayMs: Number.parseInt(process.env.DELIVERY_RETRY_BASE_DELAY_MS || '60000', 10)
                },
                queue: {
                    queued: summary.queued_count || 0,
                    processing: summary.processing_count || 0,
                    sent: summary.sent_count || 0,
                    retryScheduled: summary.retry_scheduled_count || 0,
                    failed: summary.failed_count || 0
                },
                channels: {
                    email: true,
                    whatsapp: false,
                    sms: false
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
