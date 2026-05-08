import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import pool from '../db/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { enqueueEmailDeliveries, processEmailDeliveryQueue } from '../services/delivery.js';
import { buildInvitationEmailContent, getPublicInvitationBaseUrl } from '../services/resend.js';

const router = Router();
router.use(authenticate);

const PROJECT_STATUSES = new Set(['draft', 'active', 'paused', 'archived', 'completed']);
const PAGE_TYPES = new Set(['cover', 'rsvp', 'poll', 'questionnaire', 'quiz', 'competition', 'terms', 'custom']);
const CHANNELS = new Set(['email', 'whatsapp', 'sms', 'all']);
const LANGUAGES = new Set(['ar', 'en']);

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

function normalizeLanguage(language, fallback = 'ar') {
    const normalizedFallback = LANGUAGES.has(fallback) ? fallback : 'ar';
    const text = normalizeText(language).toLowerCase();
    if (!text) {
        return normalizedFallback;
    }

    if (LANGUAGES.has(text)) {
        return text;
    }

    return normalizedFallback;
}

function toInt(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

function generateInviteCode() {
    return `RWJ-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function generatePublicToken() {
    return crypto.randomBytes(24).toString('hex');
}

function generateSessionToken() {
    return crypto.randomBytes(24).toString('hex');
}

function normalizeFieldOptions(options) {
    if (Array.isArray(options)) {
        return options;
    }

    return [];
}

function shapeModuleField(field) {
    return {
        id: field.id,
        field_key: field.field_key,
        field_type: field.field_type,
        label: field.label,
        label_ar: field.label_ar,
        placeholder: field.placeholder,
        placeholder_ar: field.placeholder_ar,
        help_text: field.help_text,
        help_text_ar: field.help_text_ar,
        required: field.required,
        sort_order: field.sort_order,
        options: safeJson(field.options, []),
        validation: safeJson(field.validation, {}),
        correct_answer: safeJson(field.correct_answer, null),
        points: field.points || 0,
        branch_logic: safeJson(field.branch_logic, [])
    };
}

function shapeModule(module, fields = []) {
    return {
        id: module.id,
        page_id: module.page_id,
        module_key: module.module_key,
        module_type: module.module_type,
        title: module.title,
        title_ar: module.title_ar,
        description: module.description,
        description_ar: module.description_ar,
        settings: safeJson(module.settings, {}),
        rules: safeJson(module.rules, []),
        sort_order: module.sort_order,
        is_enabled: module.is_enabled,
        fields: fields.map(shapeModuleField)
    };
}

function shapePollSnapshot(poll, options = [], stats = {}) {
    const totalVotes = Number(stats.total_votes ?? options.reduce((sum, option) => sum + Number(option.votes_count || 0), 0)) || 0;
    const participantsCount = Number(stats.participants_count ?? 0) || 0;

    return {
        type: 'poll',
        poll_id: poll.id,
        title: poll.title,
        title_ar: poll.title_ar || '',
        subtitle: poll.subtitle || '',
        subtitle_ar: poll.subtitle_ar || '',
        description: poll.description || '',
        description_ar: poll.description_ar || '',
        cover_image_path: poll.cover_image_path || '',
        theme_settings: safeJson(poll.theme_settings, {}),
        layout_settings: safeJson(poll.layout_settings, {}),
        status: poll.status,
        poll_mode: poll.poll_mode,
        allow_multiple_choice: poll.allow_multiple_choice,
        require_login: poll.require_login,
        start_date: poll.start_date,
        end_date: poll.end_date,
        max_votes_per_user: poll.max_votes_per_user,
        show_results_mode: poll.show_results_mode,
        total_votes: totalVotes,
        participants_count: participantsCount,
        options: options.map((option) => ({
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
    };
}

async function fetchPollRuntimeState(db, pollId, clientId, eventId) {
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
        return null;
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

    const { rows: voteStats } = await db.query(
        `
        SELECT
            COUNT(*)::int AS total_votes,
            COUNT(DISTINCT COALESCE(guest_id::text, session_id))::int AS participants_count
        FROM poll_votes
        WHERE poll_id = $1
        `,
        [pollId]
    );

    return {
        poll: polls[0],
        options,
        stats: voteStats[0] || { total_votes: 0, participants_count: 0 }
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

async function loadCoverTemplatePayload(db, templateId) {
    if (!templateId) {
        return { snapshot: null, hash: null };
    }

    const { rows: templates } = await db.query('SELECT design_data FROM templates WHERE id = $1', [templateId]);
    if (!templates.length) {
        throw new AppError('Cover template not found', 404, 'NOT_FOUND');
    }

    const snapshot = templates[0].design_data;
    return {
        snapshot,
        hash: computeDesignDataHash(snapshot)
    };
}

export async function createDefaultRsvpModule(db, page) {
    if (page.page_type !== 'rsvp') {
        return null;
    }

    const moduleKey = `${page.page_key}-module`;
    const { rows: existing } = await db.query(
        'SELECT * FROM invitation_modules WHERE page_id = $1 AND module_key = $2 LIMIT 1',
        [page.id, moduleKey]
    );

    if (existing.length) {
        const { rows: fields } = await db.query(
            `SELECT * FROM invitation_module_fields WHERE module_id = $1 ORDER BY sort_order ASC, created_at ASC`,
            [existing[0].id]
        );

        return { ...existing[0], fields };
    }

    const moduleId = uuidv4();
    await db.query(
        `
        INSERT INTO invitation_modules (
            id,
            page_id,
            module_key,
            module_type,
            title,
            title_ar,
            description,
            description_ar,
            settings,
            rules,
            sort_order,
            is_enabled
        )
        VALUES ($1, $2, $3, 'rsvp', $4, $5, $6, $7, $8, $9, $10, TRUE)
        `,
        [
            moduleId,
            page.id,
            moduleKey,
            'RSVP',
            'تأكيد الحضور',
            'Please confirm whether you will attend.',
            'يرجى تأكيد الحضور',
            JSON.stringify({
                source: 'system',
                mode: 'built_in_rsvp'
            }),
            JSON.stringify([]),
            0
        ]
    );

    const fields = [
        {
            fieldKey: 'attendance',
            fieldType: 'single_choice',
            label: 'Attendance',
            labelAr: 'الحضور',
            placeholder: null,
            placeholderAr: null,
            helpText: 'Choose whether you will attend the event.',
            helpTextAr: 'اختر ما إذا كنت ستتمكن من الحضور.',
            required: true,
            sortOrder: 0,
            options: [
                { value: 'attending', label: 'Attending', label_ar: 'سأحضر' },
                { value: 'not_attending', label: 'Not attending', label_ar: 'لن أحضر' },
                { value: 'maybe', label: 'Maybe', label_ar: 'ربما' }
            ],
            validation: { required: true },
            correctAnswer: null,
            points: 0,
            branchLogic: []
        },
        {
            fieldKey: 'guest_count',
            fieldType: 'number',
            label: 'Guest count',
            labelAr: 'عدد الضيوف',
            placeholder: '0',
            placeholderAr: '٠',
            helpText: 'Number of guests attending with the invitee.',
            helpTextAr: 'عدد الضيوف المرافقين للمدعو.',
            required: false,
            sortOrder: 1,
            options: [],
            validation: { min: 0, max: 20 },
            correctAnswer: null,
            points: 0,
            branchLogic: []
        },
        {
            fieldKey: 'notes',
            fieldType: 'long_text',
            label: 'Notes',
            labelAr: 'ملاحظات',
            placeholder: 'Write any notes here',
            placeholderAr: 'اكتب أي ملاحظات هنا',
            helpText: 'Optional comments for the host.',
            helpTextAr: 'تعليقات اختيارية للمضيف.',
            required: false,
            sortOrder: 2,
            options: [],
            validation: { maxLength: 500 },
            correctAnswer: null,
            points: 0,
            branchLogic: []
        }
    ];

    for (const field of fields) {
        await db.query(
            `
            INSERT INTO invitation_module_fields (
                id,
                module_id,
                field_key,
                field_type,
                label,
                label_ar,
                placeholder,
                placeholder_ar,
                help_text,
                help_text_ar,
                required,
                sort_order,
                options,
                validation,
                correct_answer,
                points,
                branch_logic
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
            )
            `,
            [
                uuidv4(),
                moduleId,
                field.fieldKey,
                field.fieldType,
                field.label,
                field.labelAr,
                field.placeholder,
                field.placeholderAr,
                field.helpText,
                field.helpTextAr,
                field.required,
                field.sortOrder,
                JSON.stringify(normalizeFieldOptions(field.options)),
                JSON.stringify(field.validation || {}),
                field.correctAnswer === undefined ? null : JSON.stringify(field.correctAnswer),
                field.points || 0,
                JSON.stringify(field.branchLogic || [])
            ]
        );
    }

    const { rows: created } = await db.query(
        `
        SELECT m.*
        FROM invitation_modules m
        WHERE m.id = $1
        `,
        [moduleId]
    );

    const { rows: createdFields } = await db.query(
        `SELECT * FROM invitation_module_fields WHERE module_id = $1 ORDER BY sort_order ASC, created_at ASC`,
        [moduleId]
    );

    return { ...created[0], fields: createdFields };
}

async function fetchProjectSummary(projectId, db = pool) {
    const { rows } = await db.query(
        `
        SELECT
            COUNT(*)::int AS recipient_count,
            COUNT(*) FILTER (WHERE overall_status = 'sent')::int AS sent_count,
            COUNT(*) FILTER (WHERE overall_status = 'delivered')::int AS delivered_count,
            COUNT(*) FILTER (WHERE overall_status = 'opened')::int AS opened_count,
            COUNT(*) FILTER (WHERE overall_status = 'responded')::int AS responded_count,
            COUNT(*) FILTER (WHERE overall_status = 'failed')::int AS failed_count
        FROM invitation_recipients
        WHERE project_id = $1
        `,
        [projectId]
    );

    const { rows: pageRows } = await db.query(
        `SELECT COUNT(*)::int AS page_count FROM invitation_project_pages WHERE project_id = $1`,
        [projectId]
    );

    const { rows: moduleRows } = await db.query(
        `
        SELECT COUNT(*)::int AS module_count
        FROM invitation_project_pages p
        JOIN invitation_modules m ON m.page_id = p.id
        WHERE p.project_id = $1
        `,
        [projectId]
    );

    return {
        ...(rows[0] || {}),
        page_count: pageRows[0]?.page_count || 0,
        module_count: moduleRows[0]?.module_count || 0
    };
}

async function fetchProjectWithContext(projectId, db = pool) {
        const { rows: projects } = await db.query(
        `
        SELECT
            p.*,
            c.name AS client_name,
            c.name_ar AS client_name_ar,
            c.email AS client_email,
            e.name AS event_name,
            e.name_ar AS event_name_ar,
            e.template_id AS event_template_id,
            et.name AS event_template_name,
            et.design_data AS event_template_design_data,
            e.start_datetime AS event_start_datetime,
            e.end_datetime AS event_end_datetime,
            t.name AS cover_template_name
        FROM invitation_projects p
        JOIN clients c ON c.id = p.client_id
        JOIN events e ON e.id = p.event_id
        LEFT JOIN templates et ON et.id = e.template_id
        LEFT JOIN templates t ON t.id = p.cover_template_id
        WHERE p.id = $1
        `,
        [projectId]
    );

    if (!projects.length) {
        throw new AppError('Invitation project not found', 404, 'NOT_FOUND');
    }

    const project = projects[0];
    project.cover_template_hash = computeDesignDataHash(project.cover_template_snapshot);
    project.event_template_hash = computeDesignDataHash(project.event_template_design_data);
    const summary = await fetchProjectSummary(projectId, db);

    const { rows: pages } = await db.query(
        `
        SELECT
            p.*,
            COALESCE((SELECT COUNT(*)::int FROM invitation_modules m WHERE m.page_id = p.id), 0) AS module_count
        FROM invitation_project_pages p
        WHERE p.project_id = $1
        ORDER BY p.sort_order ASC, p.created_at ASC
        `,
        [projectId]
    );

    return { project, summary, pages };
}

function buildRecipientSnapshot(recipient) {
    return {
        id: recipient.id,
        project_id: recipient.project_id,
        guest_id: recipient.guest_id || null,
        client_guest_id: recipient.client_guest_id || null,
        invite_code: recipient.invite_code || null,
        public_token: recipient.public_token || null,
        display_name: recipient.display_name || '',
        display_name_ar: recipient.display_name_ar || '',
        email: recipient.email || '',
        phone: recipient.phone || '',
        whatsapp_number: recipient.whatsapp_number || '',
        preferred_language: recipient.preferred_language || 'ar',
        preferred_channel: recipient.preferred_channel || 'all',
        overall_status: recipient.overall_status || 'draft',
        invited_at: recipient.invited_at || null,
        first_opened_at: recipient.first_opened_at || null,
        last_opened_at: recipient.last_opened_at || null,
        responded_at: recipient.responded_at || null,
        metadata: safeJson(recipient.metadata, {})
    };
}

async function buildInvitationProjectSnapshot(db, projectId) {
    const { project } = await fetchProjectWithContext(projectId, db);

    const { rows: pageRows } = await db.query(
        `
        SELECT
            p.*,
            COALESCE((SELECT COUNT(*)::int FROM invitation_modules m WHERE m.page_id = p.id), 0) AS module_count
        FROM invitation_project_pages p
        WHERE p.project_id = $1
        ORDER BY p.sort_order ASC, p.created_at ASC
        `,
        [projectId]
    );

    const { rows: moduleRows } = await db.query(
        `
        SELECT
            m.*,
            p.page_key,
            p.page_type
        FROM invitation_modules m
        JOIN invitation_project_pages p ON p.id = m.page_id
        WHERE p.project_id = $1
        ORDER BY p.sort_order ASC, m.sort_order ASC, m.created_at ASC
        `,
        [projectId]
    );

    const moduleIds = moduleRows.map((module) => module.id);
    let fieldRows = [];

    if (moduleIds.length) {
        const { rows } = await db.query(
            `
            SELECT *
            FROM invitation_module_fields
            WHERE module_id = ANY($1::uuid[])
            ORDER BY sort_order ASC, created_at ASC
            `,
            [moduleIds]
        );
        fieldRows = rows;
    }

    const fieldsByModuleId = new Map();
    for (const field of fieldRows) {
        if (!fieldsByModuleId.has(field.module_id)) {
            fieldsByModuleId.set(field.module_id, []);
        }
        fieldsByModuleId.get(field.module_id).push(field);
    }

    const modulesByPageId = new Map();
    for (const module of moduleRows) {
        const fields = fieldsByModuleId.get(module.id) || [];
        if (!modulesByPageId.has(module.page_id)) {
            modulesByPageId.set(module.page_id, []);
        }
        modulesByPageId.get(module.page_id).push(shapeModule(module, fields));
    }

    const pages = pageRows.map((page) => ({
        id: page.id,
        project_id: page.project_id,
        page_key: page.page_key,
        page_type: page.page_type,
        title: page.title,
        title_ar: page.title_ar,
        description: page.description,
        description_ar: page.description_ar,
        sort_order: page.sort_order,
        is_enabled: page.is_enabled,
        settings: safeJson(page.settings, {}),
        module_count: page.module_count || 0,
        modules: modulesByPageId.get(page.id) || []
    }));

    for (const page of pages) {
        const settings = safeJson(page.settings, {});
        const snapshot = safeJson(settings.addon_snapshot || settings.poll_snapshot, null);
        if (!snapshot || snapshot.type !== 'poll' || !snapshot.poll_id) {
            continue;
        }

        const runtime = await fetchPollRuntimeState(db, snapshot.poll_id, project.client_id, project.event_id);
        if (!runtime) {
            continue;
        }

        const liveSnapshot = shapePollSnapshot(runtime.poll, runtime.options, runtime.stats);
        page.settings = {
            ...settings,
            addon_snapshot: liveSnapshot,
            poll_snapshot: liveSnapshot
        };
    }

    const projectSnapshot = {
        id: project.id,
        client_id: project.client_id,
        event_id: project.event_id,
        name: project.name,
        name_ar: project.name_ar,
        description: project.description,
        description_ar: project.description_ar,
        status: project.status,
        default_language: project.default_language,
        settings: safeJson(project.settings, {}),
        cover_template_id: project.cover_template_id,
        cover_template_hash: project.cover_template_hash || computeDesignDataHash(project.cover_template_snapshot),
        cover_template_snapshot: safeJson(project.cover_template_snapshot, null),
        client: {
            id: project.client_id,
            name: project.client_name,
            name_ar: project.client_name_ar,
            email: project.client_email
        },
        event: {
            id: project.event_id,
            name: project.event_name,
            name_ar: project.event_name_ar,
            start_datetime: project.event_start_datetime,
            end_datetime: project.event_end_datetime,
            venue: project.venue,
            venue_ar: project.venue_ar
        },
        cover_template: project.cover_template_id
            ? {
                id: project.cover_template_id,
                name: project.cover_template_name,
                name_ar: project.cover_template_name_ar,
                design_data: safeJson(project.cover_template_snapshot, null)
            }
            : null
    };

    return {
        version: 1,
        captured_at: new Date().toISOString(),
        project: projectSnapshot,
        pages,
        hash: computeDesignDataHash({
            project: projectSnapshot,
            pages
        })
    };
}

async function buildAddonPagesFromEventSetup(db, projectId, clientId, eventId, invitationSetup = {}) {
    const tabs = Array.isArray(invitationSetup.tabs) ? invitationSetup.tabs : [];
    let sortOrder = 2;

    for (const tab of tabs) {
        const type = typeof tab?.type === 'string' ? tab.type.trim() : '';
        const addonId = typeof tab?.addon_id === 'string' ? tab.addon_id.trim() : typeof tab?.addonId === 'string' ? tab.addonId.trim() : '';

        if (!type || !addonId || !PAGE_TYPES.has(type)) {
            continue;
        }

        const pageId = uuidv4();
        const pageKey = `${type}-${addonId.slice(0, 8)}-${sortOrder}`;

        let title = typeof tab?.title === 'string' ? tab.title.trim() : '';
        let titleAr = typeof tab?.title_ar === 'string' ? tab.title_ar.trim() : typeof tab?.titleAr === 'string' ? tab.titleAr.trim() : '';
        let description = '';
        let descriptionAr = '';
        let settings = {
            source: 'event_invitation_setup',
            addon_type: type,
            addon_id: addonId
        };

        if (type === 'poll') {
            const { rows: polls } = await db.query(
                `
                SELECT p.*
                FROM polls p
                WHERE p.id = $1
                  AND p.client_id = $2
                  AND p.event_id = $3
                LIMIT 1
                `,
                [addonId, clientId, eventId]
            );

            if (!polls.length) {
                console.warn('[invitationProjects] Skipping missing poll addon during project creation', {
                    projectId,
                    eventId,
                    addonId
                });
                continue;
            }

            const poll = polls[0];
            const { rows: options } = await db.query(
                `
                SELECT *
                FROM poll_options
                WHERE poll_id = $1
                ORDER BY sort_order ASC, created_at ASC
                `,
                [poll.id]
            );

            title = title || poll.title;
            titleAr = titleAr || poll.title_ar || '';
            description = poll.subtitle || '';
            descriptionAr = poll.subtitle_ar || '';
            settings = {
                ...settings,
                addon_snapshot: {
                    type: 'poll',
                    poll_id: poll.id,
                    title: poll.title,
                    title_ar: poll.title_ar || '',
                    subtitle: poll.subtitle || '',
                    subtitle_ar: poll.subtitle_ar || '',
                    description: poll.description || '',
                    description_ar: poll.description_ar || '',
                    cover_image_path: poll.cover_image_path || '',
                    theme_settings: poll.theme_settings || {},
                    layout_settings: poll.layout_settings || {},
                    status: poll.status,
                    poll_mode: poll.poll_mode,
                    allow_multiple_choice: poll.allow_multiple_choice,
                    require_login: poll.require_login,
                    start_date: poll.start_date,
                    end_date: poll.end_date,
                    max_votes_per_user: poll.max_votes_per_user,
                    show_results_mode: poll.show_results_mode,
                    options: options.map((option) => ({
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
            };
        } else if (type === 'questionnaire') {
            const { rows: questionnaires } = await db.query(
                `
                SELECT *
                FROM questionnaires
                WHERE id = $1
                  AND client_id = $2
                  AND event_id = $3
                LIMIT 1
                `,
                [addonId, clientId, eventId]
            );

            if (!questionnaires.length) {
                console.warn('[invitationProjects] Skipping missing questionnaire addon during project creation', {
                    projectId,
                    eventId,
                    addonId
                });
                continue;
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
            const questionIds = questions.map((question) => question.id);
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

            title = title || questionnaire.title;
            titleAr = titleAr || questionnaire.title_ar || '';
            description = questionnaire.description || '';
            descriptionAr = questionnaire.description_ar || '';
            settings = {
                ...settings,
                addon_snapshot: {
                    type: 'questionnaire',
                    questionnaire_id: questionnaire.id,
                    title: questionnaire.title,
                    title_ar: questionnaire.title_ar || '',
                    description: questionnaire.description || '',
                    description_ar: questionnaire.description_ar || '',
                    status: questionnaire.status,
                    start_date: questionnaire.start_date,
                    end_date: questionnaire.end_date,
                    settings: safeJson(questionnaire.settings, {}),
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
                }
            };
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
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10)
            `,
            [
                pageId,
                projectId,
                pageKey,
                type,
                title || type,
                titleAr || null,
                description || null,
                descriptionAr || null,
                sortOrder,
                JSON.stringify(settings)
            ]
        );

        sortOrder += 1;
    }
}

function normalizeRecipientIdList(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return Array.from(
        new Set(
            value
                .map((recipientId) => (typeof recipientId === 'string' ? recipientId.trim() : String(recipientId ?? '').trim()))
                .filter(Boolean)
        )
    );
}

function classifyEmailRecipient(recipient, requestedRecipientIds = []) {
    const preferredChannel = normalizeText(recipient.preferred_channel || 'all') || 'all';
    const overallStatus = normalizeText(recipient.overall_status || 'draft') || 'draft';
    const email = normalizeText(recipient.email || '');
    const recipientEmail = normalizeText(recipient.recipient_email || '');
    const clientGuestEmail = normalizeText(recipient.client_guest_email || '');
    const emailSource = email ? (recipientEmail ? 'recipient' : 'client_guest') : 'none';
    const reasons = [];

    const selectedByRule = requestedRecipientIds.length
        ? requestedRecipientIds.includes(recipient.id)
        : ['email', 'all'].includes(preferredChannel);

    if (!requestedRecipientIds.length && !selectedByRule) {
        reasons.push('channel_not_email');
    }

    if (requestedRecipientIds.length && !selectedByRule) {
        reasons.push('not_requested');
    }

    if (!email) {
        reasons.push('missing_email');
    }

    if (overallStatus === 'opted_out' || overallStatus === 'bounced') {
        reasons.push(`status_${overallStatus}`);
    }

    return {
        ...recipient,
        email,
        preferred_channel: preferredChannel,
        overall_status: overallStatus,
        email_source: emailSource,
        recipient_email: recipientEmail,
        client_guest_email: clientGuestEmail,
        selected_by_rule: selectedByRule,
        sendable: selectedByRule && reasons.length === 0,
        reasons
    };
}

async function buildInvitationEmailSendContext(db, projectId, requestedRecipientIds = []) {
    const normalizedRecipientIds = normalizeRecipientIdList(requestedRecipientIds);

    const { rows: projectRows } = await db.query(
        `
        SELECT
            p.id,
            p.name,
            p.name_ar,
            p.default_language,
            p.status,
            c.name AS client_name,
            c.name_ar AS client_name_ar,
            e.name AS event_name,
            e.name_ar AS event_name_ar,
            e.start_datetime,
            e.end_datetime,
            e.venue,
            e.venue_ar
        FROM invitation_projects p
        JOIN clients c ON c.id = p.client_id
        JOIN events e ON e.id = p.event_id
        WHERE p.id = $1
        LIMIT 1
        `,
        [projectId]
    );

    if (!projectRows.length) {
        throw new AppError('Invitation project not found', 404, 'NOT_FOUND');
    }

    const project = projectRows[0];
    const { rows: recipients } = await db.query(
        `
        SELECT
            r.id,
            r.project_id,
            r.client_guest_id,
            r.display_name,
            r.display_name_ar,
            r.email AS recipient_email,
            cg.email AS client_guest_email,
            COALESCE(NULLIF(r.email, ''), cg.email) AS email,
            r.preferred_language,
            r.preferred_channel,
            r.public_token,
            r.overall_status,
            r.metadata
        FROM invitation_recipients r
        LEFT JOIN client_guests cg ON cg.id = r.client_guest_id
        WHERE r.project_id = $1
        ORDER BY r.created_at ASC
        `,
        [projectId]
    );

    const classifiedRecipients = recipients.map((recipient) => classifyEmailRecipient(recipient, normalizedRecipientIds));
    const sendableRecipients = classifiedRecipients.filter((recipient) => recipient.sendable);
    const selectedRecipients = classifiedRecipients.filter((recipient) => recipient.selected_by_rule);
    const skippedRecipients = classifiedRecipients.filter((recipient) => !recipient.sendable);

    const emailPreviews = sendableRecipients.slice(0, 3).map((recipient) => {
        const publicLink = `${getPublicInvitationBaseUrl()}/invite/${recipient.public_token}`;
        const language = recipient.preferred_language || project.default_language || 'ar';
        const preview = buildInvitationEmailContent({
            project,
            recipient,
            publicLink,
            language
        });

        return {
            recipientId: recipient.id,
            to: recipient.email,
            language,
            publicLink,
            subject: preview.subject,
            text: preview.text,
            html: preview.html
        };
    });

    return {
        project,
        recipients: classifiedRecipients,
        selectedRecipients,
        sendableRecipients,
        skippedRecipients,
        emailPreviews,
        selection: {
            mode: normalizedRecipientIds.length ? 'explicit_recipient_ids' : 'email_channel',
            requestedRecipientIds: normalizedRecipientIds,
            totalRecipients: classifiedRecipients.length,
            selectedRecipients: selectedRecipients.length,
            sendableRecipients: sendableRecipients.length,
            skippedRecipients: skippedRecipients.length
        },
        environment: {
            resendApiKeyConfigured: Boolean(normalizeText(process.env.RESEND_API_KEY)),
            resendFromEmailConfigured: Boolean(normalizeText(process.env.RESEND_FROM_EMAIL)),
            publicInvitationBaseUrl: getPublicInvitationBaseUrl()
        }
    };
}

export async function executeInvitationEmailSend({
    projectId,
    requestedRecipientIds = [],
    scheduledFor = null,
    trace = false,
    createdBy = null
}) {
    const debugContext = await buildInvitationEmailSendContext(
        pool,
        projectId,
        requestedRecipientIds
    );

    const { sendableRecipients } = debugContext;

    if (!sendableRecipients.length) {
        throw new AppError('No email recipients are available for sending', 404, 'NO_EMAIL_RECIPIENTS');
    }

    const db = await pool.connect();
    let jobs = [];
    let committed = false;

    try {
        await db.query('BEGIN');
        const projectSnapshot = await buildInvitationProjectSnapshot(db, projectId);

        const recipientIds = sendableRecipients.map((recipient) => recipient.id);
        if (recipientIds.length) {
            const snapshotCapturedAt = projectSnapshot.captured_at || new Date().toISOString();
            const snapshotEnvelopeRows = sendableRecipients.map((recipient) => {
                const language = normalizeLanguage(recipient.preferred_language, projectSnapshot.project.default_language || 'ar');
                const recipientSnapshot = buildRecipientSnapshot(recipient);
                const snapshotEnvelope = {
                    version: projectSnapshot.version,
                    captured_at: snapshotCapturedAt,
                    language,
                    recipient: recipientSnapshot,
                    project: projectSnapshot.project,
                    pages: projectSnapshot.pages,
                    project_snapshot_hash: projectSnapshot.hash
                };

                return {
                    recipientId: recipient.id,
                    snapshotEnvelope,
                    snapshotHash: computeDesignDataHash(snapshotEnvelope),
                    language,
                    snapshotCapturedAt
                };
            });

            for (const row of snapshotEnvelopeRows) {
                await db.query(
                    `
                    UPDATE invitation_recipients
                    SET
                        invitation_snapshot = $1::jsonb,
                        invitation_snapshot_hash = $2,
                        invitation_snapshot_at = $3,
                        updated_at = NOW()
                    WHERE id = $4
                    `,
                    [
                        JSON.stringify(row.snapshotEnvelope),
                        row.snapshotHash,
                        row.snapshotCapturedAt,
                        row.recipientId
                    ]
                );
            }
        }

        jobs = await enqueueEmailDeliveries({
            db,
            project: projectSnapshot.project,
            recipients: sendableRecipients,
            scheduledFor,
            createdBy
        });

        await db.query('COMMIT');
        committed = true;
    } catch (error) {
        if (!committed) {
            await db.query('ROLLBACK').catch(() => {});
        }
        throw error;
    } finally {
        db.release();
    }

    const shouldProcessNow = !scheduledFor || scheduledFor.getTime() <= Date.now();
    const processingResult = shouldProcessNow
        ? await processEmailDeliveryQueue({ jobIds: jobs.map((job) => job.id), limit: jobs.length, trace })
        : null;

    const queuedCount = jobs.length - (processingResult?.claimed || 0);
    const sentCount = processingResult?.sent || 0;
    const failedCount = processingResult?.failed || 0;
    const retryScheduled = processingResult?.retryScheduled || 0;

    return {
        debug: debugContext,
        summary: {
            total: jobs.length,
            queued: queuedCount,
            sent: sentCount,
            failed: failedCount,
            retryScheduled
        },
        jobs,
        processed: processingResult?.jobs || [],
        trace: trace ? {
            scheduledFor: scheduledFor ? scheduledFor.toISOString() : null,
            shouldProcessNow,
            enqueuedJobs: jobs.map((job) => ({
                jobId: job.id,
                recipientId: job.recipientId,
                email: job.email,
                scheduledFor: job.scheduledFor
            })),
            processing: processingResult || null
        } : undefined
    };
}

async function upsertInvitationRecipient(db, projectId, recipient) {
    const position = typeof recipient.position === 'string'
        ? recipient.position.trim()
        : typeof recipient.position === 'number'
            ? String(recipient.position).trim()
            : typeof recipient.metadata?.position === 'string'
                ? recipient.metadata.position.trim()
                : typeof recipient.metadata?.guestPosition === 'string'
                    ? recipient.metadata.guestPosition.trim()
                    : '';

    const normalized = {
        clientGuestId: recipient.clientGuestId || recipient.client_guest_id || recipient.guestId || recipient.guest_id || null,
        legacyGuestId: recipient.guestId || recipient.guest_id || null,
        displayName: recipient.displayName || recipient.display_name || '',
        displayNameAr: recipient.displayNameAr || recipient.display_name_ar || '',
        email: recipient.email || '',
        phone: recipient.phone || '',
        whatsappNumber: recipient.whatsappNumber || recipient.whatsapp_number || '',
        preferredLanguage: recipient.preferredLanguage || recipient.preferred_language || 'ar',
        preferredChannel: recipient.preferredChannel || recipient.preferred_channel || 'all',
        metadata: safeJson(recipient.metadata, {})
    };

    if (position) {
        normalized.metadata.position = position;
    } else {
        delete normalized.metadata.position;
    }

    if (normalized.clientGuestId) {
        const { rows: guests } = await db.query(
            `
            SELECT g.id, g.name, g.position, g.email, g.mobile_number
            FROM client_guests g
            JOIN invitation_projects p ON p.id = $1 AND p.client_id = g.client_id
            WHERE g.id = $2
            `,
            [projectId, normalized.clientGuestId]
        );

        if (!guests.length) {
            throw new AppError('Guest not found', 404, 'GUEST_NOT_FOUND');
        }

        const guest = guests[0];
        normalized.displayName = normalized.displayName || guest.name;
        normalized.displayNameAr = normalized.displayNameAr || '';
        normalized.email = normalized.email || guest.email || '';
        normalized.phone = normalized.phone || guest.mobile_number || '';
        if (!normalized.metadata.position && guest.position) {
            normalized.metadata.position = guest.position;
        }
    } else if (normalized.legacyGuestId) {
        const { rows: guests } = await db.query(
            `SELECT id, name, name_ar, email, phone FROM guests WHERE id = $1`,
            [normalized.legacyGuestId]
        );

        if (!guests.length) {
            throw new AppError('Guest not found', 404, 'GUEST_NOT_FOUND');
        }

        const guest = guests[0];
        normalized.displayName = normalized.displayName || guest.name;
        normalized.displayNameAr = normalized.displayNameAr || guest.name_ar || '';
        normalized.email = normalized.email || guest.email || '';
        normalized.phone = normalized.phone || guest.phone || '';
    }

    if (!normalized.displayName) {
        throw new AppError('Display name is required', 400, 'VALIDATION_ERROR');
    }

    if (!LANGUAGES.has(normalized.preferredLanguage)) {
        throw new AppError('Invalid preferred language', 400, 'VALIDATION_ERROR');
    }

    if (!CHANNELS.has(normalized.preferredChannel)) {
        throw new AppError('Invalid preferred channel', 400, 'VALIDATION_ERROR');
    }

    const recipientLookupId = normalized.clientGuestId || normalized.legacyGuestId;

    const { rows: existing } = await db.query(
        `
        SELECT *
        FROM invitation_recipients
        WHERE project_id = $1
          AND (
              client_guest_id = $2::uuid
              OR guest_id = $2::uuid
          )
        LIMIT 1
        `,
        [projectId, recipientLookupId]
    );

    if (existing.length) {
        const existingRow = existing[0];
        await db.query(
            `
            UPDATE invitation_recipients
            SET
                display_name = $1,
                display_name_ar = $2,
                email = $3,
                phone = $4,
                whatsapp_number = $5,
                preferred_language = $6,
                preferred_channel = $7,
                client_guest_id = COALESCE($8::uuid, client_guest_id),
                guest_id = COALESCE($9::uuid, guest_id),
                metadata = $10,
                updated_at = NOW()
            WHERE id = $11
            `,
            [
                normalized.displayName,
                normalized.displayNameAr || null,
                normalized.email || null,
                normalized.phone || null,
                normalized.whatsappNumber || null,
                normalized.preferredLanguage,
                normalized.preferredChannel,
                normalized.clientGuestId || null,
                normalized.legacyGuestId || null,
                JSON.stringify(normalized.metadata),
                existingRow.id
            ]
        );

        const { rows: updated } = await db.query(
            `SELECT * FROM invitation_recipients WHERE id = $1`,
            [existingRow.id]
        );

        return updated[0];
    }

    const id = uuidv4();
    const inviteCode = normalized.metadata.inviteCode || generateInviteCode();
    const publicToken = normalized.metadata.publicToken || generatePublicToken();

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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'draft')
        `,
        [
            id,
            projectId,
            normalized.legacyGuestId || null,
            normalized.clientGuestId || null,
            inviteCode,
            publicToken,
            normalized.displayName,
            normalized.displayNameAr || null,
            normalized.email || null,
            normalized.phone || null,
            normalized.whatsappNumber || null,
            normalized.preferredLanguage,
            normalized.preferredChannel,
            JSON.stringify(normalized.metadata)
        ]
    );

    const { rows: created } = await db.query(
        `SELECT * FROM invitation_recipients WHERE id = $1`,
        [id]
    );

    return created[0];
}

// GET /api/admin/invitation-projects
router.get('/', requirePermission('events.view'), async (req, res, next) => {
    try {
        const {
            search,
            status,
            clientId,
            eventId,
            page = 1,
            pageSize = 25,
            sortBy = 'updated_at',
            sortOrder = 'desc'
        } = req.query;

        let whereClause = '1=1';
        const params = [];
        let paramIndex = 1;

        if (search) {
            whereClause += ` AND (
                p.name ILIKE $${paramIndex}
                OR p.name_ar ILIKE $${paramIndex}
                OR c.name ILIKE $${paramIndex}
                OR e.name ILIKE $${paramIndex}
            )`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (status && status !== 'all') {
            whereClause += ` AND p.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (clientId) {
            whereClause += ` AND p.client_id = $${paramIndex}`;
            params.push(clientId);
            paramIndex++;
        }

        if (eventId) {
            whereClause += ` AND p.event_id = $${paramIndex}`;
            params.push(eventId);
            paramIndex++;
        }

        const { rows: countRows } = await pool.query(
            `
            SELECT COUNT(*)::int AS total
            FROM invitation_projects p
            JOIN clients c ON c.id = p.client_id
            JOIN events e ON e.id = p.event_id
            WHERE ${whereClause}
            `,
            params
        );

        const total = countRows[0]?.total || 0;
        const offset = (toInt(page, 1) - 1) * toInt(pageSize, 25);
        const validSortColumns = new Set(['name', 'status', 'created_at', 'updated_at']);
        const sortColumn = validSortColumns.has(sortBy) ? sortBy : 'updated_at';
        const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

        const { rows: projects } = await pool.query(
            `
            SELECT
                p.*,
                c.name AS client_name,
                c.name_ar AS client_name_ar,
                e.name AS event_name,
                e.name_ar AS event_name_ar,
                t.name AS cover_template_name,
                COALESCE((SELECT COUNT(*)::int FROM invitation_recipients r WHERE r.project_id = p.id), 0) AS recipient_count,
                COALESCE((SELECT COUNT(*)::int FROM invitation_project_pages pg WHERE pg.project_id = p.id), 0) AS page_count
            FROM invitation_projects p
            JOIN clients c ON c.id = p.client_id
            JOIN events e ON e.id = p.event_id
            LEFT JOIN templates t ON t.id = p.cover_template_id
            WHERE ${whereClause}
            ORDER BY p.${sortColumn} ${order}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `,
            [...params, toInt(pageSize, 25), offset]
        );

        res.json({
            data: projects,
            pagination: {
                total,
                page: toInt(page, 1),
                pageSize: toInt(pageSize, 25),
                totalPages: Math.ceil(total / toInt(pageSize, 25))
            }
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/invitation-projects/:id
router.get('/:id', requirePermission('events.view'), async (req, res, next) => {
    try {
        const { project, summary, pages } = await fetchProjectWithContext(req.params.id);
        res.json({ data: { project, summary, pages } });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/invitation-projects
router.post('/', requirePermission('events.create'), async (req, res, next) => {
    const db = await pool.connect();

    try {
        const {
            clientId,
            eventId,
            name,
            nameAr,
            description,
            descriptionAr,
            defaultLanguage = 'ar',
            coverTemplateId = null,
            status = 'draft',
            settings = {}
        } = req.body;

        if (!clientId || !eventId || !name) {
            throw new AppError('Client, event, and name are required', 400, 'VALIDATION_ERROR');
        }

        if (!LANGUAGES.has(defaultLanguage)) {
            throw new AppError('Invalid default language', 400, 'VALIDATION_ERROR');
        }

        if (!PROJECT_STATUSES.has(status)) {
            throw new AppError('Invalid project status', 400, 'VALIDATION_ERROR');
        }

        await db.query('BEGIN');

        const { rows: clients } = await db.query('SELECT id FROM clients WHERE id = $1', [clientId]);
        if (!clients.length) {
            throw new AppError('Client not found', 404, 'NOT_FOUND');
        }

        const { rows: events } = await db.query('SELECT id, client_id, template_id, settings FROM events WHERE id = $1', [eventId]);
        if (!events.length) {
            throw new AppError('Event not found', 404, 'NOT_FOUND');
        }

        if (events[0].client_id !== clientId) {
            throw new AppError('Event does not belong to the selected client', 400, 'VALIDATION_ERROR');
        }

        const eventRow = events[0];
        const eventSettings = safeJson(eventRow.settings, {});
        const invitationSetup = safeJson(eventSettings.invitation_setup, {});
        const resolvedCoverTemplateId = coverTemplateId || eventRow.template_id || null;

        const coverTemplatePayload = await loadCoverTemplatePayload(db, resolvedCoverTemplateId);
        const projectSettings = safeJson(settings, {});
        projectSettings.cover_template_id = resolvedCoverTemplateId;
        projectSettings.cover_template_hash = coverTemplatePayload.hash;

        const projectId = uuidv4();
        await db.query(
            `
            INSERT INTO invitation_projects (
                id,
                client_id,
                event_id,
                name,
                name_ar,
                description,
                description_ar,
                status,
                default_language,
                cover_template_id,
                cover_template_snapshot,
                settings,
                created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `,
            [
                projectId,
                clientId,
                eventId,
                name,
                nameAr || null,
                description || null,
                descriptionAr || null,
                status,
                defaultLanguage,
                resolvedCoverTemplateId,
                coverTemplatePayload.snapshot ? JSON.stringify(coverTemplatePayload.snapshot) : null,
                JSON.stringify(projectSettings),
                req.user.id
            ]
        );

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
            VALUES ($1, $2, $3, 'cover', $4, $5, $6, $7, 1, true, $8)
            `,
            [
                uuidv4(),
                projectId,
                'cover',
                name,
                nameAr || null,
                description || null,
                descriptionAr || null,
                JSON.stringify({
                    coverTemplateId: resolvedCoverTemplateId,
                    coverTemplateSnapshot: coverTemplatePayload.snapshot,
                    coverTemplateHash: coverTemplatePayload.hash
                })
            ]
        );

        await buildAddonPagesFromEventSetup(db, projectId, clientId, eventId, invitationSetup);

        await db.query('COMMIT');

        const { project, summary, pages } = await fetchProjectWithContext(projectId, db);

        res.status(201).json({
            data: {
                project,
                summary,
                pages
            }
        });
    } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        db.release();
    }
});

// PUT /api/admin/invitation-projects/:id
router.put('/:id', requirePermission('events.edit'), async (req, res, next) => {
    const db = await pool.connect();

    try {
        const {
            name,
            nameAr,
            description,
            descriptionAr,
            defaultLanguage,
            coverTemplateId,
            status,
            settings
        } = req.body;

        await db.query('BEGIN');

        const { rows: existing } = await db.query(
            'SELECT id, cover_template_id, settings FROM invitation_projects WHERE id = $1',
            [req.params.id]
        );

        if (!existing.length) {
            throw new AppError('Invitation project not found', 404, 'NOT_FOUND');
        }

        let coverTemplatePayload;
        if (coverTemplateId !== undefined) {
            if (coverTemplateId) {
                coverTemplatePayload = await loadCoverTemplatePayload(db, coverTemplateId);
            } else {
                coverTemplatePayload = { snapshot: null, hash: null };
            }
        }

        if (defaultLanguage && !LANGUAGES.has(defaultLanguage)) {
            throw new AppError('Invalid default language', 400, 'VALIDATION_ERROR');
        }

        if (status && !PROJECT_STATUSES.has(status)) {
            throw new AppError('Invalid project status', 400, 'VALIDATION_ERROR');
        }

        const existingSettings = safeJson(existing[0].settings, {});
        const nextSettings = {
            ...existingSettings,
            ...(settings === undefined ? {} : safeJson(settings, {}))
        };

        if (coverTemplateId !== undefined) {
            nextSettings.cover_template_id = coverTemplateId || null;
            nextSettings.cover_template_hash = coverTemplatePayload ? coverTemplatePayload.hash : null;
        }

        await db.query(
            `
            UPDATE invitation_projects
            SET
                name = COALESCE($1, name),
                name_ar = COALESCE($2, name_ar),
                description = COALESCE($3, description),
                description_ar = COALESCE($4, description_ar),
                default_language = COALESCE($5, default_language),
                cover_template_id = COALESCE($6, cover_template_id),
                cover_template_snapshot = CASE
                    WHEN $7::jsonb IS NOT NULL THEN $7::jsonb
                    ELSE cover_template_snapshot
                END,
                status = COALESCE($8, status),
                settings = $9::jsonb,
                updated_at = NOW()
            WHERE id = $10
            `,
            [
                name || null,
                nameAr || null,
                description || null,
                descriptionAr || null,
                defaultLanguage || null,
                coverTemplateId === undefined ? null : coverTemplateId,
                coverTemplatePayload === undefined ? null : JSON.stringify(coverTemplatePayload.snapshot),
                status || null,
                JSON.stringify(nextSettings),
                req.params.id
            ]
        );

        await db.query('COMMIT');

        const { project, summary, pages } = await fetchProjectWithContext(req.params.id, db);

        res.json({
            data: {
                project,
                summary,
                pages
            }
        });
    } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        db.release();
    }
});

// POST /api/admin/invitation-projects/:id/sync-template
router.post('/:id/sync-template', requirePermission('events.edit'), async (req, res, next) => {
    const db = await pool.connect();

    try {
        const projectId = normalizeText(req.params.id);
        if (!projectId) {
            throw new AppError('Project id is required', 400, 'VALIDATION_ERROR');
        }

        await db.query('BEGIN');

        const { rows: projectRows } = await db.query(
            `
            SELECT p.id, p.event_id, p.settings AS project_settings, e.template_id AS event_template_id
            FROM invitation_projects p
            JOIN events e ON e.id = p.event_id
            WHERE p.id = $1
            `,
            [projectId]
        );

        if (!projectRows.length) {
            throw new AppError('Invitation project not found', 404, 'NOT_FOUND');
        }

        const projectRow = projectRows[0];
        const eventTemplateId = projectRow.event_template_id || null;
        const coverTemplatePayload = await loadCoverTemplatePayload(db, eventTemplateId);
        const nextSettings = safeJson(projectRow.project_settings, {});
        nextSettings.cover_template_id = eventTemplateId;
        nextSettings.cover_template_hash = coverTemplatePayload.hash;

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
                coverTemplatePayload.snapshot === null ? null : JSON.stringify(coverTemplatePayload.snapshot),
                JSON.stringify(nextSettings),
                projectId
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
                    coverTemplateSnapshot: coverTemplatePayload.snapshot,
                    coverTemplateHash: coverTemplatePayload.hash
                }),
                projectId
            ]
        );

        await db.query('COMMIT');

        res.json({
            data: {
                projectId,
                synced: true,
                eventTemplateId,
                coverTemplateHash: coverTemplatePayload.hash
            }
        });
    } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        console.error('Failed to sync invitation template:', {
            projectId: req.params.id,
            message: error?.message || 'unknown',
            stack: error?.stack
        });
        next(error);
    } finally {
        db.release();
    }
});

// GET /api/admin/invitation-projects/:id/pages
router.get('/:id/pages', requirePermission('events.view'), async (req, res, next) => {
    try {
        const { rows: project } = await pool.query('SELECT id FROM invitation_projects WHERE id = $1', [req.params.id]);

        if (!project.length) {
            throw new AppError('Invitation project not found', 404, 'NOT_FOUND');
        }

        const { rows: pages } = await pool.query(
            `
            SELECT
                p.*,
                COALESCE((SELECT COUNT(*)::int FROM invitation_modules m WHERE m.page_id = p.id), 0) AS module_count
            FROM invitation_project_pages p
            WHERE p.project_id = $1
            ORDER BY p.sort_order ASC, p.created_at ASC
            `,
            [req.params.id]
        );

        res.json({ data: pages });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/invitation-projects/:id/pages
router.post('/:id/pages', requirePermission('events.edit'), async (req, res, next) => {
    const db = await pool.connect();

    try {
        const { rows: project } = await db.query('SELECT id FROM invitation_projects WHERE id = $1', [req.params.id]);

        if (!project.length) {
            throw new AppError('Invitation project not found', 404, 'NOT_FOUND');
        }

        const {
            pageKey,
            pageType,
            title,
            titleAr,
            description,
            descriptionAr,
            sortOrder = 0,
            isEnabled = true,
            settings = {}
        } = req.body;

        if (!pageType || !PAGE_TYPES.has(pageType)) {
            throw new AppError('Valid page type is required', 400, 'VALIDATION_ERROR');
        }

        const existingPageKey = pageKey || `${pageType}-${crypto.randomBytes(3).toString('hex')}`;

        await db.query('BEGIN');

        const { rows: inserted } = await db.query(
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
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
            `,
            [
                uuidv4(),
                req.params.id,
                existingPageKey,
                pageType,
                title || null,
                titleAr || null,
                description || null,
                descriptionAr || null,
                toInt(sortOrder, 0),
                Boolean(isEnabled),
                JSON.stringify(safeJson(settings, {}))
            ]
        );

        const createdPage = inserted[0];
        let createdModule = null;

        if (createdPage.page_type === 'rsvp') {
            createdModule = await createDefaultRsvpModule(db, createdPage);
        }

        await db.query('COMMIT');

        res.status(201).json({
            data: {
                ...createdPage,
                module: createdModule
            }
        });
    } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        db.release();
    }
});

// PUT /api/admin/invitation-projects/pages/:pageId
router.put('/pages/:pageId', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const { rows: existing } = await pool.query('SELECT * FROM invitation_project_pages WHERE id = $1', [req.params.pageId]);

        if (!existing.length) {
            throw new AppError('Page not found', 404, 'NOT_FOUND');
        }

        const {
            title,
            titleAr,
            description,
            descriptionAr,
            sortOrder,
            isEnabled,
            settings
        } = req.body;

        await pool.query(
            `
            UPDATE invitation_project_pages
            SET
                title = COALESCE($1, title),
                title_ar = COALESCE($2, title_ar),
                description = COALESCE($3, description),
                description_ar = COALESCE($4, description_ar),
                sort_order = COALESCE($5, sort_order),
                is_enabled = COALESCE($6, is_enabled),
                settings = COALESCE($7::jsonb, settings),
                updated_at = NOW()
            WHERE id = $8
            `,
            [
                title || null,
                titleAr || null,
                description || null,
                descriptionAr || null,
                sortOrder === undefined ? null : toInt(sortOrder, existing[0].sort_order),
                isEnabled === undefined ? null : Boolean(isEnabled),
                settings === undefined ? null : JSON.stringify(safeJson(settings, {})),
                req.params.pageId
            ]
        );

        const { rows: updated } = await pool.query('SELECT * FROM invitation_project_pages WHERE id = $1', [req.params.pageId]);
        res.json({ data: updated[0] });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/admin/invitation-projects/pages/:pageId
router.delete('/pages/:pageId', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const { rows: existing } = await pool.query('SELECT id, page_type FROM invitation_project_pages WHERE id = $1', [req.params.pageId]);

        if (!existing.length) {
            throw new AppError('Page not found', 404, 'NOT_FOUND');
        }

        if (existing[0].page_type === 'cover') {
            throw new AppError('Default cover page cannot be deleted', 400, 'DEFAULT_PAGE');
        }

        await pool.query('DELETE FROM invitation_project_pages WHERE id = $1', [req.params.pageId]);
        res.json({ message: 'Page deleted successfully' });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/invitation-projects/:id/invitations
router.get('/:id/invitations', requirePermission('events.view'), async (req, res, next) => {
    try {
        const { rows: project } = await pool.query('SELECT id FROM invitation_projects WHERE id = $1', [req.params.id]);

        if (!project.length) {
            throw new AppError('Invitation project not found', 404, 'NOT_FOUND');
        }

        const { search, status, channel, page = 1, pageSize = 25 } = req.query;
        let whereClause = 'r.project_id = $1';
        const params = [req.params.id];
        let paramIndex = 2;

        if (search) {
            whereClause += ` AND (
                r.display_name ILIKE $${paramIndex}
                OR r.display_name_ar ILIKE $${paramIndex}
                OR r.email ILIKE $${paramIndex}
                OR r.phone ILIKE $${paramIndex}
                OR r.invite_code ILIKE $${paramIndex}
            )`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (status && status !== 'all') {
            whereClause += ` AND r.overall_status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (channel && channel !== 'all') {
            whereClause += ` AND r.preferred_channel = $${paramIndex}`;
            params.push(channel);
            paramIndex++;
        }

        const { rows: countRows } = await pool.query(
            `SELECT COUNT(*)::int AS total FROM invitation_recipients r WHERE ${whereClause}`,
            params
        );

        const total = countRows[0]?.total || 0;
        const offset = (toInt(page, 1) - 1) * toInt(pageSize, 25);

        const { rows: invitations } = await pool.query(
            `
            SELECT
                r.*,
                COALESCE((SELECT COUNT(*)::int FROM invitation_events e WHERE e.recipient_id = r.id), 0) AS event_count
            FROM invitation_recipients r
            WHERE ${whereClause}
            ORDER BY r.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `,
            [...params, toInt(pageSize, 25), offset]
        );

        res.json({
            data: invitations,
            pagination: {
                total,
                page: toInt(page, 1),
                pageSize: toInt(pageSize, 25),
                totalPages: Math.ceil(total / toInt(pageSize, 25))
            }
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/invitation-projects/:id/invitations
router.post('/:id/invitations', requirePermission('events.edit'), async (req, res, next) => {
    const db = await pool.connect();

    try {
        const { rows: project } = await db.query('SELECT id FROM invitation_projects WHERE id = $1', [req.params.id]);

        if (!project.length) {
            throw new AppError('Invitation project not found', 404, 'NOT_FOUND');
        }

        await db.query('BEGIN');
        const invitation = await upsertInvitationRecipient(db, req.params.id, req.body);
        await db.query('UPDATE invitation_projects SET updated_at = NOW() WHERE id = $1', [req.params.id]);
        await db.query('COMMIT');

        res.status(201).json({ data: invitation });
    } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        db.release();
    }
});

// POST /api/admin/invitation-projects/:id/invitations/bulk
router.post('/:id/invitations/bulk', requirePermission('events.edit'), async (req, res, next) => {
    const db = await pool.connect();

    try {
        const { recipients = [] } = req.body;

        if (!Array.isArray(recipients) || !recipients.length) {
            throw new AppError('Recipients are required', 400, 'VALIDATION_ERROR');
        }

        const { rows: project } = await db.query('SELECT id FROM invitation_projects WHERE id = $1', [req.params.id]);

        if (!project.length) {
            throw new AppError('Invitation project not found', 404, 'NOT_FOUND');
        }

        await db.query('BEGIN');

        const created = [];
        for (const recipient of recipients) {
            const row = await upsertInvitationRecipient(db, req.params.id, recipient);
            created.push(row);
        }

        await db.query('UPDATE invitation_projects SET updated_at = NOW() WHERE id = $1', [req.params.id]);
        await db.query('COMMIT');

        res.status(201).json({ data: created, count: created.length });
    } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        db.release();
    }
});

// POST /api/admin/invitation-projects/:id/send-email
router.post('/:id/send-email', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const scheduledFor = req.body?.scheduledFor ? new Date(req.body.scheduledFor) : null;
        if (scheduledFor && Number.isNaN(scheduledFor.getTime())) {
            throw new AppError('Scheduled date is invalid', 400, 'VALIDATION_ERROR');
        }
        const result = await executeInvitationEmailSend({
            projectId: req.params.id,
            requestedRecipientIds: req.body?.recipientIds,
            scheduledFor,
            trace: false,
            createdBy: req.user?.id || null
        });

        res.json({ data: result });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/invitation-projects/:id/send-email/trace
router.post('/:id/send-email/trace', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const scheduledFor = req.body?.scheduledFor ? new Date(req.body.scheduledFor) : null;
        if (scheduledFor && Number.isNaN(scheduledFor.getTime())) {
            throw new AppError('Scheduled date is invalid', 400, 'VALIDATION_ERROR');
        }

        const result = await executeInvitationEmailSend({
            projectId: req.params.id,
            requestedRecipientIds: req.body?.recipientIds,
            scheduledFor,
            trace: true,
            createdBy: req.user?.id || null
        });

        res.json({ data: result });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/invitation-projects/:id/send-email/debug
router.post('/:id/send-email/debug', requirePermission('events.view'), async (req, res, next) => {
    try {
        const debugContext = await buildInvitationEmailSendContext(
            pool,
            req.params.id,
            req.body?.recipientIds
        );

        res.json({
            data: debugContext
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/invitation-projects/:id/deliveries
router.get('/:id/deliveries', requirePermission('events.view'), async (req, res, next) => {
    try {
        const { page = 1, pageSize = 25, status = 'all', channel = 'all', search = '' } = req.query;
        const pageNumber = toInt(page, 1);
        const pageSizeNumber = toInt(pageSize, 25);
        const offset = (pageNumber - 1) * pageSizeNumber;

        const { rows: projectRows } = await pool.query(
            'SELECT id FROM invitation_projects WHERE id = $1',
            [req.params.id]
        );

        if (!projectRows.length) {
            throw new AppError('Invitation project not found', 404, 'NOT_FOUND');
        }

        let whereClause = 'j.project_id = $1';
        const params = [req.params.id];
        let paramIndex = 2;

        if (status && status !== 'all') {
            whereClause += ` AND j.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (channel && channel !== 'all') {
            whereClause += ` AND j.channel = $${paramIndex}`;
            params.push(channel);
            paramIndex++;
        }

        if (search) {
            whereClause += ` AND (
                r.display_name ILIKE $${paramIndex}
                OR r.display_name_ar ILIKE $${paramIndex}
                OR r.email ILIKE $${paramIndex}
                OR r.phone ILIKE $${paramIndex}
            )`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        const { rows: countRows } = await pool.query(
            `
            SELECT COUNT(*)::int AS total
            FROM invitation_delivery_jobs j
            JOIN invitation_recipients r ON r.id = j.recipient_id
            WHERE ${whereClause}
            `,
            params
        );

        const total = countRows[0]?.total || 0;

        const { rows: deliveries } = await pool.query(
            `
            SELECT
                j.id,
                j.project_id,
                j.recipient_id,
                j.channel,
                j.status,
                j.scheduled_for,
                j.priority,
                j.attempt_count,
                j.provider_message_id,
                j.payload,
                j.last_error,
                j.sent_at,
                j.delivered_at,
                j.failed_at,
                j.created_at,
                j.updated_at,
                r.display_name,
                r.display_name_ar,
                r.email,
                r.preferred_language,
                r.public_token,
                COALESCE((
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'attempt_no', a.attempt_no,
                            'status', a.status,
                            'http_status', a.http_status,
                            'error_message', a.error_message,
                            'started_at', a.started_at,
                            'finished_at', a.finished_at,
                            'provider_event_id', a.provider_event_id
                        )
                        ORDER BY a.attempt_no ASC
                    )
                    FROM invitation_delivery_attempts a
                    WHERE a.delivery_job_id = j.id
                ), '[]'::jsonb) AS attempts
            FROM invitation_delivery_jobs j
            JOIN invitation_recipients r ON r.id = j.recipient_id
            WHERE ${whereClause}
            ORDER BY COALESCE(j.scheduled_for, j.created_at) DESC, j.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `,
            [...params, pageSizeNumber, offset]
        );

        res.json({
            data: deliveries,
            pagination: {
                total,
                page: pageNumber,
                pageSize: pageSizeNumber,
                totalPages: Math.ceil(total / pageSizeNumber)
            }
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/admin/invitation-projects/invitations/:invitationId
router.put('/invitations/:invitationId', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const { rows: existing } = await pool.query(
            'SELECT * FROM invitation_recipients WHERE id = $1',
            [req.params.invitationId]
        );

        if (!existing.length) {
            throw new AppError('Invitation not found', 404, 'NOT_FOUND');
        }

        const {
            displayName,
            displayNameAr,
            position,
            email,
            phone,
            whatsappNumber,
            preferredLanguage,
            preferredChannel,
            overallStatus,
            metadata
        } = req.body;

        if (preferredLanguage && !LANGUAGES.has(preferredLanguage)) {
            throw new AppError('Invalid preferred language', 400, 'VALIDATION_ERROR');
        }

        if (preferredChannel && !CHANNELS.has(preferredChannel)) {
            throw new AppError('Invalid preferred channel', 400, 'VALIDATION_ERROR');
        }

        if (overallStatus && !['draft', 'queued', 'sent', 'delivered', 'opened', 'clicked', 'responded', 'failed', 'opted_out', 'bounced'].includes(overallStatus)) {
            throw new AppError('Invalid invitation status', 400, 'VALIDATION_ERROR');
        }

        const existingMetadata = safeJson(existing[0].metadata, {});
        const incomingMetadata = metadata === undefined ? null : safeJson(metadata, {});
        let nextMetadata = null;

        if (metadata !== undefined || position !== undefined) {
            nextMetadata = { ...existingMetadata, ...(incomingMetadata || {}) };

            if (position !== undefined) {
                const trimmedPosition = typeof position === 'string' ? position.trim() : String(position ?? '').trim();
                if (trimmedPosition) {
                    nextMetadata.position = trimmedPosition;
                } else {
                    delete nextMetadata.position;
                }
            }
        }

        await pool.query(
            `
            UPDATE invitation_recipients
            SET
                display_name = COALESCE($1, display_name),
                display_name_ar = COALESCE($2, display_name_ar),
                email = COALESCE($3, email),
                phone = COALESCE($4, phone),
                whatsapp_number = COALESCE($5, whatsapp_number),
                preferred_language = COALESCE($6, preferred_language),
                preferred_channel = COALESCE($7, preferred_channel),
                overall_status = COALESCE($8, overall_status),
                metadata = COALESCE($9::jsonb, metadata),
                updated_at = NOW()
            WHERE id = $10
            `,
            [
                displayName || null,
                displayNameAr || null,
                email || null,
                phone || null,
                whatsappNumber || null,
                preferredLanguage || null,
                preferredChannel || null,
                overallStatus || null,
                nextMetadata === null ? null : JSON.stringify(nextMetadata),
                req.params.invitationId
            ]
        );

        const { rows: updated } = await pool.query(
            'SELECT * FROM invitation_recipients WHERE id = $1',
            [req.params.invitationId]
        );

        res.json({ data: updated[0] });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/admin/invitation-projects/invitations/:invitationId
router.delete('/invitations/:invitationId', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const { rows: existing } = await pool.query(
            'SELECT id FROM invitation_recipients WHERE id = $1',
            [req.params.invitationId]
        );

        if (!existing.length) {
            throw new AppError('Invitation not found', 404, 'NOT_FOUND');
        }

        await pool.query(
            `
            UPDATE invitation_recipients
            SET overall_status = 'opted_out', updated_at = NOW()
            WHERE id = $1
            `,
            [req.params.invitationId]
        );

        res.json({ message: 'Invitation archived' });
    } catch (error) {
        next(error);
    }
});

export default router;
