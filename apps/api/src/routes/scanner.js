import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pool from '../db/connection.js';
import { AppError } from '../middleware/errorHandler.js';
import { enqueueEmailDeliveries } from '../services/delivery.js';

const router = Router();

const SCANNER_JWT_SECRET = process.env.SCANNER_JWT_SECRET || process.env.JWT_ACCESS_SECRET;
const SCAN_MODES = new Set(['camera', 'manual']);

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

function normalizeOptionalText(value) {
    const text = normalizeText(value);
    return text || null;
}

function normalizeDigits(value) {
    return normalizeText(value)
        .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
        .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
}

function cleanupSpokenSegment(value) {
    return normalizeDigits(value)
        .replace(/\b(my name is|this is|name is|i am|i'm|email is|mobile number is|phone number is|position is|organization is|company is)\b/gi, '')
        .replace(/^(اسمي|أنا|هذا|الايميل|البريد الإلكتروني|رقم الجوال|رقم الهاتف|المنصب|الشركة|المؤسسة|الجهة)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeSpokenEmail(value) {
    return cleanupSpokenSegment(value)
        .replace(/\(at\)|\[at\]/gi, '@')
        .replace(/\b(at)\b/gi, '@')
        .replace(/\b(dot)\b/gi, '.')
        .replace(/\s+/g, '')
        .toLowerCase();
}

function normalizeSpokenPhone(value) {
    const digits = normalizeDigits(value).replace(/[^\d+]/g, '');

    if (/^\+9665\d{8}$/.test(digits)) {
        return `0${digits.slice(4)}`;
    }

    if (/^05\d{8}$/.test(digits)) {
        return digits;
    }

    return '';
}

function parseVisitorTranscript(transcript) {
    const source = normalizeDigits(transcript || '');
    if (!source.trim()) {
        return {
            name: '',
            position: '',
            organization: '',
            email: '',
            mobileNumber: ''
        };
    }

    const normalizedSource = source.replace(/[،؛]/g, ',');
    const emailMatch = normalizedSource.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const mobileMatch = normalizedSource.match(/(?:\+966[\s-]*5(?:[\s-]*\d){8}|0[\s-]*5(?:[\s-]*\d){8})/);
    const spokenEmailMatch = normalizedSource.match(/(?:email|الايميل|البريد الإلكتروني)\s*(?::|=)?\s*([^\n,;]+)/i);
    const spokenMobileMatch = normalizedSource.match(/(?:mobile|phone|رقم الجوال|رقم الهاتف)\s*(?::|=)?\s*([^\n,;]+)/i);

    const email = (emailMatch?.[0] || normalizeSpokenEmail(spokenEmailMatch?.[1] || '') || '').toLowerCase();
    const mobileNumber = normalizeSpokenPhone(mobileMatch?.[0] || spokenMobileMatch?.[1] || '');

    const stripped = normalizedSource
        .replace(emailMatch?.[0] || '', ' ')
        .replace(mobileMatch?.[0] || '', ' ');

    const segments = stripped
        .split(/[\n,;]+/)
        .map((segment) => cleanupSpokenSegment(segment))
        .filter(Boolean);

    return {
        name: segments[0] || '',
        position: segments[1] || '',
        organization: segments[2] || '',
        email,
        mobileNumber
    };
}

async function transcribeAudioWithProvider({ audioBase64, mimeType = 'audio/m4a', language = 'en' }) {
    const provider = normalizeText(process.env.STT_PROVIDER || 'openai').toLowerCase();

    if (provider !== 'openai') {
        throw new AppError('Unsupported STT provider configuration', 500, 'STT_PROVIDER_UNSUPPORTED');
    }

    const apiKey = normalizeText(process.env.OPENAI_API_KEY);
    if (!apiKey) {
        throw new AppError('Speech-to-text is not configured', 500, 'STT_NOT_CONFIGURED');
    }

    const model = normalizeText(process.env.OPENAI_STT_MODEL || 'gpt-4o-mini-transcribe');
    const bytes = Buffer.from(audioBase64, 'base64');
    const blob = new Blob([bytes], { type: mimeType || 'audio/m4a' });
    const form = new FormData();
    form.append('file', blob, `scanner-voice.${mimeType.includes('wav') ? 'wav' : 'm4a'}`);
    form.append('model', model);
    if (language) {
        form.append('language', language.startsWith('ar') ? 'ar' : 'en');
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`
        },
        body: form
    });

    if (!response.ok) {
        let providerErrorCode = '';
        try {
            const payload = await response.json();
            providerErrorCode = normalizeText(payload?.error?.code || '');
        } catch {
            providerErrorCode = '';
        }

        // Never leak upstream provider payloads (can include sensitive key fragments).
        if (response.status === 401 || providerErrorCode === 'invalid_api_key') {
            throw new AppError('Speech-to-text configuration error. Contact admin.', 502, 'STT_PROVIDER_ERROR');
        }

        throw new AppError('Speech-to-text provider request failed', 502, 'STT_PROVIDER_ERROR');
    }

    const data = await response.json();
    return normalizeText(data?.text || '');
}

function validateEmail(value) {
    const email = normalizeOptionalText(value);
    if (!email) {
        return null;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        throw new AppError('Email is invalid', 400, 'VALIDATION_ERROR');
    }

    return email.toLowerCase();
}

function validateMobileNumber(value) {
    const mobileNumber = normalizeOptionalText(value);
    if (!mobileNumber) {
        return null;
    }

    const sanitized = normalizeDigits(mobileNumber).replace(/[\s()-]/g, '');

    if (/^05\d{8}$/.test(sanitized)) {
        return sanitized;
    }

    if (/^\+9665\d{8}$/.test(sanitized)) {
        return `0${sanitized.slice(4)}`;
    }

    throw new AppError('Enter a valid mobile number', 400, 'VALIDATION_ERROR');
}

function normalizeVisitorPayload(body) {
    const name = normalizeText(body?.name);
    if (!name) {
        throw new AppError('Visitor name is required', 400, 'VALIDATION_ERROR');
    }

    return {
        name,
        position: normalizeOptionalText(body?.position),
        organization: normalizeOptionalText(body?.organization),
        email: validateEmail(body?.email),
        mobileNumber: validateMobileNumber(body?.mobileNumber)
    };
}

function getRequestIp(req) {
    return req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket?.remoteAddress || null;
}

async function logScannerActivity(db, req, scannerUser, action, entityType, entityId, details) {
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
        VALUES ($1, $2, 'scanner', $3, $4, $5, $6::jsonb, $7)
        `,
        [
            crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
            scannerUser.id,
            action,
            entityType,
            entityId,
            JSON.stringify(details),
            getRequestIp(req)
        ]
    );
}

async function findDuplicateClientGuest(db, clientId, { email, mobileNumber }, excludeGuestId = null) {
    const clauses = ['client_id = $1'];
    const params = [clientId];
    let paramIndex = 2;

    if (excludeGuestId) {
        clauses.push(`id <> $${paramIndex}`);
        params.push(excludeGuestId);
        paramIndex += 1;
    }

    const duplicateClauses = [];

    if (email) {
        duplicateClauses.push(`LOWER(email) = LOWER($${paramIndex})`);
        params.push(email);
        paramIndex += 1;
    }

    if (mobileNumber) {
        duplicateClauses.push(`mobile_number = $${paramIndex}`);
        params.push(mobileNumber);
        paramIndex += 1;
    }

    if (!duplicateClauses.length) {
        return null;
    }

    clauses.push(`(${duplicateClauses.join(' OR ')})`);

    const { rows } = await db.query(
        `SELECT * FROM client_guests WHERE ${clauses.join(' AND ')} LIMIT 1`,
        params
    );

    return rows[0] || null;
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

function getInvitationAttendanceStatus(metadata) {
    const normalized = safeJson(metadata, {});
    const status = normalizeText(normalized.attendance_status || normalized.check_in_status);

    if (status === 'attended' || status === 'checked_in') {
        return 'checked_in';
    }

    return 'not_scanned';
}

function generateInviteCode() {
    return `RWJ-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function generatePublicToken() {
    return crypto.randomBytes(24).toString('hex');
}

async function fetchRecipientQuestionnaireState(db, eventId, recipientId) {
    if (!eventId || !recipientId) {
        return {
            totalQuestionnaires: 0,
            submittedQuestionnaires: 0,
            pendingQuestionnaires: 0,
            status: 'not_started',
            lastSubmittedAt: null
        };
    }

    const { rows } = await db.query(
        `
        SELECT
            COUNT(*)::int AS total_questionnaires,
            COUNT(qs.id)::int AS submission_rows,
            COUNT(DISTINCT qs.questionnaire_id)::int AS submitted_questionnaires,
            MAX(qs.submitted_at) AS last_submitted_at
        FROM questionnaires q
        LEFT JOIN questionnaire_submissions qs
          ON qs.questionnaire_id = q.id
         AND qs.recipient_id = $2
        WHERE q.event_id = $1
          AND q.status = 'published'
          AND (q.start_date IS NULL OR q.start_date <= NOW())
          AND (q.end_date IS NULL OR q.end_date >= NOW())
        `,
        [eventId, recipientId]
    );

    const totalQuestionnaires = rows[0]?.total_questionnaires || 0;
    const submittedQuestionnaires = rows[0]?.submitted_questionnaires || 0;
    const pendingQuestionnaires = Math.max(totalQuestionnaires - submittedQuestionnaires, 0);

    return {
        totalQuestionnaires,
        submittedQuestionnaires,
        pendingQuestionnaires,
        status: submittedQuestionnaires > 0 ? 'submitted' : 'not_started',
        lastSubmittedAt: rows[0]?.last_submitted_at || null
    };
}

async function syncRecipientAddonStatesOnScan(db, recipient, scannerUser, scannedAtIso) {
    const { rows: pageRows } = await db.query(
        `
        SELECT id, page_key, page_type, settings
        FROM invitation_project_pages
        WHERE project_id = $1
          AND is_enabled = true
          AND page_type IN ('poll', 'questionnaire', 'instructions')
        ORDER BY sort_order ASC, created_at ASC
        `,
        [recipient.project_id]
    );

    const unlocked = [];
    for (const page of pageRows) {
        const settings = safeJson(page.settings, {});
        const activation = safeJson(settings.activation_rules || settings.activationRules, {});
        if (!activation.liveAfterQrScanned) {
            continue;
        }

        const snapshot = safeJson(settings.addon_snapshot || settings.poll_snapshot || settings.questionnaire_snapshot, {});
        const addonId = page.page_type === 'poll'
            ? (snapshot.poll_id || settings.addon_id || null)
            : (snapshot.questionnaire_id || settings.addon_id || null);

        await db.query(
            `
            INSERT INTO invitation_addon_guest_state (
                id,
                project_id,
                recipient_id,
                page_id,
                page_key,
                addon_type,
                addon_id,
                is_unlocked,
                unlocked_by,
                unlocked_at,
                metadata
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, true, 'check_in', $8, $9::jsonb
            )
            ON CONFLICT (project_id, recipient_id, page_id)
            DO UPDATE SET
                is_unlocked = true,
                unlocked_by = 'check_in',
                unlocked_at = EXCLUDED.unlocked_at,
                metadata = COALESCE(invitation_addon_guest_state.metadata, '{}'::jsonb) || EXCLUDED.metadata,
                updated_at = NOW()
            `,
            [
                crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
                recipient.project_id,
                recipient.recipient_id,
                page.id,
                page.page_key,
                page.page_type,
                addonId,
                scannedAtIso,
                JSON.stringify({
                    source: 'scanner_scan',
                    scannerUserId: scannerUser.id,
                    scannerUserName: scannerUser.name,
                    scannedAt: scannedAtIso
                })
            ]
        );

        unlocked.push({
            pageKey: page.page_key,
            addonType: page.page_type,
            addonId
        });
    }

    return unlocked;
}

function signScannerToken(scannerUser, selectedEventId = null) {
    return jwt.sign(
        {
            scannerUserId: scannerUser.id,
            clientId: scannerUser.client_id,
            eventId: selectedEventId || null,
            role: 'scanner'
        },
        SCANNER_JWT_SECRET,
        { expiresIn: process.env.SCANNER_JWT_EXPIRES || '8h' }
    );
}

function sendScannerSuccess(res, data, meta = {}) {
    res.json({
        ok: true,
        data,
        ...meta
    });
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
            SELECT s.id, s.client_id, s.name, s.status, s.event_id,
                   c.name AS client_name, c.name_ar AS client_name_ar,
                   e.name AS event_name, e.name_ar AS event_name_ar
            FROM scanner_users s
            JOIN clients c ON c.id = s.client_id
            LEFT JOIN events e ON e.id = s.event_id
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

        const effectiveSessionEventId = normalizeText(decoded.eventId) || scannerUser.event_id || null;
        if (effectiveSessionEventId) {
            const { rows: sessionEventRows } = await pool.query(
                `
                SELECT id
                FROM events
                WHERE id = $1 AND client_id = $2
                LIMIT 1
                `,
                [effectiveSessionEventId, scannerUser.client_id]
            );

            if (!sessionEventRows.length) {
                throw new AppError('Selected event is no longer available', 403, 'SESSION_EVENT_INVALID');
            }
        }

        req.scannerUser = {
            ...scannerUser,
            session_event_id: effectiveSessionEventId
        };
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
        const selectedEventId = normalizeText(req.body?.eventId);

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
            throw new AppError('Client not found. First field must be client email or client ID.', 404, 'CLIENT_NOT_FOUND');
        }

        const client = clientRows[0];

        const { rows } = await pool.query(
            `
            SELECT s.*, c.name AS client_name, c.name_ar AS client_name_ar,
                   e.id AS event_id, e.name AS event_name, e.name_ar AS event_name_ar
            FROM scanner_users s
            JOIN clients c ON c.id = s.client_id
            LEFT JOIN events e ON e.id = s.event_id
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

        const availableEventsParams = scannerUser.event_id ? [client.id, scannerUser.event_id] : [client.id];
        const availableEventsFilter = scannerUser.event_id ? 'AND id = $2' : '';
        const { rows: availableEvents } = await pool.query(
            `
            SELECT id, name, name_ar, start_datetime, end_datetime, status
            FROM events
            WHERE client_id = $1 ${availableEventsFilter}
            ORDER BY start_datetime DESC
            `,
            availableEventsParams
        );

        if (!selectedEventId) {
            sendScannerSuccess(res, {
                requiresEventSelection: true,
                scannerUser: {
                    id: scannerUser.id,
                    client_id: scannerUser.client_id,
                    name: scannerUser.name,
                    status: scannerUser.status
                },
                events: availableEvents
            });
            return;
        }

        const selectedEvent = availableEvents.find((event) => event.id === selectedEventId);
        if (!selectedEvent) {
            throw new AppError('Selected event is invalid for this scanner user', 400, 'INVALID_EVENT');
        }

        await pool.query(
            'UPDATE scanner_users SET updated_at = NOW() WHERE id = $1',
            [scannerUser.id]
        );

        const accessToken = signScannerToken(scannerUser, selectedEventId);

        const responsePayload = {
            accessToken,
            scannerUser: {
                id: scannerUser.id,
                client_id: scannerUser.client_id,
                name: scannerUser.name,
                status: scannerUser.status,
                event_id: selectedEvent.id,
                event_name: selectedEvent.name,
                event_name_ar: selectedEvent.name_ar,
                client_name: client.name,
                client_name_ar: client.name_ar,
                client_email: client.email
            }
        };

        sendScannerSuccess(res, responsePayload, responsePayload);
    } catch (error) {
        next(error);
    }
});

// GET /api/scanner/me
router.get('/me', authenticateScanner, async (req, res) => {
    sendScannerSuccess(res, {
        scannerUser: {
            id: req.scannerUser.id,
            client_id: req.scannerUser.client_id,
            name: req.scannerUser.name,
            status: req.scannerUser.status,
            event_id: req.scannerUser.event_id,
            event_name: req.scannerUser.event_name,
            event_name_ar: req.scannerUser.event_name_ar
        },
        client: {
            id: req.scannerUser.client_id,
            name: req.scannerUser.client_name,
            name_ar: req.scannerUser.client_name_ar
        }
    });
});

// GET /api/scanner/events
router.get('/events', authenticateScanner, async (req, res, next) => {
    try {
        const eventFilter = req.scannerUser.session_event_id ? 'AND e.id = $2' : '';
        const params = req.scannerUser.session_event_id ? [req.scannerUser.client_id, req.scannerUser.session_event_id] : [req.scannerUser.client_id];

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
                      AND COALESCE(r.metadata->>'attendance_status', r.metadata->>'check_in_status', '') IN ('attended', 'checked_in')
                ), 0)::int AS attended_count
            FROM events e
            WHERE e.client_id = $1 ${eventFilter}
            ORDER BY e.start_datetime DESC
            `,
            params
        );

        sendScannerSuccess(res, rows);
    } catch (error) {
        next(error);
    }
});

// GET /api/scanner/events/:eventId/stats
router.get('/events/:eventId/stats', authenticateScanner, async (req, res, next) => {
    try {
        const eventId = normalizeText(req.params.eventId);

        if (!eventId) {
            throw new AppError('Event is required', 400, 'VALIDATION_ERROR');
        }
        if (req.scannerUser.session_event_id && eventId !== req.scannerUser.session_event_id) {
            throw new AppError('This event is outside your current scanner session', 403, 'EVENT_SCOPE_VIOLATION');
        }

        const { rows: eventRows } = await pool.query(
            `
            SELECT id, name, name_ar, status
            FROM events
            WHERE id = $1 AND client_id = $2
            LIMIT 1
            `,
            [eventId, req.scannerUser.client_id]
        );

        if (!eventRows.length) {
            throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
        }

        const event = eventRows[0];

        const { rows: invitationStatsRows } = await pool.query(
            `
            SELECT
                COUNT(*)::int AS invited_total,
                COUNT(*) FILTER (
                    WHERE COALESCE(r.metadata->>'attendance_status', r.metadata->>'check_in_status', '') IN ('attended', 'checked_in')
                )::int AS attended_from_invitations
            FROM invitation_projects p
            JOIN invitation_recipients r ON r.project_id = p.id
            WHERE p.event_id = $1
            `,
            [eventId]
        );

        const invitationStats = invitationStatsRows[0] || {
            invited_total: 0,
            attended_from_invitations: 0
        };

        const { rows: walkInRows } = await pool.query(
            `
            SELECT
                COUNT(*)::int AS walk_in_total,
                COUNT(*) FILTER (
                    WHERE check_in_status = 'checked_in'
                )::int AS walk_in_checked_in
            FROM event_walk_ins
            WHERE event_id = $1
            `,
            [eventId]
        );

        const walkInStats = walkInRows[0] || {
            walk_in_total: 0,
            walk_in_checked_in: 0
        };

        const invitedTotal = invitationStats.invited_total || 0;
        const invitedAttended = invitationStats.attended_from_invitations || 0;
        const invitedPending = Math.max(invitedTotal - invitedAttended, 0);
        const walkInCheckedIn = walkInStats.walk_in_checked_in || 0;
        const { rows: duplicateScanRows } = await pool.query(
            `
            SELECT COUNT(*)::int AS duplicate_scan_count
            FROM activity_logs
            WHERE user_type = 'scanner'
              AND action = 'duplicate_scan'
              AND details->>'eventId' = $1
            `,
            [eventId]
        );

        const { rows: recentScanRows } = await pool.query(
            `
            SELECT created_at, action, details
            FROM activity_logs
            WHERE user_type = 'scanner'
              AND action IN ('guest_attended', 'duplicate_scan')
              AND details->>'eventId' = $1
            ORDER BY created_at DESC
            LIMIT 8
            `,
            [eventId]
        );

        sendScannerSuccess(res, {
            event: {
                id: event.id,
                name: event.name,
                name_ar: event.name_ar,
                status: event.status
            },
            stats: {
                invitedTotal,
                invitedAttended,
                invitedPending,
                walkInTotal: walkInStats.walk_in_total || 0,
                walkInCheckedIn,
                checkedInTotal: invitedAttended + walkInCheckedIn,
                duplicateScanCount: duplicateScanRows[0]?.duplicate_scan_count || 0
            },
            recentScans: recentScanRows.map((row) => ({
                action: row.action,
                created_at: row.created_at,
                details: safeJson(row.details, {})
            })),
            lastUpdatedAt: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/scanner/visitor-intake/voice-transcribe
router.post('/visitor-intake/voice-transcribe', authenticateScanner, async (req, res, next) => {
    try {
        const audioBase64 = normalizeText(req.body?.audioBase64);
        const mimeType = normalizeText(req.body?.mimeType || 'audio/m4a');
        const language = normalizeText(req.body?.language || 'en');

        if (!audioBase64) {
            throw new AppError('Audio payload is required', 400, 'VALIDATION_ERROR');
        }

        if (audioBase64.length > 25_000_000) {
            throw new AppError('Audio payload is too large', 413, 'PAYLOAD_TOO_LARGE');
        }

        const transcript = await transcribeAudioWithProvider({ audioBase64, mimeType, language });
        if (!transcript) {
            throw new AppError('No transcript could be extracted', 422, 'EMPTY_TRANSCRIPT');
        }

        sendScannerSuccess(res, {
            transcript,
            language
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/scanner/visitor-intake/voice-extract
router.post('/visitor-intake/voice-extract', authenticateScanner, async (req, res, next) => {
    try {
        const transcript = normalizeText(req.body?.transcript);
        const language = normalizeText(req.body?.language) || 'en';

        if (!transcript) {
            throw new AppError('Transcript is required', 400, 'VALIDATION_ERROR');
        }

        const extracted = parseVisitorTranscript(transcript);
        const confidence = {
            name: extracted.name ? 0.8 : 0,
            position: extracted.position ? 0.55 : 0,
            organization: extracted.organization ? 0.55 : 0,
            email: extracted.email ? 0.92 : 0,
            mobileNumber: extracted.mobileNumber ? 0.9 : 0
        };

        const warnings = [];
        if (!extracted.name) {
            warnings.push('name_missing');
        }

        if (!extracted.email) {
            warnings.push('email_missing');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extracted.email)) {
            warnings.push('email_invalid');
        }

        if (!extracted.mobileNumber) {
            warnings.push('mobile_missing');
        } else if (!/^05\d{8}$/.test(extracted.mobileNumber)) {
            warnings.push('mobile_invalid');
        }

        sendScannerSuccess(res, {
            transcript,
            language,
            extracted,
            confidence,
            warnings
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/scanner/visitor-intake/approve
router.post('/visitor-intake/approve', authenticateScanner, async (req, res, next) => {
    const db = await pool.connect();

    try {
        const action = normalizeText(req.body?.action) || 'add_only';
        const eventId = normalizeText(req.body?.eventId);
        const existingGuestId = normalizeText(req.body?.existingGuestId);
        const sendInvitation = Boolean(req.body?.sendInvitation);
        const payload = normalizeVisitorPayload(req.body?.fields || req.body);

        if (!['add_only', 'add_and_check_in'].includes(action)) {
            throw new AppError('Action is invalid', 400, 'VALIDATION_ERROR');
        }
        if (req.scannerUser.session_event_id && eventId && eventId !== req.scannerUser.session_event_id) {
            throw new AppError('This event is outside your current scanner session', 403, 'EVENT_SCOPE_VIOLATION');
        }

        if (action === 'add_and_check_in' && !eventId) {
            throw new AppError('Event is required for check-in', 400, 'VALIDATION_ERROR');
        }

        await db.query('BEGIN');

        let event = null;
        if (eventId) {
            const { rows: eventRows } = await db.query(
                `
                SELECT id, name, name_ar, client_id
                FROM events
                WHERE id = $1 AND client_id = $2
                LIMIT 1
                `,
                [eventId, req.scannerUser.client_id]
            );

            if (!eventRows.length) {
                throw new AppError('Selected event was not found', 404, 'EVENT_NOT_FOUND');
            }

            event = eventRows[0];
        }

        let guest = null;
        let resolution = 'created';

        if (existingGuestId) {
            const { rows } = await db.query(
                `
                SELECT *
                FROM client_guests
                WHERE id = $1 AND client_id = $2
                LIMIT 1
                `,
                [existingGuestId, req.scannerUser.client_id]
            );

            if (!rows.length) {
                throw new AppError('Selected guest was not found', 404, 'NOT_FOUND');
            }

            guest = rows[0];

            const duplicateGuest = await findDuplicateClientGuest(db, req.scannerUser.client_id, payload, guest.id);
            if (duplicateGuest) {
                throw new AppError('Another guest already exists with the same email or mobile number', 409, 'DUPLICATE_GUEST');
            }

            await db.query(
                `
                UPDATE client_guests
                SET
                    name = $1,
                    position = $2,
                    organization = $3,
                    email = $4,
                    mobile_number = $5,
                    updated_at = NOW()
                WHERE id = $6
                `,
                [
                    payload.name,
                    payload.position,
                    payload.organization,
                    payload.email,
                    payload.mobileNumber,
                    guest.id
                ]
            );

            const { rows: updatedRows } = await db.query('SELECT * FROM client_guests WHERE id = $1', [guest.id]);
            guest = updatedRows[0];
            resolution = 'updated';
        } else {
            const duplicateGuest = await findDuplicateClientGuest(db, req.scannerUser.client_id, payload);
            if (duplicateGuest) {
                throw new AppError('Guest already exists with the same email or mobile number', 409, 'DUPLICATE_GUEST');
            }

            const guestId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

            await db.query(
                `
                INSERT INTO client_guests (
                    id,
                    client_id,
                    name,
                    position,
                    organization,
                    email,
                    mobile_number,
                    gender,
                    status
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'male', 'active')
                `,
                [
                    guestId,
                    req.scannerUser.client_id,
                    payload.name,
                    payload.position,
                    payload.organization,
                    payload.email,
                    payload.mobileNumber
                ]
            );

            const { rows: createdRows } = await db.query('SELECT * FROM client_guests WHERE id = $1', [guestId]);
            guest = createdRows[0];
        }

        await logScannerActivity(
            db,
            req,
            req.scannerUser,
            resolution === 'created' ? 'walk_in_guest_created' : 'walk_in_guest_updated',
            'client_guest',
            guest.id,
            {
                clientId: req.scannerUser.client_id,
                eventId: event?.id || null,
                action,
                resolution,
                name: guest.name,
                email: guest.email,
                mobileNumber: guest.mobile_number
            }
        );

        let attendance = null;
        if (action === 'add_and_check_in') {
            const walkInId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

            const { rows: walkInRows } = await db.query(
                `
                INSERT INTO event_walk_ins (
                    id,
                    event_id,
                    client_id,
                    client_guest_id,
                    scanner_user_id,
                    check_in_status
                )
                VALUES ($1, $2, $3, $4, $5, 'checked_in')
                ON CONFLICT (event_id, client_guest_id)
                DO UPDATE SET
                    scanner_user_id = EXCLUDED.scanner_user_id,
                    check_in_status = 'checked_in',
                    updated_at = NOW()
                RETURNING *
                `,
                [
                    walkInId,
                    event.id,
                    req.scannerUser.client_id,
                    guest.id,
                    req.scannerUser.id
                ]
            );

            const walkIn = walkInRows[0];
            attendance = {
                status: 'checked_in',
                duplicate: walkIn.created_at !== walkIn.updated_at,
                eventId: event.id,
                eventName: event.name,
                eventNameAr: event.name_ar,
                checkedInAt: walkIn.checked_in_at
            };

            await logScannerActivity(
                db,
                req,
                req.scannerUser,
                attendance.duplicate ? 'walk_in_duplicate_check_in' : 'walk_in_guest_checked_in',
                'event_walk_in',
                walkIn.id,
                {
                    clientId: req.scannerUser.client_id,
                    eventId: event.id,
                    clientGuestId: guest.id,
                    guestName: guest.name,
                    duplicate: attendance.duplicate
                }
            );
        }

        let invitation = null;
        if (sendInvitation) {
            if (!event?.id) {
                throw new AppError('Event is required to send an invitation', 400, 'VALIDATION_ERROR');
            }

            if (!guest.email) {
                throw new AppError('Guest email is required to send an invitation', 400, 'VALIDATION_ERROR');
            }

            const { rows: projectRows } = await db.query(
                `
                SELECT id, name, name_ar, default_language, status
                FROM invitation_projects
                WHERE event_id = $1
                  AND client_id = $2
                  AND status IN ('draft', 'active', 'paused')
                ORDER BY updated_at DESC, created_at DESC
                LIMIT 1
                `,
                [event.id, req.scannerUser.client_id]
            );

            if (!projectRows.length) {
                invitation = {
                    status: 'skipped',
                    reason: 'no_invitation_project'
                };
            } else {
                const project = projectRows[0];
                const { rows: existingRecipients } = await db.query(
                    `
                    SELECT *
                    FROM invitation_recipients
                    WHERE project_id = $1
                      AND client_guest_id = $2
                    LIMIT 1
                    `,
                    [project.id, guest.id]
                );

                let recipient = existingRecipients[0] || null;
                if (recipient) {
                    await db.query(
                        `
                        UPDATE invitation_recipients
                        SET
                            display_name = $1,
                            display_name_ar = $2,
                            email = $3,
                            phone = $4,
                            preferred_language = COALESCE(preferred_language, 'ar'),
                            preferred_channel = COALESCE(preferred_channel, 'email'),
                            metadata = COALESCE(metadata, '{}'::jsonb) || $5::jsonb,
                            updated_at = NOW()
                        WHERE id = $6
                        `,
                        [
                            guest.name,
                            guest.name,
                            guest.email,
                            guest.mobile_number || null,
                            JSON.stringify({
                                source: 'scanner_mobile',
                                walk_in: true
                            }),
                            recipient.id
                        ]
                    );

                    const { rows: refreshed } = await db.query('SELECT * FROM invitation_recipients WHERE id = $1', [recipient.id]);
                    recipient = refreshed[0];
                } else {
                    const recipientId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

                    await db.query(
                        `
                        INSERT INTO invitation_recipients (
                            id,
                            project_id,
                            guest_id,
                            client_guest_id,
                            invite_code,
                            public_token,
                            display_name,
                            display_name_ar,
                            email,
                            phone,
                            whatsapp_number,
                            preferred_language,
                            preferred_channel,
                            metadata,
                            overall_status
                        )
                        VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, NULL, $10, 'email', $11::jsonb, 'draft')
                        `,
                        [
                            recipientId,
                            project.id,
                            guest.id,
                            generateInviteCode(),
                            generatePublicToken(),
                            guest.name,
                            guest.name,
                            guest.email,
                            guest.mobile_number || null,
                            project.default_language || 'ar',
                            JSON.stringify({
                                source: 'scanner_mobile',
                                walk_in: true
                            })
                        ]
                    );

                    const { rows: created } = await db.query('SELECT * FROM invitation_recipients WHERE id = $1', [recipientId]);
                    recipient = created[0];
                }

                const jobs = await enqueueEmailDeliveries({
                    db,
                    project,
                    recipients: [recipient],
                    createdBy: null
                });

                await db.query(
                    `
                    UPDATE invitation_recipients
                    SET
                        overall_status = 'queued',
                        updated_at = NOW()
                    WHERE id = $1
                    `,
                    [recipient.id]
                );

                invitation = {
                    status: 'queued',
                    projectId: project.id,
                    recipientId: recipient.id,
                    deliveryJobId: jobs[0]?.id || null
                };

                await logScannerActivity(
                    db,
                    req,
                    req.scannerUser,
                    'walk_in_invitation_queued',
                    'invitation_recipient',
                    recipient.id,
                    {
                        clientId: req.scannerUser.client_id,
                        eventId: event.id,
                        clientGuestId: guest.id,
                        email: guest.email,
                        projectId: project.id
                    }
                );
            }
        }

        await db.query('COMMIT');

        sendScannerSuccess(res, {
            guest: {
                id: guest.id,
                name: guest.name,
                position: guest.position,
                organization: guest.organization,
                email: guest.email,
                mobileNumber: guest.mobile_number,
                status: guest.status
            },
            resolution,
            attendance,
            invitation
        });
    } catch (error) {
        await db.query('ROLLBACK');
        next(error);
    } finally {
        db.release();
    }
});

// POST /api/scanner/scan
router.post('/scan', authenticateScanner, async (req, res, next) => {
    const db = await pool.connect();

    try {
        const rawToken = extractInvitationToken(req.body?.token);
        const eventId = normalizeText(req.body?.eventId);
        const requestedMode = normalizeText(req.body?.mode) || 'camera';
        const mode = SCAN_MODES.has(requestedMode) ? requestedMode : 'camera';

        if (!rawToken) {
            throw new AppError('QR token is required', 400, 'VALIDATION_ERROR');
        }
        if (req.scannerUser.session_event_id && eventId && eventId !== req.scannerUser.session_event_id) {
            throw new AppError('This event is outside your current scanner session', 403, 'EVENT_SCOPE_VIOLATION');
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
        if (req.scannerUser.session_event_id && recipient.event_id !== req.scannerUser.session_event_id) {
            throw new AppError('This QR code belongs to a different event than your current session', 403, 'EVENT_SCOPE_VIOLATION');
        }

        const currentMetadata = safeJson(recipient.metadata, {});
        const alreadyAttended = getInvitationAttendanceStatus(currentMetadata) === 'checked_in';
        const scannedAt = new Date().toISOString();
        const questionnaire = await fetchRecipientQuestionnaireState(db, recipient.event_id, recipient.recipient_id);
        const unlockedAddons = await syncRecipientAddonStatesOnScan(db, recipient, req.scannerUser, scannedAt);

        if (!alreadyAttended) {
            const nextMetadata = {
                ...currentMetadata,
                attendance_status: 'checked_in',
                check_in_status: 'checked_in',
                attended_at: scannedAt,
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

            await logScannerActivity(db, req, req.scannerUser, 'guest_attended', 'invitation_recipient', recipient.recipient_id, {
                token: rawToken,
                eventId: recipient.event_id,
                eventName: recipient.event_name,
                clientId: recipient.client_id,
                attended: true,
                mode
            });
        } else {
            await logScannerActivity(db, req, req.scannerUser, 'duplicate_scan', 'invitation_recipient', recipient.recipient_id, {
                token: rawToken,
                eventId: recipient.event_id,
                eventName: recipient.event_name,
                clientId: recipient.client_id,
                attended: true,
                duplicate: true,
                mode
            });
        }

        await db.query('COMMIT');

        sendScannerSuccess(res, {
            status: alreadyAttended ? 'duplicate' : 'attended',
            attendee: {
                id: recipient.recipient_id,
                name: recipient.display_name,
                name_ar: recipient.display_name_ar,
                attendance_status: 'checked_in',
                attended_at: alreadyAttended ? currentMetadata.attended_at || null : scannedAt,
                questionnaire,
                unlocked_addons: unlockedAddons
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
        });
    } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        db.release();
    }
});

// GET /api/scanner/events/:eventId/addons
router.get('/events/:eventId/addons', authenticateScanner, async (req, res, next) => {
    try {
        const eventId = normalizeText(req.params.eventId);
        if (!eventId) {
            throw new AppError('Event is required', 400, 'VALIDATION_ERROR');
        }
        if (req.scannerUser.session_event_id && eventId !== req.scannerUser.session_event_id) {
            throw new AppError('This event is outside your current scanner session', 403, 'EVENT_SCOPE_VIOLATION');
        }

        const { rows: eventRows } = await pool.query(
            `
            SELECT id, settings
            FROM events
            WHERE id = $1
              AND client_id = $2
            LIMIT 1
            `,
            [eventId, req.scannerUser.client_id]
        );

        if (!eventRows.length) {
            throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
        }

        const settings = safeJson(eventRows[0].settings, {});
        const addInsEnabled = Array.isArray(settings.addIns) ? settings.addIns : [];
        const invitationSetup = safeJson(settings.invitation_setup, {});
        const tabs = Array.isArray(invitationSetup.tabs) ? invitationSetup.tabs : [];

        const addons = tabs
            .map((tab, index) => ({
                type: normalizeText(tab?.type),
                addonId: normalizeText(tab?.addon_id || tab?.addonId),
                title: normalizeText(tab?.title),
                titleAr: normalizeText(tab?.title_ar || tab?.titleAr),
                activationRules: safeJson(tab?.activation_rules || tab?.activationRules, {}),
                display: safeJson(tab?.display, {}),
                sortOrder: Number.isFinite(Number(tab?.sort_order))
                    ? Number.parseInt(tab.sort_order, 10)
                    : Number.isFinite(Number(tab?.sortOrder))
                        ? Number.parseInt(tab.sortOrder, 10)
                        : index
            }))
            .filter((addon) => addon.type && addon.addonId && ['poll', 'questionnaire', 'instructions'].includes(addon.type))
            .sort((a, b) => a.sortOrder - b.sortOrder);

        sendScannerSuccess(res, {
            eventId,
            addInsEnabled,
            addons
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/scanner/recipients/:recipientId/addons
router.get('/recipients/:recipientId/addons', authenticateScanner, async (req, res, next) => {
    try {
        const recipientId = normalizeText(req.params.recipientId);
        if (!recipientId) {
            throw new AppError('Recipient is required', 400, 'VALIDATION_ERROR');
        }

        const { rows: recipientRows } = await pool.query(
            `
            SELECT
                r.id AS recipient_id,
                r.project_id,
                p.event_id,
                p.client_id
            FROM invitation_recipients r
            JOIN invitation_projects p ON p.id = r.project_id
            WHERE r.id = $1
            LIMIT 1
            `,
            [recipientId]
        );

        if (!recipientRows.length) {
            throw new AppError('Recipient not found', 404, 'NOT_FOUND');
        }

        const recipient = recipientRows[0];
        if (recipient.client_id !== req.scannerUser.client_id) {
            throw new AppError('Recipient belongs to a different client', 403, 'CLIENT_MISMATCH');
        }
        if (req.scannerUser.session_event_id && recipient.event_id !== req.scannerUser.session_event_id) {
            throw new AppError('Recipient event is outside your current scanner session', 403, 'EVENT_SCOPE_VIOLATION');
        }

        const { rows } = await pool.query(
            `
            SELECT
                page_key,
                page_type,
                title,
                title_ar,
                settings
            FROM invitation_project_pages
            WHERE project_id = $1
              AND is_enabled = true
              AND page_type IN ('poll', 'questionnaire', 'instructions')
            ORDER BY sort_order ASC, created_at ASC
            `,
            [recipient.project_id]
        );

        const addons = rows.map((row) => {
            const settings = safeJson(row.settings, {});
            const activationRules = safeJson(settings.activation_rules || settings.activationRules, {});
            const display = safeJson(settings.display, {});
            return {
                pageKey: row.page_key,
                pageType: row.page_type,
                title: row.title || '',
                titleAr: row.title_ar || '',
                addonId: normalizeText(settings.addon_id),
                activationRules,
                display
            };
        });

        sendScannerSuccess(res, {
            recipientId,
            eventId: recipient.event_id,
            addons
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/scanner/recipients/:recipientId/addons/:pageKey/enable
router.post('/recipients/:recipientId/addons/:pageKey/enable', authenticateScanner, async (req, res, next) => {
    const db = await pool.connect();

    try {
        const recipientId = normalizeText(req.params.recipientId);
        const pageKey = normalizeText(req.params.pageKey);

        if (!recipientId || !pageKey) {
            throw new AppError('Recipient and page key are required', 400, 'VALIDATION_ERROR');
        }

        await db.query('BEGIN');

        const { rows: recipientRows } = await db.query(
            `
            SELECT
                r.id AS recipient_id,
                r.project_id,
                p.event_id,
                p.client_id
            FROM invitation_recipients r
            JOIN invitation_projects p ON p.id = r.project_id
            WHERE r.id = $1
            LIMIT 1
            `,
            [recipientId]
        );

        if (!recipientRows.length) {
            throw new AppError('Recipient not found', 404, 'NOT_FOUND');
        }

        const recipient = recipientRows[0];
        if (recipient.client_id !== req.scannerUser.client_id) {
            throw new AppError('Recipient belongs to a different client', 403, 'CLIENT_MISMATCH');
        }
        if (req.scannerUser.session_event_id && recipient.event_id !== req.scannerUser.session_event_id) {
            throw new AppError('Recipient event is outside your current scanner session', 403, 'EVENT_SCOPE_VIOLATION');
        }

        const { rows: pageRows } = await db.query(
            `
            SELECT id, page_key, page_type, settings
            FROM invitation_project_pages
            WHERE project_id = $1
              AND page_key = $2
              AND is_enabled = true
              AND page_type IN ('poll', 'questionnaire', 'instructions')
            LIMIT 1
            `,
            [recipient.project_id, pageKey]
        );

        if (!pageRows.length) {
            throw new AppError('Addon page not found for this recipient', 404, 'NOT_FOUND');
        }

        const page = pageRows[0];
        const settings = safeJson(page.settings, {});
        const snapshot = safeJson(settings.addon_snapshot || settings.poll_snapshot || settings.questionnaire_snapshot, {});
        const addonId = page.page_type === 'poll'
            ? (snapshot.poll_id || settings.addon_id || null)
            : (snapshot.questionnaire_id || settings.addon_id || null);
        const enabledAt = new Date().toISOString();

        await db.query(
            `
            INSERT INTO invitation_addon_guest_state (
                id,
                project_id,
                recipient_id,
                page_id,
                page_key,
                addon_type,
                addon_id,
                is_unlocked,
                unlocked_by,
                unlocked_at,
                scanner_manual_enabled,
                scanner_manual_enabled_by,
                scanner_manual_enabled_at,
                metadata
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, true, 'scanner_manual', $8, true, $9, $8, $10::jsonb
            )
            ON CONFLICT (project_id, recipient_id, page_id)
            DO UPDATE SET
                is_unlocked = true,
                unlocked_by = 'scanner_manual',
                unlocked_at = EXCLUDED.unlocked_at,
                scanner_manual_enabled = true,
                scanner_manual_enabled_by = EXCLUDED.scanner_manual_enabled_by,
                scanner_manual_enabled_at = EXCLUDED.scanner_manual_enabled_at,
                metadata = COALESCE(invitation_addon_guest_state.metadata, '{}'::jsonb) || EXCLUDED.metadata,
                updated_at = NOW()
            `,
            [
                crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
                recipient.project_id,
                recipient.recipient_id,
                page.id,
                page.page_key,
                page.page_type,
                addonId,
                enabledAt,
                req.scannerUser.id,
                JSON.stringify({
                    source: 'scanner_manual_enable',
                    scannerUserId: req.scannerUser.id,
                    scannerUserName: req.scannerUser.name,
                    enabledAt
                })
            ]
        );

        await logScannerActivity(db, req, req.scannerUser, 'addon_manual_enable', 'invitation_recipient', recipient.recipient_id, {
            eventId: recipient.event_id,
            pageKey: page.page_key,
            addonType: page.page_type,
            addonId
        });

        await db.query('COMMIT');

        sendScannerSuccess(res, {
            recipientId: recipient.recipient_id,
            pageKey: page.page_key,
            addonType: page.page_type,
            addonId,
            manuallyEnabled: true,
            enabledAt
        });
    } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        db.release();
    }
});

export default router;
