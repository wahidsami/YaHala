import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pool from '../db/connection.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const SCANNER_JWT_SECRET = process.env.SCANNER_JWT_SECRET || process.env.JWT_ACCESS_SECRET;

function safeJson(value, fallback = {}) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'object') return value;

    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function extractInvitationToken(value) {
    const rawValue = normalizeText(value);

    if (!rawValue) {
        return '';
    }

    if (!rawValue.includes('://')) {
        return rawValue;
    }

    try {
        const parsed = new URL(rawValue);
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        const inviteIndex = pathParts.findIndex((part) => part === 'invite' || part === 'i');

        if (inviteIndex >= 0 && pathParts[inviteIndex + 1]) {
            return pathParts[inviteIndex + 1];
        }

        const queryToken = parsed.searchParams.get('token') || parsed.searchParams.get('invite');
        if (queryToken) {
            return normalizeText(queryToken);
        }
    } catch {
        return rawValue;
    }

    return rawValue;
}

function signScannerToken(scannerUser) {
    return jwt.sign(
        {
            scannerUserId: scannerUser.id,
            clientId: scannerUser.client_id,
            role: 'scanner'
        },
        SCANNER_JWT_SECRET,
        { expiresIn: process.env.SCANNER_JWT_EXPIRES || '8h' }
    );
}

async function authenticateScanner(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            throw new AppError('No scanner token provided', 401, 'NO_SCANNER_TOKEN');
        }

        const token = authHeader.split(' ')[1];
        let decoded;

        try {
            decoded = jwt.verify(token, SCANNER_JWT_SECRET);
        } catch {
            throw new AppError('Invalid scanner token', 401, 'INVALID_SCANNER_TOKEN');
        }

        if (decoded.role !== 'scanner') {
            throw new AppError('Invalid scanner session', 401, 'INVALID_SCANNER_SESSION');
        }

        const { rows } = await pool.query(
            `
            SELECT s.id, s.client_id, s.name, s.status, c.name AS client_name, c.name_ar AS client_name_ar
            FROM scanner_users s
            JOIN clients c ON c.id = s.client_id
            WHERE s.id = $1
            `,
            [decoded.scannerUserId]
        );

        if (!rows.length) {
            throw new AppError('Scanner user not found', 401, 'SCANNER_NOT_FOUND');
        }

        const scannerUser = rows[0];

        if (scannerUser.status !== 'active') {
            throw new AppError('Scanner account inactive', 403, 'SCANNER_INACTIVE');
        }

        req.scannerUser = scannerUser;
        next();
    } catch (error) {
        next(error);
    }
}

// POST /api/scanner/auth/login
router.post('/auth/login', async (req, res, next) => {
    try {
        const clientIdentifier = normalizeText(req.body?.clientIdentifier || req.body?.clientId);
        const name = normalizeText(req.body?.name);
        const pin = normalizeText(req.body?.pin);

        if (!clientIdentifier || !name || !pin) {
            throw new AppError('Client, name, and PIN are required', 400, 'VALIDATION_ERROR');
        }

        const { rows: clientRows } = await pool.query(
            `
            SELECT id, name, name_ar, email
            FROM clients
            WHERE CAST(id AS TEXT) = $1 OR LOWER(email) = LOWER($1)
            LIMIT 1
            `,
            [clientIdentifier]
        );

        if (!clientRows.length) {
            throw new AppError('Entity not found', 404, 'CLIENT_NOT_FOUND');
        }

        const client = clientRows[0];

        const { rows } = await pool.query(
            `
            SELECT s.*, c.name AS client_name, c.name_ar AS client_name_ar
            FROM scanner_users s
            JOIN clients c ON c.id = s.client_id
            WHERE s.client_id = $1
              AND LOWER(s.name) = LOWER($2)
            LIMIT 1
            `,
            [client.id, name]
        );

        if (!rows.length) {
            throw new AppError('Invalid scanner credentials', 401, 'INVALID_SCANNER_CREDENTIALS');
        }

        const scannerUser = rows[0];

        if (scannerUser.status !== 'active') {
            throw new AppError('Scanner account inactive', 403, 'SCANNER_INACTIVE');
        }

        const validPin = await bcrypt.compare(pin, scannerUser.pin_hash);
        if (!validPin) {
            throw new AppError('Invalid scanner credentials', 401, 'INVALID_SCANNER_CREDENTIALS');
        }

        await pool.query(
            'UPDATE scanner_users SET updated_at = NOW() WHERE id = $1',
            [scannerUser.id]
        );

        const accessToken = signScannerToken(scannerUser);

        res.json({
            accessToken,
            scannerUser: {
                id: scannerUser.id,
                client_id: scannerUser.client_id,
                name: scannerUser.name,
                status: scannerUser.status,
                client_name: client.name,
                client_name_ar: client.name_ar,
                client_email: client.email
            }
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/scanner/me
router.get('/me', authenticateScanner, async (req, res) => {
    res.json({
        data: {
            scannerUser: {
                id: req.scannerUser.id,
                client_id: req.scannerUser.client_id,
                name: req.scannerUser.name,
                status: req.scannerUser.status
            },
            client: {
                id: req.scannerUser.client_id,
                name: req.scannerUser.client_name,
                name_ar: req.scannerUser.client_name_ar
            }
        }
    });
});

// GET /api/scanner/events
router.get('/events', authenticateScanner, async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            `
            SELECT
                e.id,
                e.client_id,
                e.name,
                e.name_ar,
                e.event_type,
                e.start_datetime,
                e.end_datetime,
                e.venue,
                e.status,
                COALESCE((
                    SELECT COUNT(*)
                    FROM invitation_projects p
                    JOIN invitation_recipients r ON r.project_id = p.id
                    WHERE p.event_id = e.id
                ), 0)::int AS invitation_count,
                COALESCE((
                    SELECT COUNT(*)
                    FROM invitation_projects p
                    JOIN invitation_recipients r ON r.project_id = p.id
                    WHERE p.event_id = e.id
                      AND COALESCE(r.metadata->>'attendance_status', '') = 'attended'
                ), 0)::int AS attended_count
            FROM events e
            WHERE e.client_id = $1
            ORDER BY e.start_datetime DESC
            `,
            [req.scannerUser.client_id]
        );

        res.json({ data: rows });
    } catch (error) {
        next(error);
    }
});

// POST /api/scanner/scan
router.post('/scan', authenticateScanner, async (req, res, next) => {
    const db = await pool.connect();

    try {
        const rawToken = extractInvitationToken(req.body?.token);
        const eventId = normalizeText(req.body?.eventId);
        const mode = normalizeText(req.body?.mode) || 'camera';

        if (!rawToken) {
            throw new AppError('QR token is required', 400, 'VALIDATION_ERROR');
        }

        await db.query('BEGIN');

        const { rows } = await db.query(
            `
            SELECT
                r.id AS recipient_id,
                r.project_id,
                r.display_name,
                r.display_name_ar,
                r.public_token,
                r.overall_status,
                r.metadata,
                p.event_id,
                p.client_id,
                e.name AS event_name,
                e.name_ar AS event_name_ar,
                c.name AS client_name,
                c.name_ar AS client_name_ar
            FROM invitation_recipients r
            JOIN invitation_projects p ON p.id = r.project_id
            JOIN events e ON e.id = p.event_id
            JOIN clients c ON c.id = p.client_id
            WHERE r.public_token = $1
            LIMIT 1
            `,
            [rawToken]
        );

        if (!rows.length) {
            throw new AppError('Invitation token not found', 404, 'TOKEN_NOT_FOUND');
        }

        const recipient = rows[0];

        if (recipient.client_id !== req.scannerUser.client_id) {
            throw new AppError('This invitation does not belong to your client', 403, 'CLIENT_MISMATCH');
        }

        if (eventId && eventId !== recipient.event_id) {
            throw new AppError('This QR code does not match the selected event', 400, 'EVENT_MISMATCH');
        }

        const currentMetadata = safeJson(recipient.metadata, {});
        const alreadyAttended = currentMetadata.attendance_status === 'attended';

        if (!alreadyAttended) {
            const nextMetadata = {
                ...currentMetadata,
                attendance_status: 'attended',
                attended_at: new Date().toISOString(),
                attended_by_scanner_id: req.scannerUser.id,
                attended_by_scanner_name: req.scannerUser.name,
                attended_by_client_id: req.scannerUser.client_id,
                last_scan_mode: mode
            };

            await db.query(
                `
                UPDATE invitation_recipients
                SET
                    metadata = $1::jsonb,
                    overall_status = CASE
                        WHEN overall_status IN ('draft', 'queued', 'sent', 'delivered', 'opened') THEN 'responded'
                        ELSE overall_status
                    END,
                    responded_at = COALESCE(responded_at, NOW()),
                    updated_at = NOW()
                WHERE id = $2
                `,
                [JSON.stringify(nextMetadata), recipient.recipient_id]
            );

            await db.query(
                `
                INSERT INTO activity_logs (
                    id,
                    user_id,
                    user_type,
                    action,
                    entity_type,
                    entity_id,
                    details,
                    ip_address
                )
                VALUES ($1, $2, 'scanner', 'guest_attended', 'invitation_recipient', $3, $4::jsonb, $5)
                `,
                [
                    crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
                    req.scannerUser.id,
                    recipient.recipient_id,
                    JSON.stringify({
                        token: rawToken,
                        eventId: recipient.event_id,
                        eventName: recipient.event_name,
                        clientId: recipient.client_id,
                        attended: true,
                        mode
                    }),
                    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket?.remoteAddress || null
                ]
            );
        } else {
            await db.query(
                `
                INSERT INTO activity_logs (
                    id,
                    user_id,
                    user_type,
                    action,
                    entity_type,
                    entity_id,
                    details,
                    ip_address
                )
                VALUES ($1, $2, 'scanner', 'duplicate_scan', 'invitation_recipient', $3, $4::jsonb, $5)
                `,
                [
                    crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
                    req.scannerUser.id,
                    recipient.recipient_id,
                    JSON.stringify({
                        token: rawToken,
                        eventId: recipient.event_id,
                        eventName: recipient.event_name,
                        clientId: recipient.client_id,
                        attended: true,
                        duplicate: true,
                        mode
                    }),
                    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket?.remoteAddress || null
                ]
            );
        }

        await db.query('COMMIT');

        res.json({
            data: {
                status: alreadyAttended ? 'duplicate' : 'attended',
                attendee: {
                    id: recipient.recipient_id,
                    name: recipient.display_name,
                    name_ar: recipient.display_name_ar,
                    attendance_status: 'attended',
                    attended_at: alreadyAttended ? currentMetadata.attended_at || null : new Date().toISOString()
                },
                event: {
                    id: recipient.event_id,
                    name: recipient.event_name,
                    name_ar: recipient.event_name_ar
                },
                client: {
                    id: recipient.client_id,
                    name: recipient.client_name,
                    name_ar: recipient.client_name_ar
                }
            }
        });
    } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        db.release();
    }
});

export default router;
