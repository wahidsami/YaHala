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
const EVENT_ADDON_PAGE_TYPES = new Set(['poll', 'questionnaire', 'quiz', 'instructions', 'guest_book', 'files_downloads']);

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

    const normalized = addIns
        .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
        .filter((item) => EVENT_ADDIN_IDS.has(item));

    return Array.from(new Set(normalized));
}

function normalizeInvitationSetupTabs(tabs) {
    const normalizeActivationRules = (input) => {
        const source = safeJson(input, {});
        const hasSchedule = Boolean(source.liveOnSchedule);
        const scheduleStartAt = typeof source.scheduleStartAt === 'string' ? source.scheduleStartAt.trim() : '';
        const scheduleEndAt = typeof source.scheduleEndAt === 'string' ? source.scheduleEndAt.trim() : '';

        return {
            liveAfterQrScanned: Boolean(source.liveAfterQrScanned),
            liveWhenScannerEnabled: Boolean(source.liveWhenScannerEnabled),
            liveOnSchedule: hasSchedule,
            scheduleStartAt: hasSchedule ? scheduleStartAt : '',
            scheduleEndAt: hasSchedule ? scheduleEndAt : '',
            unlockLogic: source.unlockLogic === 'all' ? 'all' : 'any'
        };
    };

    const normalizeDisplay = (input) => {
        const source = safeJson(input, {});
        const mode = source.mode === 'tabs' || source.mode === 'icons' ? source.mode : 'tabs';
        const position = ['top', 'left', 'right', 'bottom', 'qr_slot'].includes(source.position)
            ? source.position
            : (mode === 'icons' ? 'top' : 'top');

        return {
            mode,
            position,
            replaceQrSlot: Boolean(source.replaceQrSlot),
            disableAfterSubmission: source.disableAfterSubmission !== false,
            showBackButton: source.showBackButton !== false,
            autoReturnAfterSubmit: source.autoReturnAfterSubmit !== false
        };
    };

    const normalizeInstructions = (input) => {
        const source = safeJson(input, {});
        const content = safeJson(source.content, {});
        const style = safeJson(source.style, {});
        const normalizeBulletList = (value) => {
            if (!Array.isArray(value)) {
                return [];
            }
            return value
                .map((item) => (typeof item === 'string' ? item.trim() : ''))
                .filter(Boolean)
                .slice(0, 12);
        };
        const normalizeImageList = (value) => {
            if (!Array.isArray(value)) {
                return [];
            }
            return value
                .map((item) => (typeof item === 'string' ? item.trim() : ''))
                .filter(Boolean)
                .slice(0, 8);
        };

        return {
            content: {
                en: {
                    title: clampText(content?.en?.title, 140),
                    body: clampText(content?.en?.body, 1200),
                    bullets: normalizeBulletList(content?.en?.bullets),
                    images: normalizeImageList(content?.en?.images)
                },
                ar: {
                    title: clampText(content?.ar?.title, 140),
                    body: clampText(content?.ar?.body, 1200),
                    bullets: normalizeBulletList(content?.ar?.bullets),
                    images: normalizeImageList(content?.ar?.images)
                }
            },
            style: {
                backgroundColor: typeof style?.backgroundColor === 'string' ? style.backgroundColor : '#FFFFFF',
                textColor: typeof style?.textColor === 'string' ? style.textColor : '#0F172A',
                accentColor: typeof style?.accentColor === 'string' ? style.accentColor : '#0A7EA4'
            }
        };
    };

    if (!Array.isArray(tabs)) {
        return [];
    }

    const normalized = tabs
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
                activation_rules: normalizeActivationRules(tab?.activationRules || tab?.activation_rules),
                display: normalizeDisplay(tab?.display),
                instructions: type === 'instructions' ? normalizeInstructions(tab?.instructions) : undefined,
                sort_order: Number.isFinite(Number(tab?.sortOrder))
                    ? Number.parseInt(tab.sortOrder, 10)
                    : Number.isFinite(Number(tab?.sort_order))
                        ? Number.parseInt(tab.sort_order, 10)
                        : index
            };
        })
        .filter(Boolean);

    const seen = new Set();
    return normalized.filter((tab) => {
        const key = `${tab.type}:${tab.addon_id}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function clampText(value, maxLength = 240) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim().slice(0, maxLength);
}

function normalizeRsvpGateConfig(input) {
    const source = safeJson(input, {});
    const style = safeJson(source.style, {});
    const copy = safeJson(source.copy, {});
    const behavior = safeJson(source.behavior, {});
    const normalizeCopy = (bucket = {}) => ({
        attendanceTitle: clampText(bucket.attendanceTitle, 120),
        attendanceBody: clampText(bucket.attendanceBody, 280),
        reasonLabel: clampText(bucket.reasonLabel, 120),
        reasonPlaceholder: clampText(bucket.reasonPlaceholder, 180),
        positiveTitle: clampText(bucket.positiveTitle, 120),
        positiveBody: clampText(bucket.positiveBody, 280),
        positiveButton: clampText(bucket.positiveButton, 60),
        negativeTitle: clampText(bucket.negativeTitle, 120),
        negativeBody: clampText(bucket.negativeBody, 280),
        negativeButton: clampText(bucket.negativeButton, 60)
    });

    return {
        enabled: Boolean(source.enabled),
        style: {
            variant: ['minimal', 'card', 'brand'].includes(style.variant) ? style.variant : 'brand',
            primaryColor: typeof style.primaryColor === 'string' ? style.primaryColor : '#946FA7',
            secondaryColor: typeof style.secondaryColor === 'string' ? style.secondaryColor : '#FF9D00',
            icon: typeof style.icon === 'string' ? style.icon : 'sparkles'
        },
        copy: {
            en: normalizeCopy(safeJson(copy.en, {})),
            ar: normalizeCopy(safeJson(copy.ar, {}))
        },
        behavior: {
            showReasonOnNo: behavior.showReasonOnNo !== false,
            requireReasonOnNo: behavior.showReasonOnNo === false ? false : Boolean(behavior.requireReasonOnNo)
        }
    };
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

async function fetchQuestionnaireSnapshot(db, questionnaireId, clientId, eventId) {
    const { rows: questionnaires } = await db.query(
        `
        SELECT *
        FROM questionnaires
        WHERE id = $1
          AND client_id = $2
          AND event_id = $3
        LIMIT 1
        `,
        [questionnaireId, clientId, eventId]
    );

    if (!questionnaires.length) {
        throw new AppError('Selected questionnaire not found', 404, 'QUESTIONNAIRE_NOT_FOUND');
    }

    const questionnaire = questionnaires[0];
    const { rows: questions } = await db.query(
        `
        SELECT *
        FROM questionnaire_questions
        WHERE questionnaire_id = $1
        ORDER BY sort_order ASC, created_at ASC
        `,
        [questionnaire.id]
    );

    const questionIds = questions.map((item) => item.id);
    let options = [];
    if (questionIds.length) {
        const { rows } = await db.query(
            `
            SELECT *
            FROM questionnaire_options
            WHERE question_id = ANY($1::uuid[])
            ORDER BY sort_order ASC, created_at ASC
            `,
            [questionIds]
        );
        options = rows;
    }

    const optionsByQuestionId = options.reduce((accumulator, option) => {
        if (!accumulator[option.question_id]) {
            accumulator[option.question_id] = [];
        }
        accumulator[option.question_id].push({
            id: option.id,
            label: option.label,
            label_ar: option.label_ar,
            value: option.value,
            sort_order: option.sort_order
        });
        return accumulator;
    }, {});

    return {
        questionnaire,
        questions: questions.map((question) => ({
            id: question.id,
            question_type: question.question_type,
            title: question.title,
            title_ar: question.title_ar || '',
            description: question.description || '',
            description_ar: question.description_ar || '',
            is_required: question.is_required,
            sort_order: question.sort_order,
            settings: safeJson(question.settings, {}),
            options: optionsByQuestionId[question.id] || []
        }))
    };
}

async function fetchInstructionsSnapshot(db, instructionId, clientId) {
    const { rows } = await db.query(
        `
        SELECT id, name, name_ar, status, content_schema, editor_settings
        FROM instructions
        WHERE id = $1
          AND client_id = $2
        LIMIT 1
        `,
        [instructionId, clientId]
    );

    if (!rows.length) {
        throw new AppError('Selected instructions not found', 404, 'INSTRUCTIONS_NOT_FOUND');
    }

    const instruction = rows[0];
    const contentSchema = safeJson(instruction.content_schema, {});
    const editorSettings = safeJson(instruction.editor_settings, {});

    return {
        instruction,
        contentSchema,
        editorSettings
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

function normalizeGuestIdList(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
}

function normalizeAudience(value) {
    const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
    const allowed = new Set([
        'newly_added',
        'failed',
        'sent_not_opened',
        'opened_not_responded',
        'custom_selected'
    ]);
    return allowed.has(text) ? text : 'newly_added';
}

async function resolveAudienceRecipientIds(db, projectId, audience, explicitRecipientIds = []) {
    if (audience === 'custom_selected') {
        return normalizeRecipientIdList(explicitRecipientIds);
    }

    let whereClause = '';
    if (audience === 'failed') {
        whereClause = `r.overall_status = 'failed'`;
    } else if (audience === 'sent_not_opened') {
        whereClause = `r.overall_status IN ('sent', 'delivered')`;
    } else if (audience === 'opened_not_responded') {
        whereClause = `r.overall_status = 'opened'`;
    } else {
        whereClause = `r.overall_status = 'draft'`;
    }

    const { rows } = await db.query(
        `
        SELECT r.id
        FROM invitation_recipients r
        WHERE r.project_id = $1
          AND ${whereClause}
        ORDER BY r.created_at ASC
        `,
        [projectId]
    );

    return rows.map((row) => row.id).filter(Boolean);
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

async function syncEventTemplateToProject(db, eventId, eventTemplateId) {
    const { project } = await resolvePrimaryInvitationProject(db, eventId);

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

    // Invalidate cached recipient snapshots so public links reflect latest cover template/settings.
    await db.query(
        `
        UPDATE invitation_recipients
        SET
            invitation_snapshot = NULL,
            invitation_snapshot_hash = NULL,
            invitation_snapshot_at = NULL,
            updated_at = NOW()
        WHERE project_id = $1
        `,
        [project.id]
    );

    return {
        projectId: project.id,
        coverTemplateHash
    };
}

async function syncProjectAddonPagesFromEventSetup(db, projectId, tabs = []) {
    const normalizedTabs = Array.isArray(tabs) ? tabs.filter((tab) => EVENT_ADDON_PAGE_TYPES.has(tab?.type) && tab?.addon_id) : [];

    await db.query(
        `
        DELETE FROM invitation_project_pages
        WHERE project_id = $1
          AND page_type = ANY($2::text[])
        `,
        [projectId, Array.from(EVENT_ADDON_PAGE_TYPES)]
    );

    if (!normalizedTabs.length) {
        return;
    }

    const { rows: maxRows } = await db.query(
        `
        SELECT COALESCE(MAX(sort_order), 0)::int AS max_sort
        FROM invitation_project_pages
        WHERE project_id = $1
        `,
        [projectId]
    );
    let sortOrder = (maxRows[0]?.max_sort || 0) + 1;

    for (const tab of normalizedTabs) {
        const pageId = uuidv4();
        const addonId = tab.addon_id;
        const pageKey = `${tab.type}-${String(addonId).slice(0, 8)}-${sortOrder}`;
        const title = tab.title || tab.type;
        const titleAr = tab.title_ar || null;

        const settings = {
            source: 'event_invitation_setup',
            addon_type: tab.type,
            addon_id: addonId,
            activation_rules: safeJson(tab.activation_rules, {}),
            display: safeJson(tab.display, {}),
            addon_snapshot: safeJson(tab.addon_snapshot, {})
        };

        if (tab.type === 'instructions') {
            settings.instructions = safeJson(tab.addon_snapshot, {});
        }

        await db.query(
            `
            INSERT INTO invitation_project_pages (
                id,
                project_id,
                page_key,
                page_type,
                title,
                title_ar,
                description,
                description_ar,
                sort_order,
                is_enabled,
                settings
            )
            VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, $7, TRUE, $8::jsonb)
            `,
            [
                pageId,
                projectId,
                pageKey,
                tab.type,
                title,
                titleAr,
                sortOrder,
                JSON.stringify(settings)
            ]
        );

        sortOrder += 1;
    }
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
        const hasRsvpGate = Object.prototype.hasOwnProperty.call(req.body, 'rsvpGate');

        let nextSettings = { ...currentSettings };
        const hasAddIns = Object.prototype.hasOwnProperty.call(req.body, 'addIns');
        const requestedAddIns = hasAddIns
            ? normalizeAddIns(req.body.addIns)
            : normalizeAddIns(currentSettings.addIns || []);

        if (hasAddIns) {
            nextSettings.addIns = requestedAddIns;
        }

        let selectedTabsForSync = null;

        if (hasInvitationSetup) {
            const setup = req.body.invitationSetup;
            const normalizedTabs = normalizeInvitationSetupTabs(setup?.tabs);
            const enabledAddIns = new Set(requestedAddIns);
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
                        activation_rules: safeJson(tab.activation_rules, {}),
                        display: safeJson(tab.display, {}),
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

                if (tab.type === 'questionnaire') {
                    const snapshot = await fetchQuestionnaireSnapshot(pool, tab.addon_id, existing.client_id, req.params.id);
                    selectedTabs.push({
                        ...tab,
                        title: tab.title || snapshot.questionnaire.title,
                        title_ar: tab.title_ar || snapshot.questionnaire.title_ar || '',
                        activation_rules: safeJson(tab.activation_rules, {}),
                        display: safeJson(tab.display, {}),
                        addon_snapshot: {
                            type: 'questionnaire',
                            questionnaire_id: snapshot.questionnaire.id,
                            title: snapshot.questionnaire.title,
                            title_ar: snapshot.questionnaire.title_ar || '',
                            description: snapshot.questionnaire.description || '',
                            description_ar: snapshot.questionnaire.description_ar || '',
                            status: snapshot.questionnaire.status,
                            start_date: snapshot.questionnaire.start_date,
                            end_date: snapshot.questionnaire.end_date,
                            settings: safeJson(snapshot.questionnaire.settings, {}),
                            questions: snapshot.questions
                        }
                    });
                    continue;
                }

                if (tab.type === 'instructions') {
                    const snapshot = await fetchInstructionsSnapshot(pool, tab.addon_id, existing.client_id);
                    const content = safeJson(snapshot.contentSchema?.content, {});
                    const style = safeJson(snapshot.contentSchema?.style, {});
                    selectedTabs.push({
                        ...tab,
                        title: tab.title || snapshot.instruction.name || 'Instructions',
                        title_ar: tab.title_ar || snapshot.instruction.name_ar || 'تعليمات',
                        activation_rules: safeJson(tab.activation_rules, {}),
                        display: safeJson(tab.display, {}),
                        addon_snapshot: {
                            type: 'instructions',
                            instruction_id: snapshot.instruction.id,
                            title: snapshot.instruction.name || 'Instructions',
                            title_ar: snapshot.instruction.name_ar || 'تعليمات',
                            status: snapshot.instruction.status || 'draft',
                            content: {
                                en: safeJson(content.en, {}),
                                ar: safeJson(content.ar, {})
                            },
                            style: {
                                backgroundColor: typeof style?.backgroundColor === 'string' ? style.backgroundColor : '#FFFFFF',
                                textColor: typeof style?.textColor === 'string' ? style.textColor : '#0F172A',
                                accentColor: typeof style?.accentColor === 'string' ? style.accentColor : '#0A7EA4'
                            },
                            editor_settings: snapshot.editorSettings
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
            selectedTabsForSync = selectedTabs;
        } else if (hasAddIns) {
            const existingSetup = safeJson(nextSettings.invitation_setup, {});
            const existingTabs = Array.isArray(existingSetup.tabs) ? existingSetup.tabs : [];
            const enabledAddIns = new Set(requestedAddIns);
            nextSettings.invitation_setup = {
                ...existingSetup,
                tabs: existingTabs.filter((tab) => enabledAddIns.has(tab?.type))
            };
        }

        if (hasRsvpGate) {
            nextSettings.rsvp_gate = normalizeRsvpGateConfig(req.body.rsvpGate);
        }

        if (selectedTabsForSync) {
            const { project } = await resolvePrimaryInvitationProject(pool, req.params.id);
            await syncProjectAddonPagesFromEventSetup(pool, project.id, selectedTabsForSync);
            await pool.query(
                `
                UPDATE invitation_recipients
                SET
                    invitation_snapshot = NULL,
                    invitation_snapshot_hash = NULL,
                    invitation_snapshot_at = NULL,
                    updated_at = NOW()
                WHERE project_id = $1
                `,
                [project.id]
            );
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

        if (hasTemplateId) {
            await syncEventTemplateToProject(pool, req.params.id, nextTemplateId);
        }
        if (hasRsvpGate) {
            const { project } = await resolvePrimaryInvitationProject(pool, req.params.id);
            await pool.query(
                `
                UPDATE invitation_recipients
                SET
                    invitation_snapshot = NULL,
                    invitation_snapshot_hash = NULL,
                    invitation_snapshot_at = NULL,
                    updated_at = NOW()
                WHERE project_id = $1
                `,
                [project.id]
            );
        }

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
        const { event } = await resolvePrimaryInvitationProject(db, eventId);
        const eventTemplateId = event.template_id || null;
        const syncResult = await syncEventTemplateToProject(db, eventId, eventTemplateId);

        await db.query('COMMIT');

        res.json({
            data: {
                eventId,
                projectId: syncResult.projectId,
                synced: true,
                coverTemplateHash: syncResult.coverTemplateHash
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
        const audience = normalizeAudience(req.body?.audience);
        const requestedRecipientIds = await resolveAudienceRecipientIds(
            pool,
            project.id,
            audience,
            req.body?.recipientIds
        );
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
                audience,
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

// POST /api/admin/events/:id/send-invitations/trace
router.post('/:id/send-invitations/trace', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const eventId = req.params.id;
        if (!eventId) {
            throw new AppError('Event id is required', 400, 'VALIDATION_ERROR');
        }

        const { event, project } = await resolvePrimaryInvitationProject(pool, eventId);
        const audience = normalizeAudience(req.body?.audience);
        const requestedRecipientIds = await resolveAudienceRecipientIds(
            pool,
            project.id,
            audience,
            req.body?.recipientIds
        );
        const scheduledFor = parseOptionalSchedule(req.body?.scheduledFor);
        const traceResult = await executeInvitationEmailSend({
            projectId: project.id,
            requestedRecipientIds,
            scheduledFor,
            trace: true,
            createdBy: req.user?.id || null
        });

        res.json({
            data: {
                eventId: event.id,
                projectId: project.id,
                audience,
                summary: traceResult.summary,
                selection: traceResult.debug?.selection || null,
                trace: traceResult.trace || null
            }
        });
    } catch (error) {
        console.error('Failed to trace send invitations from event dashboard:', {
            eventId: req.params.id,
            message: error?.message || 'unknown',
            stack: error?.stack
        });
        next(error);
    }
});

// GET /api/admin/events/:id/rsvp-responses
router.get('/:id/rsvp-responses', requirePermission('events.view'), async (req, res, next) => {
    try {
        const eventId = req.params.id;
        if (!eventId) {
            throw new AppError('Event id is required', 400, 'VALIDATION_ERROR');
        }

        const { rows: eventRows } = await pool.query(
            `
            SELECT id, primary_invitation_project_id
            FROM events
            WHERE id = $1
            LIMIT 1
            `,
            [eventId]
        );

        if (!eventRows.length) {
            throw new AppError('Event not found', 404, 'NOT_FOUND');
        }

        const projectId = eventRows[0].primary_invitation_project_id || null;
        if (!projectId) {
            return res.json({ data: { rows: [], totals: { total: 0, attending: 0, maybe: 0, notAttending: 0 } } });
        }

        const { rows } = await pool.query(
            `
            SELECT
                r.id AS recipient_id,
                COALESCE(r.display_name, cg.name, '') AS guest_name,
                r.email,
                r.phone,
                r.whatsapp_number,
                r.responded_at,
                ir.response_data
            FROM invitation_recipients r
            LEFT JOIN client_guests cg ON cg.id = r.client_guest_id
            LEFT JOIN invitation_module_responses ir
                ON ir.recipient_id = r.id
               AND ir.project_id = r.project_id
               AND ir.response_status = 'submitted'
            LEFT JOIN invitation_modules m
                ON m.id = ir.module_id
               AND m.module_type = 'rsvp'
            WHERE r.project_id = $1
            ORDER BY COALESCE(r.responded_at, r.updated_at, r.created_at) DESC
            `,
            [projectId]
        );

        const normalized = rows.map((row) => {
            const responseData = safeJson(row.response_data, {});
            return {
                recipientId: row.recipient_id,
                guestName: row.guest_name || '-',
                email: row.email || '',
                phone: row.phone || row.whatsapp_number || '',
                attendance: responseData.attendance || null,
                notes: responseData.notes || '',
                respondedAt: row.responded_at
            };
        });

        const totals = normalized.reduce((accumulator, row) => {
            if (!row.attendance) return accumulator;
            accumulator.total += 1;
            if (row.attendance === 'attending') accumulator.attending += 1;
            if (row.attendance === 'maybe') accumulator.maybe += 1;
            if (row.attendance === 'not_attending') accumulator.notAttending += 1;
            return accumulator;
        }, { total: 0, attending: 0, maybe: 0, notAttending: 0 });

        res.json({ data: { rows: normalized, totals } });
    } catch (error) {
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

// GET /api/admin/events/:id/attendance-summary
router.get('/:id/attendance-summary', requirePermission('events.view'), async (req, res, next) => {
    try {
        const eventId = req.params.id;
        if (!eventId) {
            throw new AppError('Event id is required', 400, 'VALIDATION_ERROR');
        }

        const { rows: eventRows } = await pool.query(
            `
            SELECT id, client_id, name, name_ar, status
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
                COUNT(*) FILTER (WHERE check_in_status = 'checked_in')::int AS walk_in_checked_in
            FROM event_walk_ins
            WHERE event_id = $1
            `,
            [eventId]
        );

        const walkInStats = walkInRows[0] || {
            walk_in_total: 0,
            walk_in_checked_in: 0
        };

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

        const invitedTotal = invitationStats.invited_total || 0;
        const invitedAttended = invitationStats.attended_from_invitations || 0;
        const invitedPending = Math.max(invitedTotal - invitedAttended, 0);
        const walkInTotal = walkInStats.walk_in_total || 0;
        const walkInCheckedIn = walkInStats.walk_in_checked_in || 0;

        res.json({
            data: {
                event: {
                    id: event.id,
                    name: event.name,
                    name_ar: event.name_ar,
                    status: event.status
                },
                totals: {
                    invitedTotal,
                    invitedAttended,
                    invitedPending,
                    walkInTotal,
                    walkInCheckedIn,
                    checkedInTotal: invitedAttended + walkInCheckedIn,
                    duplicateScanCount: duplicateScanRows[0]?.duplicate_scan_count || 0
                },
                lastUpdatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Failed to fetch event attendance summary:', {
            eventId: req.params.id,
            message: error?.message || 'unknown',
            stack: error?.stack
        });
        next(error);
    }
});

// GET /api/admin/events/:id/addons-summary
router.get('/:id/addons-summary', requirePermission('events.view'), async (req, res, next) => {
    try {
        const eventId = req.params.id;
        if (!eventId) {
            throw new AppError('Event id is required', 400, 'VALIDATION_ERROR');
        }

        const { rows: eventRows } = await pool.query(
            `
            SELECT id, settings
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
        const settings = safeJson(event.settings, {});
        const addIns = Array.isArray(settings.addIns) ? settings.addIns : [];
        const invitationSetup = safeJson(settings.invitation_setup, {});
        const tabs = Array.isArray(invitationSetup.tabs) ? invitationSetup.tabs : [];

        const normalizedTabs = tabs.map((tab, index) => ({
            type: typeof tab?.type === 'string' ? tab.type : '',
            addonId: tab?.addon_id || tab?.addonId || null,
            title: tab?.title || '',
            titleAr: tab?.title_ar || tab?.titleAr || '',
            activationRules: safeJson(tab?.activation_rules || tab?.activationRules, {}),
            display: safeJson(tab?.display, {}),
            instructions: safeJson(tab?.instructions, {}),
            sortOrder: Number.isFinite(Number(tab?.sort_order))
                ? Number.parseInt(tab.sort_order, 10)
                : Number.isFinite(Number(tab?.sortOrder))
                    ? Number.parseInt(tab.sortOrder, 10)
                    : index
        }));

        const pollAddonEnabled = addIns.includes('poll');
        const pollTabIds = normalizedTabs
            .filter((tab) => tab.type === 'poll' && tab.addonId)
            .map((tab) => tab.addonId);
        const questionnaireAddonEnabled = addIns.includes('questionnaire');
        const questionnaireTabIds = normalizedTabs
            .filter((tab) => tab.type === 'questionnaire' && tab.addonId)
            .map((tab) => tab.addonId);
        const instructionsAddonEnabled = addIns.includes('instructions');
        const instructionTabs = normalizedTabs
            .filter((tab) => tab.type === 'instructions' && tab.addonId);

        let pollDetails = [];
        if (pollTabIds.length) {
            const { rows } = await pool.query(
                `
                SELECT id, title, title_ar, status
                FROM polls
                WHERE id = ANY($1::uuid[])
                ORDER BY created_at DESC
                `,
                [pollTabIds]
            );
            pollDetails = rows;
        }

        let questionnaireDetails = [];
        if (questionnaireTabIds.length) {
            const { rows } = await pool.query(
                `
                SELECT
                    q.id,
                    q.title,
                    q.title_ar,
                    q.status,
                    COALESCE((SELECT COUNT(*)::int FROM questionnaire_questions qq WHERE qq.questionnaire_id = q.id), 0) AS question_count,
                    COALESCE((SELECT COUNT(*)::int FROM questionnaire_submissions qs WHERE qs.questionnaire_id = q.id), 0) AS submission_count
                FROM questionnaires q
                WHERE q.id = ANY($1::uuid[])
                ORDER BY q.created_at DESC
                `,
                [questionnaireTabIds]
            );
            questionnaireDetails = rows;
        }

        res.json({
            data: {
                eventId: event.id,
                addInsEnabled: addIns,
                invitationTabs: normalizedTabs.sort((a, b) => a.sortOrder - b.sortOrder),
                addons: {
                    poll: {
                        enabled: pollAddonEnabled,
                        tabCount: pollTabIds.length,
                        polls: pollDetails
                    },
                    questionnaire: {
                        enabled: questionnaireAddonEnabled,
                        tabCount: questionnaireTabIds.length,
                        questionnaires: questionnaireDetails
                    },
                    instructions: {
                        enabled: instructionsAddonEnabled,
                        tabCount: instructionTabs.length,
                        instructions: instructionTabs.map((tab) => ({
                            id: tab.addonId,
                            title: tab.title || '',
                            title_ar: tab.titleAr || '',
                            instructions: safeJson(tab.instructions, {})
                        }))
                    }
                },
                lastUpdatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Failed to fetch event addons summary:', {
            eventId: req.params.id,
            message: error?.message || 'unknown',
            stack: error?.stack
        });
        next(error);
    }
});

// GET /api/admin/events/:id/guest-directory
router.get('/:id/guest-directory', requirePermission('events.view'), async (req, res, next) => {
    try {
        const eventId = req.params.id;
        if (!eventId) {
            throw new AppError('Event id is required', 400, 'VALIDATION_ERROR');
        }

        const { event, project } = await resolvePrimaryInvitationProject(pool, eventId);
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        const status = typeof req.query.status === 'string' ? req.query.status.trim() : 'active';
        const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
        const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize, 10) || 25, 1), 200);
        const offset = (page - 1) * pageSize;

        let whereClause = 'cg.client_id = $1';
        const params = [event.client_id];
        let paramIndex = 2;

        if (status !== 'all') {
            whereClause += ` AND cg.status = $${paramIndex}`;
            params.push(status);
            paramIndex += 1;
        }

        if (search) {
            whereClause += ` AND (
                cg.name ILIKE $${paramIndex}
                OR cg.email ILIKE $${paramIndex}
                OR cg.mobile_number ILIKE $${paramIndex}
                OR cg.organization ILIKE $${paramIndex}
            )`;
            params.push(`%${search}%`);
            paramIndex += 1;
        }

        const { rows: countRows } = await pool.query(
            `
            SELECT COUNT(*)::int AS total
            FROM client_guests cg
            WHERE ${whereClause}
            `,
            params
        );

        const total = countRows[0]?.total || 0;
        const { rows: guests } = await pool.query(
            `
            SELECT
                cg.id,
                cg.name,
                cg.position,
                cg.organization,
                cg.email,
                cg.mobile_number,
                cg.status,
                cg.gender,
                cg.created_at,
                ir.id AS recipient_id,
                ir.overall_status AS recipient_status
            FROM client_guests cg
            LEFT JOIN invitation_recipients ir
              ON ir.project_id = $${paramIndex}
             AND ir.client_guest_id = cg.id
            WHERE ${whereClause}
            ORDER BY cg.created_at DESC
            LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
            `,
            [...params, project.id, pageSize, offset]
        );

        res.json({
            data: guests.map((guest) => ({
                ...guest,
                is_assigned: Boolean(guest.recipient_id)
            })),
            pagination: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            },
            meta: {
                eventId: event.id,
                projectId: project.id
            }
        });
    } catch (error) {
        console.error('Failed to fetch event guest directory:', {
            eventId: req.params.id,
            message: error?.message || 'unknown',
            stack: error?.stack
        });
        next(error);
    }
});

// POST /api/admin/events/:id/guest-directory/assign
router.post('/:id/guest-directory/assign', requirePermission('events.edit'), async (req, res, next) => {
    const db = await pool.connect();
    try {
        const eventId = req.params.id;
        if (!eventId) {
            throw new AppError('Event id is required', 400, 'VALIDATION_ERROR');
        }

        const guestIds = normalizeGuestIdList(req.body?.guestIds);
        if (!guestIds.length) {
            throw new AppError('guestIds are required', 400, 'VALIDATION_ERROR');
        }

        await db.query('BEGIN');
        const { event, project } = await resolvePrimaryInvitationProject(db, eventId);

        const { rows: guests } = await db.query(
            `
            SELECT id, name, position, email, mobile_number
            FROM client_guests
            WHERE client_id = $1
              AND id = ANY($2::uuid[])
            `,
            [event.client_id, guestIds]
        );

        if (!guests.length) {
            throw new AppError('No matching guests found for this event client', 404, 'GUEST_NOT_FOUND');
        }

        const guestMap = new Map(guests.map((guest) => [guest.id, guest]));
        let createdCount = 0;
        let updatedCount = 0;

        for (const guestId of guestIds) {
            const guest = guestMap.get(guestId);
            if (!guest) {
                continue;
            }

            const { rows: existingRows } = await db.query(
                `
                SELECT id
                FROM invitation_recipients
                WHERE project_id = $1
                  AND client_guest_id = $2
                LIMIT 1
                `,
                [project.id, guest.id]
            );

            const metadata = guest.position ? { position: guest.position } : {};
            if (existingRows.length) {
                await db.query(
                    `
                    UPDATE invitation_recipients
                    SET
                        display_name = $1,
                        email = $2,
                        phone = $3,
                        metadata = $4::jsonb,
                        updated_at = NOW()
                    WHERE id = $5
                    `,
                    [
                        guest.name,
                        guest.email || null,
                        guest.mobile_number || null,
                        JSON.stringify(metadata),
                        existingRows[0].id
                    ]
                );
                updatedCount += 1;
                continue;
            }

            await db.query(
                `
                INSERT INTO invitation_recipients (
                    id,
                    project_id,
                    client_guest_id,
                    invite_code,
                    public_token,
                    display_name,
                    email,
                    phone,
                    preferred_language,
                    preferred_channel,
                    metadata,
                    overall_status
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, 'ar', 'all', $9::jsonb, 'draft'
                )
                `,
                [
                    uuidv4(),
                    project.id,
                    guest.id,
                    crypto.randomBytes(5).toString('hex').toUpperCase(),
                    crypto.randomBytes(24).toString('hex'),
                    guest.name,
                    guest.email || null,
                    guest.mobile_number || null,
                    JSON.stringify(metadata)
                ]
            );
            createdCount += 1;
        }

        await db.query('UPDATE invitation_projects SET updated_at = NOW() WHERE id = $1', [project.id]);
        await db.query('COMMIT');

        res.status(201).json({
            data: {
                eventId: event.id,
                projectId: project.id,
                requested: guestIds.length,
                created: createdCount,
                updated: updatedCount
            }
        });
    } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        console.error('Failed to assign event guests:', {
            eventId: req.params.id,
            message: error?.message || 'unknown',
            stack: error?.stack
        });
        next(error);
    } finally {
        db.release();
    }
});

// GET /api/admin/events/:id/questionnaire-summary
router.get('/:id/questionnaire-summary', requirePermission('events.view'), async (req, res, next) => {
    try {
        const eventId = req.params.id;
        if (!eventId) {
            throw new AppError('Event id is required', 400, 'VALIDATION_ERROR');
        }

        const { rows: eventRows } = await pool.query(
            `
            SELECT id, settings
            FROM events
            WHERE id = $1
            LIMIT 1
            `,
            [eventId]
        );

        if (!eventRows.length) {
            throw new AppError('Event not found', 404, 'NOT_FOUND');
        }

        const { rows: questionnaireRows } = await pool.query(
            `
            SELECT
                q.id,
                q.title,
                q.title_ar,
                q.status,
                q.start_date,
                q.end_date,
                q.updated_at,
                COALESCE((SELECT COUNT(*)::int FROM questionnaire_questions qq WHERE qq.questionnaire_id = q.id), 0) AS question_count,
                COALESCE((SELECT COUNT(*)::int FROM questionnaire_submissions qs WHERE qs.questionnaire_id = q.id), 0) AS submission_count
            FROM questionnaires q
            WHERE q.event_id = $1
            ORDER BY
                CASE WHEN q.status = 'published' THEN 0 WHEN q.status = 'draft' THEN 1 ELSE 2 END,
                q.updated_at DESC
            `,
            [eventId]
        );

        const now = Date.now();
        const activeCount = questionnaireRows.filter((row) => {
            if (row.status !== 'published') {
                return false;
            }
            const start = row.start_date ? new Date(row.start_date).getTime() : null;
            const end = row.end_date ? new Date(row.end_date).getTime() : null;
            const afterStart = start === null || Number.isNaN(start) || start <= now;
            const beforeEnd = end === null || Number.isNaN(end) || end >= now;
            return afterStart && beforeEnd;
        }).length;

        const totalSubmissions = questionnaireRows.reduce(
            (sum, row) => sum + (Number.parseInt(row.submission_count, 10) || 0),
            0
        );
        const totalQuestions = questionnaireRows.reduce(
            (sum, row) => sum + (Number.parseInt(row.question_count, 10) || 0),
            0
        );

        res.json({
            data: {
                eventId,
                totals: {
                    totalQuestionnaires: questionnaireRows.length,
                    activeQuestionnaires: activeCount,
                    totalQuestions,
                    totalSubmissions
                },
                questionnaires: questionnaireRows,
                lastUpdatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Failed to fetch event questionnaire summary:', {
            eventId: req.params.id,
            message: error?.message || 'unknown',
            stack: error?.stack
        });
        next(error);
    }
});

// GET /api/admin/events/:id/observation
router.get('/:id/observation', requirePermission('events.view'), async (req, res, next) => {
    try {
        const eventId = req.params.id;
        if (!eventId) {
            throw new AppError('Event id is required', 400, 'VALIDATION_ERROR');
        }

        const [invitationSummaryRes, attendanceSummaryRes, addonsSummaryRes, questionnaireSummaryRes, walkInSummaryRes] = await Promise.all([
            pool.query(
                `
                SELECT
                    COUNT(*)::int AS recipients,
                    COUNT(*) FILTER (WHERE overall_status = 'queued')::int AS queued,
                    COUNT(*) FILTER (WHERE overall_status = 'sent')::int AS sent,
                    COUNT(*) FILTER (WHERE overall_status = 'delivered')::int AS delivered,
                    COUNT(*) FILTER (WHERE overall_status = 'opened')::int AS opened,
                    COUNT(*) FILTER (WHERE overall_status = 'responded')::int AS responded,
                    COUNT(*) FILTER (WHERE overall_status = 'failed')::int AS failed
                FROM invitation_recipients r
                JOIN invitation_projects p ON p.id = r.project_id
                WHERE p.event_id = $1
                `,
                [eventId]
            ),
            pool.query(
                `
                SELECT
                    COUNT(*)::int AS invited_total,
                    COUNT(*) FILTER (WHERE COALESCE(r.metadata->>'attendance_status', r.metadata->>'check_in_status', '') IN ('attended', 'checked_in'))::int AS invited_checked_in,
                    COUNT(*) FILTER (WHERE COALESCE(r.metadata->>'attendance_status', r.metadata->>'check_in_status', '') NOT IN ('attended', 'checked_in'))::int AS invited_pending
                FROM invitation_recipients r
                JOIN invitation_projects p ON p.id = r.project_id
                WHERE p.event_id = $1
                `,
                [eventId]
            ),
            pool.query(
                `
                SELECT settings
                FROM events
                WHERE id = $1
                LIMIT 1
                `,
                [eventId]
            ),
            pool.query(
                `
                SELECT
                    COUNT(*)::int AS total_questionnaires,
                    COUNT(*) FILTER (WHERE status = 'published')::int AS active_questionnaires,
                    COALESCE(SUM((SELECT COUNT(*)::int FROM questionnaire_submissions qs WHERE qs.questionnaire_id = q.id)), 0)::int AS submissions_total
                FROM questionnaires q
                WHERE q.event_id = $1
                `,
                [eventId]
            ),
            pool.query(
                `
                SELECT
                    COUNT(*)::int AS walk_in_total,
                    COUNT(*) FILTER (WHERE check_in_status = 'checked_in')::int AS walk_in_checked_in
                FROM event_walk_ins
                WHERE event_id = $1
                `,
                [eventId]
            )
        ]);

        const invitationSummary = invitationSummaryRes.rows[0] || {};
        const attendanceSummary = attendanceSummaryRes.rows[0] || {};
        const walkInSummary = walkInSummaryRes.rows[0] || { walk_in_total: 0, walk_in_checked_in: 0 };
        const eventSettings = safeJson(addonsSummaryRes.rows[0]?.settings, {});
        const invitationSetup = safeJson(eventSettings.invitation_setup, {});
        const tabs = Array.isArray(invitationSetup.tabs) ? invitationSetup.tabs : [];

        const { rows: pollStatsRows } = await pool.query(
            `
            SELECT
                COUNT(DISTINCT p.id)::int AS total_polls,
                COUNT(v.id)::int AS total_votes
            FROM polls p
            LEFT JOIN poll_votes v ON v.poll_id = p.id
            WHERE p.event_id = $1
            `,
            [eventId]
        );

        const { rows: rsvpStatsRows } = await pool.query(
            `
            SELECT
                COUNT(*)::int AS total_submissions,
                COUNT(*) FILTER (WHERE LOWER(COALESCE(ir.response_data->>'attendance', '')) = 'attending')::int AS attending_count,
                COUNT(*) FILTER (WHERE LOWER(COALESCE(ir.response_data->>'attendance', '')) = 'not_attending')::int AS not_attending_count,
                COUNT(*) FILTER (WHERE LOWER(COALESCE(ir.response_data->>'attendance', '')) = 'maybe')::int AS maybe_count
            FROM invitation_module_responses ir
            JOIN invitation_projects p ON p.id = ir.project_id
            JOIN invitation_modules m ON m.id = ir.module_id AND m.module_type = 'rsvp'
            WHERE p.event_id = $1
            `,
            [eventId]
        );

        const { rows: recentActivityRows } = await pool.query(
            `
            SELECT
                ie.id,
                ie.event_type,
                ie.event_name,
                ie.event_data,
                ie.created_at,
                r.display_name,
                r.display_name_ar,
                r.email
            FROM invitation_events ie
            JOIN invitation_projects p ON p.id = ie.project_id
            LEFT JOIN invitation_recipients r ON r.id = ie.recipient_id
            WHERE p.event_id = $1
            ORDER BY ie.created_at DESC
            LIMIT 50
            `,
            [eventId]
        );

        const { rows: checkedInRows } = await pool.query(
            `
            SELECT
                r.id AS recipient_id,
                r.display_name,
                r.display_name_ar,
                r.email,
                r.phone,
                r.last_opened_at,
                r.responded_at
            FROM invitation_recipients r
            JOIN invitation_projects p ON p.id = r.project_id
            WHERE p.event_id = $1
              AND COALESCE(r.metadata->>'attendance_status', r.metadata->>'check_in_status', '') IN ('attended', 'checked_in')
            ORDER BY COALESCE(r.responded_at, r.last_opened_at, r.created_at) DESC
            LIMIT 200
            `,
            [eventId]
        );

        const { rows: walkInRows } = await pool.query(
            `
            SELECT
                wi.id AS walk_in_id,
                wi.client_guest_id,
                wi.checked_in_at,
                cg.name AS display_name,
                cg.email,
                cg.mobile_number AS phone,
                cg.organization,
                cg.position
            FROM event_walk_ins wi
            JOIN client_guests cg ON cg.id = wi.client_guest_id
            WHERE wi.event_id = $1
            ORDER BY wi.checked_in_at DESC, wi.created_at DESC
            LIMIT 200
            `,
            [eventId]
        );

        res.json({
            data: {
                generatedAt: new Date().toISOString(),
                invitation: invitationSummary,
                attendance: attendanceSummary,
                walkIns: walkInSummary,
                addons: {
                    enabledCount: Array.isArray(invitationSetup.addIns) ? invitationSetup.addIns.length : 0,
                    linkedTabsCount: tabs.length,
                    tabs
                },
                rsvp: rsvpStatsRows[0] || {},
                poll: pollStatsRows[0] || { total_polls: 0, total_votes: 0 },
                questionnaire: questionnaireSummaryRes.rows[0] || { total_questionnaires: 0, active_questionnaires: 0, submissions_total: 0 },
                checkedInGuests: checkedInRows,
                walkInGuests: walkInRows,
                recentActivity: recentActivityRows
            }
        });
    } catch (error) {
        console.error('Failed to build event observation payload:', {
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
