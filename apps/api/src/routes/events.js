import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import pool from '../db/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { saveEventLogo } from '../services/eventAssets.js';
import { executeInvitationEmailSend } from './invitationProjects.js';

const router = Router();

router.use(authenticate);

const EVENT_ADDIN_IDS = new Set(['poll', 'questionnaire', 'quiz', 'instructions', 'guest_book', 'files_downloads']);

function safeJson(value, fallback = {}) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'object') return value;

    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function normalizeAddIns(addIns) {
    if (!Array.isArray(addIns)) {
        return [];
    }

    return addIns
        .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
        .filter((item) => EVENT_ADDIN_IDS.has(item));
}

function normalizeInvitationSetupTabs(tabs) {
    if (!Array.isArray(tabs)) {
        return [];
    }

    return tabs
        .map((tab, index) => {
            const type = typeof tab?.type === 'string' ? tab.type.trim() : '';
            const addonId = typeof tab?.addonId === 'string' ? tab.addonId.trim() : typeof tab?.addon_id === 'string' ? tab.addon_id.trim() : '';

            if (!EVENT_ADDIN_IDS.has(type) || !addonId) {
                return null;
            }

            return {
                type,
                addon_id: addonId,
                title: typeof tab?.title === 'string' ? tab.title.trim() : '',
                title_ar: typeof tab?.titleAr === 'string' ? tab.titleAr.trim() : typeof tab?.title_ar === 'string' ? tab.title_ar.trim() : '',
                sort_order: Number.isFinite(Number(tab?.sortOrder))
                    ? Number.parseInt(tab.sortOrder, 10)
                    : Number.isFinite(Number(tab?.sort_order))
                        ? Number.parseInt(tab.sort_order, 10)
                        : index
            };
        })
        .filter(Boolean);
}

async function fetchPollSnapshot(db, pollId, clientId, eventId) {
    const { rows: polls } = await db.query(
        `
        SELECT p.*
        FROM polls p
        WHERE p.id = $1
          AND p.client_id = $2
          AND p.event_id = $3
        LIMIT 1
        `,
        [pollId, clientId, eventId]
    );

    if (!polls.length) {
        throw new AppError('Selected poll not found', 404, 'POLL_NOT_FOUND');
    }

    const { rows: options } = await db.query(
        `
        SELECT *
        FROM poll_options
        WHERE poll_id = $1
        ORDER BY sort_order ASC, created_at ASC
        `,
        [pollId]
    );

    return {
        poll: polls[0],
        options
    };
}

function stableStringify(value) {
    if (value === null || value === undefined) {
        return 'null';
    }

    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }

    if (typeof value === 'object') {
        const keys = Object.keys(value).sort();
        return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }

    return JSON.stringify(value);
}

function computeDesignDataHash(value) {
    if (value === null || value === undefined) {
        return null;
    }

    return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function normalizeRecipientIdList(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
}

function parseOptionalSchedule(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new AppError('scheduledFor must be a valid datetime', 400, 'VALIDATION_ERROR');
    }

    return parsed;
}

async function resolvePrimaryInvitationProject(db, eventId) {
    const { rows: eventRows } = await db.query(
        `
        SELECT id, client_id, template_id, settings, primary_invitation_project_id
        FROM events
        WHERE id = $1
        LIMIT 1
        `,
        [eventId]
    );

    if (!eventRows.length) {
        throw new AppError('Event not found', 404, 'NOT_FOUND');
    }

    const event = eventRows[0];
    if (event.primary_invitation_project_id) {
        const { rows: projectRows } = await db.query(
            `
            SELECT id, event_id, settings
            FROM invitation_projects
            WHERE id = $1 AND event_id = $2
            LIMIT 1
            `,
            [event.primary_invitation_project_id, event.id]
        );

        if (projectRows.length) {
            return { event, project: projectRows[0] };
        }
    }

    const { rows: fallbackRows } = await db.query(
        `
        SELECT id, event_id, settings
        FROM invitation_projects
        WHERE event_id = $1
        ORDER BY
            CASE WHEN status IN ('active', 'draft', 'paused') THEN 0 ELSE 1 END,
            updated_at DESC NULLS LAST,
            created_at DESC NULLS LAST
        LIMIT 1
        `,
        [event.id]
    );

    if (!fallbackRows.length) {
        throw new AppError('No invitation project is available for this event', 404, 'NO_INVITATION_PROJECT');
    }

    const project = fallbackRows[0];
    await db.query(
        `
        UPDATE events
        SET primary_invitation_project_id = $1, updated_at = NOW()
        WHERE id = $2
        `,
        [project.id, event.id]
    );

    return { event, project };
}

// GET /api/admin/events - List events with filters
router.get('/', requirePermission('events.view'), async (req, res, next) => {
    try {
        const { clientId, status, eventType, search, page = 1, pageSize = 25, sortBy = 'start_datetime', sortOrder = 'desc' } = req.query;

        let whereClause = '1=1';
        const params = [];
        let paramIndex = 1;

        if (clientId) {
            whereClause += ` AND e.client_id = $${paramIndex}`;
            params.push(clientId);
            paramIndex++;
        }

        if (status && status !== 'all') {
            whereClause += ` AND e.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (eventType && eventType !== 'all') {
            whereClause += ` AND e.event_type = $${paramIndex}`;
            params.push(eventType);
            paramIndex++;
        }

        if (search) {
            whereClause += ` AND (e.name ILIKE $${paramIndex} OR e.name_ar ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        const { rows: countRows } = await pool.query(
            `SELECT COUNT(*) as total FROM events e WHERE ${whereClause}`,
            params
        );
        const total = parseInt(countRows[0].total);

        const validSortColumns = ['name', 'start_datetime', 'end_datetime', 'status', 'created_at'];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'start_datetime';
        const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        const { rows: events } = await pool.query(
            `SELECT
                e.*,
                c.name as client_name,
                c.name_ar as client_name_ar,
                COALESCE((SELECT COUNT(*)::int FROM guests g WHERE g.event_id = e.id), 0) AS total_guests,
                COALESCE((SELECT COUNT(*)::int FROM guests g WHERE g.event_id = e.id AND g.check_in_status = 'checked_in'), 0) AS checked_in_guests,
                COALESCE((SELECT COUNT(*)::int FROM guests g WHERE g.event_id = e.id AND g.check_in_status <> 'checked_in'), 0) AS not_checked_in_guests
      FROM events e
      JOIN clients c ON e.client_id = c.id
      WHERE ${whereClause}
      ORDER BY e.${sortColumn} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, parseInt(pageSize), offset]
        );

        res.json({
            data: events,
            pagination: { total, page: parseInt(page), pageSize: parseInt(pageSize), totalPages: Math.ceil(total / parseInt(pageSize)) }
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/events/:id
router.get('/:id', requirePermission('events.view'), async (req, res, next) => {
    try {
        const { rows: events } = await pool.query(
            `SELECT e.*, c.name as client_name, c.name_ar as client_name_ar, t.name as template_name, t.name_ar as template_name_ar
      FROM events e
      JOIN clients c ON e.client_id = c.id
      LEFT JOIN templates t ON t.id = e.template_id
      WHERE e.id = $1`,
            [req.params.id]
        );

        if (!events.length) {
            throw new AppError('Event not found', 404, 'NOT_FOUND');
        }

        const stats = { totalGuests: 0, checkedIn: 0, invitesSent: 0, pending: 0 };

        res.json({ data: events[0], stats });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/events
router.post('/', requirePermission('events.create'), async (req, res, next) => {
    try {
        const {
            clientId,
            name,
            nameAr,
            eventType,
            startDatetime,
            endDatetime,
            timezone = 'Asia/Riyadh',
            venue,
            venueAr,
            googleMapUrl,
            eventLogoDataUrl,
            locationMode = googleMapUrl ? 'maps' : 'manual',
            addressRegion,
            addressCity,
            addressDistrict,
            addressStreet,
            addressBuildingNumber,
            addressAdditionalNumber,
            addressPostalCode,
            addressUnitNumber,
            addIns = [],
            templateId,
            status = 'draft'
        } = req.body;

        if (!clientId || !name || !eventType || !startDatetime || !endDatetime) {
            throw new AppError('Client, name, type, and dates are required', 400, 'VALIDATION_ERROR');
        }

        const { rows: client } = await pool.query('SELECT id, event_limit FROM clients WHERE id = $1', [clientId]);
        if (!client.length) {
            throw new AppError('Client not found', 404, 'CLIENT_NOT_FOUND');
        }

        const { rows: eventCount } = await pool.query('SELECT COUNT(*) as count FROM events WHERE client_id = $1', [clientId]);
        if (parseInt(eventCount[0].count) >= client[0].event_limit) {
            throw new AppError('Client has reached event limit', 400, 'EVENT_LIMIT_REACHED');
        }

        const id = uuidv4();
        const eventLogoPath = eventLogoDataUrl ? await saveEventLogo(id, eventLogoDataUrl) : null;
        const settings = {
            addIns: normalizeAddIns(addIns)
        };
        await pool.query(
            `INSERT INTO events (
                id,
                client_id,
                name,
                name_ar,
                event_type,
                start_datetime,
                end_datetime,
                timezone,
                venue,
                venue_ar,
                google_map_url,
                event_logo_path,
                location_mode,
                address_region,
                address_city,
                address_district,
                address_street,
                address_building_number,
                address_additional_number,
                address_postal_code,
                address_unit_number,
                settings,
                template_id,
                status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)` ,
            [
                id,
                clientId,
                name,
                nameAr,
                eventType,
                startDatetime,
                endDatetime,
                timezone,
                venue,
                venueAr,
                googleMapUrl || null,
                eventLogoPath,
                locationMode || null,
                addressRegion || null,
                addressCity || null,
                addressDistrict || null,
                addressStreet || null,
                addressBuildingNumber || null,
                addressAdditionalNumber || null,
                addressPostalCode || null,
                addressUnitNumber || null,
                JSON.stringify(settings),
                templateId || null,
                status
            ]
        );

        const { rows: newEvent } = await pool.query(
            `SELECT e.*, c.name as client_name, t.name as template_name, t.name_ar as template_name_ar
             FROM events e
             JOIN clients c ON e.client_id = c.id
             LEFT JOIN templates t ON t.id = e.template_id
             WHERE e.id = $1`,
            [id]
        );

        res.status(201).json({ data: newEvent[0] });
    } catch (error) {
        next(error);
    }
});

// PUT /api/admin/events/:id
router.put('/:id', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const {
            name,
            nameAr,
            eventType,
            startDatetime,
            endDatetime,
            timezone,
            venue,
            venueAr,
            googleMapUrl,
            eventLogoDataUrl,
            locationMode,
            addressRegion,
            addressCity,
            addressDistrict,
            addressStreet,
            addressBuildingNumber,
            addressAdditionalNumber,
            addressPostalCode,
            addressUnitNumber,
            addIns = [],
            templateId,
            status
        } = req.body;

        const { rows: existing } = await pool.query('SELECT id FROM events WHERE id = $1', [req.params.id]);
        if (!existing.length) {
            throw new AppError('Event not found', 404, 'NOT_FOUND');
        }

        const eventLogoPath = eventLogoDataUrl ? await saveEventLogo(req.params.id, eventLogoDataUrl) : undefined;
        const { rows: currentRows } = await pool.query('SELECT settings FROM events WHERE id = $1', [req.params.id]);
        const currentSettings = safeJson(currentRows[0]?.settings, {});
        const nextSettings = {
            ...currentSettings,
            addIns: normalizeAddIns(addIns)
        };

        await pool.query(
            `UPDATE events SET
        name = COALESCE($1, name),
        name_ar = COALESCE($2, name_ar),
        event_type = COALESCE($3, event_type),
        start_datetime = COALESCE($4, start_datetime),
        end_datetime = COALESCE($5, end_datetime),
        timezone = COALESCE($6, timezone),
        venue = COALESCE($7, venue),
        venue_ar = COALESCE($8, venue_ar),
        google_map_url = COALESCE($9, google_map_url),
        event_logo_path = COALESCE($10, event_logo_path),
        location_mode = COALESCE($11, location_mode),
        address_region = COALESCE($12, address_region),
        address_city = COALESCE($13, address_city),
        address_district = COALESCE($14, address_district),
        address_street = COALESCE($15, address_street),
        address_building_number = COALESCE($16, address_building_number),
        address_additional_number = COALESCE($17, address_additional_number),
        address_postal_code = COALESCE($18, address_postal_code),
        address_unit_number = COALESCE($19, address_unit_number),
        settings = COALESCE($20, settings),
        template_id = COALESCE($21, template_id),
        status = COALESCE($22, status),
        updated_at = NOW()
      WHERE id = $23`,
            [
                name,
                nameAr,
                eventType,
                startDatetime,
                endDatetime,
                timezone,
                venue,
                venueAr,
                googleMapUrl,
                eventLogoPath,
                locationMode,
                addressRegion,
                addressCity,
                addressDistrict,
                addressStreet,
                addressBuildingNumber,
                addressAdditionalNumber,
                addressPostalCode,
                addressUnitNumber,
                JSON.stringify(nextSettings),
                templateId || null,
                status,
                req.params.id
            ]
        );

        const { rows: updated } = await pool.query(
            `SELECT e.*, c.name as client_name, t.name as template_name, t.name_ar as template_name_ar
             FROM events e
             JOIN clients c ON e.client_id = c.id
             LEFT JOIN templates t ON t.id = e.template_id
             WHERE e.id = $1`,
            [req.params.id]
        );

        res.json({ data: updated[0] });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/admin/events/:id
router.delete('/:id', requirePermission('events.delete'), async (req, res, next) => {
    try {
        const { rows: existing } = await pool.query('SELECT id FROM events WHERE id = $1', [req.params.id]);
        if (!existing.length) {
            throw new AppError('Event not found', 404, 'NOT_FOUND');
        }

        await pool.query('DELETE FROM events WHERE id = $1', [req.params.id]);

        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        next(error);
    }
});

// PATCH /api/admin/events/:id/invitation-setup
router.patch('/:id/invitation-setup', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const { rows: existingRows } = await pool.query(
            'SELECT id, client_id, template_id, settings FROM events WHERE id = $1',
            [req.params.id]
        );

        if (!existingRows.length) {
            throw new AppError('Event not found', 404, 'NOT_FOUND');
        }

        const existing = existingRows[0];
        const currentSettings = safeJson(existing.settings, {});
        const hasTemplateId = Object.prototype.hasOwnProperty.call(req.body, 'templateId');
        const hasInvitationSetup = Object.prototype.hasOwnProperty.call(req.body, 'invitationSetup');

        let nextSettings = { ...currentSettings };
        if (hasInvitationSetup) {
            const setup = req.body.invitationSetup;
            const normalizedTabs = normalizeInvitationSetupTabs(setup?.tabs);
            const enabledAddIns = new Set(Array.isArray(currentSettings.addIns) ? currentSettings.addIns : []);
            const selectedTabs = [];

            for (const tab of normalizedTabs) {
                if (!enabledAddIns.has(tab.type)) {
                    throw new AppError('Selected add-in is not enabled for this event', 400, 'VALIDATION_ERROR');
                }

                if (tab.type === 'poll') {
                    const snapshot = await fetchPollSnapshot(pool, tab.addon_id, existing.client_id, req.params.id);
                    selectedTabs.push({
                        ...tab,
                        title: tab.title || snapshot.poll.title,
                        title_ar: tab.title_ar || snapshot.poll.title_ar || '',
                        addon_snapshot: {
                            type: 'poll',
                            poll_id: snapshot.poll.id,
                            title: snapshot.poll.title,
                            title_ar: snapshot.poll.title_ar || '',
                            subtitle: snapshot.poll.subtitle || '',
                            subtitle_ar: snapshot.poll.subtitle_ar || '',
                            description: snapshot.poll.description || '',
                            description_ar: snapshot.poll.description_ar || '',
                            cover_image_path: snapshot.poll.cover_image_path || '',
                            theme_settings: safeJson(snapshot.poll.theme_settings, {}),
                            layout_settings: safeJson(snapshot.poll.layout_settings, {}),
                            poll_mode: snapshot.poll.poll_mode,
                            allow_multiple_choice: snapshot.poll.allow_multiple_choice,
                            require_login: snapshot.poll.require_login,
                            start_date: snapshot.poll.start_date,
                            end_date: snapshot.poll.end_date,
                            max_votes_per_user: snapshot.poll.max_votes_per_user,
                            show_results_mode: snapshot.poll.show_results_mode,
                            options: snapshot.options.map((option) => ({
                                id: option.id,
                                text: option.text,
                                text_ar: option.text_ar,
                                image_path: option.image_path,
                                icon_path: option.icon_path || '',
                                icon: option.icon || '',
                                color_override: option.color_override || '',
                                sort_order: option.sort_order,
                                votes_count: option.votes_count || 0
                            }))
                        }
                    });
                    continue;
                }

                selectedTabs.push(tab);
            }

            nextSettings.invitation_setup = {
                ...safeJson(nextSettings.invitation_setup, {}),
                ...safeJson(setup, {}),
                tabs: selectedTabs
            };
        }

        const nextTemplateId = hasTemplateId
            ? (req.body.templateId || null)
            : existing.template_id;

        await pool.query(
            `
            UPDATE events
            SET
                template_id = $1,
                settings = $2::jsonb,
                updated_at = NOW()
            WHERE id = $3
            `,
            [
                nextTemplateId,
                JSON.stringify(nextSettings),
                req.params.id
            ]
        );

        const { rows: updated } = await pool.query(
            `SELECT e.*, c.name as client_name, c.name_ar as client_name_ar, t.name as template_name, t.name_ar as template_name_ar
             FROM events e
             JOIN clients c ON e.client_id = c.id
             LEFT JOIN templates t ON t.id = e.template_id
             WHERE e.id = $1`,
            [req.params.id]
        );

        res.json({ data: updated[0] });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/events/:id/sync-invitation-template
router.post('/:id/sync-invitation-template', requirePermission('events.edit'), async (req, res, next) => {
    const db = await pool.connect();

    try {
        const eventId = req.params.id;
        if (!eventId) {
            throw new AppError('Event id is required', 400, 'VALIDATION_ERROR');
        }

        await db.query('BEGIN');
        const { event, project } = await resolvePrimaryInvitationProject(db, eventId);

        const eventTemplateId = event.template_id || null;
        let coverTemplateSnapshot = null;
        let coverTemplateHash = null;

        if (eventTemplateId) {
            const { rows: templates } = await db.query(
                'SELECT design_data FROM templates WHERE id = $1 LIMIT 1',
                [eventTemplateId]
            );
            if (!templates.length) {
                throw new AppError('Event template not found', 404, 'NOT_FOUND');
            }
            coverTemplateSnapshot = templates[0].design_data;
            coverTemplateHash = computeDesignDataHash(coverTemplateSnapshot);
        }

        const nextSettings = safeJson(project.settings, {});
        nextSettings.cover_template_id = eventTemplateId;
        nextSettings.cover_template_hash = coverTemplateHash;

        await db.query(
            `
            UPDATE invitation_projects
            SET
                cover_template_id = $1,
                cover_template_snapshot = $2::jsonb,
                settings = $3::jsonb,
                updated_at = NOW()
            WHERE id = $4
            `,
            [
                eventTemplateId,
                coverTemplateSnapshot === null ? null : JSON.stringify(coverTemplateSnapshot),
                JSON.stringify(nextSettings),
                project.id
            ]
        );

        await db.query(
            `
            UPDATE invitation_project_pages
            SET
                settings = $1::jsonb,
                updated_at = NOW()
            WHERE project_id = $2
              AND page_type = 'cover'
            `,
            [
                JSON.stringify({
                    coverTemplateId: eventTemplateId,
                    coverTemplateSnapshot,
                    coverTemplateHash
                }),
                project.id
            ]
        );

        await db.query('COMMIT');

        res.json({
            data: {
                eventId,
                projectId: project.id,
                synced: true,
                coverTemplateHash
            }
        });
    } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        console.error('Failed to sync invitation template from event dashboard:', {
            eventId: req.params.id,
            message: error?.message || 'unknown',
            stack: error?.stack
        });
        next(error);
    } finally {
        db.release();
    }
});

// POST /api/admin/events/:id/send-invitations
router.post('/:id/send-invitations', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const eventId = req.params.id;
        if (!eventId) {
            throw new AppError('Event id is required', 400, 'VALIDATION_ERROR');
        }

        const { event, project } = await resolvePrimaryInvitationProject(pool, eventId);
        const requestedRecipientIds = normalizeRecipientIdList(req.body?.recipientIds);
        const scheduledFor = parseOptionalSchedule(req.body?.scheduledFor);
        const sendResult = await executeInvitationEmailSend({
            projectId: project.id,
            requestedRecipientIds,
            scheduledFor,
            trace: false,
            createdBy: req.user?.id || null
        });

        res.json({
            data: {
                eventId: event.id,
                projectId: project.id,
                summary: sendResult.summary,
                selection: sendResult.debug?.selection || null
            }
        });
    } catch (error) {
        console.error('Failed to send invitations from event dashboard:', {
            eventId: req.params.id,
            message: error?.message || 'unknown',
            stack: error?.stack
        });
        next(error);
    }
});

// GET /api/admin/events/:id/invitation-summary
router.get('/:id/invitation-summary', requirePermission('events.view'), async (req, res, next) => {
    try {
        const eventId = req.params.id;
        if (!eventId) {
            throw new AppError('Event id is required', 400, 'VALIDATION_ERROR');
        }

        const { event, project } = await resolvePrimaryInvitationProject(pool, eventId);
        const { rows: aggregateRows } = await pool.query(
            `
            SELECT
                COUNT(*)::int AS recipients,
                COUNT(*) FILTER (WHERE overall_status = 'queued')::int AS queued,
                COUNT(*) FILTER (WHERE overall_status = 'sent')::int AS sent,
                COUNT(*) FILTER (WHERE overall_status = 'delivered')::int AS delivered,
                COUNT(*) FILTER (WHERE overall_status = 'opened')::int AS opened,
                COUNT(*) FILTER (WHERE overall_status = 'responded')::int AS responded,
                COUNT(*) FILTER (WHERE overall_status = 'failed')::int AS failed
            FROM invitation_recipients
            WHERE project_id = $1
            `,
            [project.id]
        );

        const totals = aggregateRows[0] || {
            recipients: 0,
            queued: 0,
            sent: 0,
            delivered: 0,
            opened: 0,
            responded: 0,
            failed: 0
        };

        res.json({
            data: {
                eventId: event.id,
                projectId: project.id,
                totals,
                lastUpdatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Failed to fetch event invitation summary:', {
            eventId: req.params.id,
            message: error?.message || 'unknown',
            stack: error?.stack
        });
        next(error);
    }
});

// PATCH /api/admin/events/:id/status - Activate or deactivate event
router.patch('/:id/status', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!status || !['draft', 'active', 'completed', 'cancelled'].includes(status)) {
            throw new AppError('Status is invalid', 400, 'VALIDATION_ERROR');
        }

        const { rows: existing } = await pool.query('SELECT id FROM events WHERE id = $1', [req.params.id]);
        if (!existing.length) {
            throw new AppError('Event not found', 404, 'NOT_FOUND');
        }

        await pool.query(
            'UPDATE events SET status = $1, updated_at = NOW() WHERE id = $2',
            [status, req.params.id]
        );

        const { rows: updated } = await pool.query(
            `SELECT e.*, c.name as client_name, t.name as template_name, t.name_ar as template_name_ar
             FROM events e
             JOIN clients c ON e.client_id = c.id
             LEFT JOIN templates t ON t.id = e.template_id
             WHERE e.id = $1`,
            [req.params.id]
        );

        res.json({ data: updated[0] });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/events/:id/stats
router.get('/:id/stats', requirePermission('events.view'), async (req, res, next) => {
    try {
        const { rows: event } = await pool.query('SELECT id FROM events WHERE id = $1', [req.params.id]);
        if (!event.length) {
            throw new AppError('Event not found', 404, 'NOT_FOUND');
        }

        const { rows: guestStats } = await pool.query(
            `
            SELECT
                COUNT(*)::int AS total_guests,
                COUNT(*) FILTER (WHERE check_in_status = 'checked_in')::int AS checked_in_guests,
                COUNT(*) FILTER (WHERE check_in_status <> 'checked_in')::int AS not_checked_in_guests
            FROM guests
            WHERE event_id = $1
            `,
            [req.params.id]
        );

        const row = guestStats[0] || {};

        res.json({
            data: {
                totalGuests: row.total_guests || 0,
                checkedIn: row.checked_in_guests || 0,
                invitesSent: 0,
                pending: row.not_checked_in_guests || 0,
                scansToday: 0
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
