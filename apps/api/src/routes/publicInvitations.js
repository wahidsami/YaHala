import { Router } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/connection.js';
import { AppError } from '../middleware/errorHandler.js';
import { createDefaultRsvpModule } from './invitationProjects.js';

const router = Router();

function safeJson(value, fallback = null) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'object') return value;

    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function generateSessionToken() {
    return crypto.randomBytes(24).toString('hex');
}

function generateUuid() {
    return crypto.randomUUID ? crypto.randomUUID() : uuidv4();
}

function normalizeLanguage(language, fallback = 'ar') {
    return language === 'en' ? 'en' : fallback === 'en' ? 'en' : 'ar';
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

function shapeQuestionnaireSnapshot(questionnaire, questions = []) {
    return {
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
        questions
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

async function fetchQuestionnaireRuntimeState(db, questionnaireId, clientId, eventId) {
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
        return null;
    }

    const questionnaire = questionnaires[0];
    const { rows: questions } = await db.query(
        `
        SELECT *
        FROM questionnaire_questions
        WHERE questionnaire_id = $1
        ORDER BY sort_order ASC, created_at ASC
        `,
        [questionnaireId]
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
            label_ar: option.label_ar || '',
            value: option.value,
            sort_order: option.sort_order
        });
        return accumulator;
    }, {});

    const normalizedQuestions = questions.map((question) => ({
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
    }));

    return {
        questionnaire,
        questions: normalizedQuestions
    };
}

async function fetchPublicInvitationBundle(db, token) {
    const { rows } = await db.query(
        `
        SELECT
            r.id AS recipient_id,
            r.project_id,
            r.guest_id,
            r.client_guest_id,
            r.invite_code,
            r.public_token,
            r.display_name,
            r.display_name_ar,
            r.email,
            r.phone,
            r.whatsapp_number,
            r.preferred_language,
            r.preferred_channel,
            r.overall_status,
            r.invitation_snapshot,
            r.invitation_snapshot_hash,
            r.invitation_snapshot_at,
            r.invited_at,
            r.first_opened_at,
            r.last_opened_at,
            r.responded_at,
            r.metadata AS recipient_metadata,
            p.id AS project_record_id,
            p.client_id,
            p.event_id,
            p.name AS project_name,
            p.name_ar AS project_name_ar,
            p.description AS project_description,
            p.description_ar AS project_description_ar,
            p.status AS project_status,
            p.default_language,
            p.cover_template_id,
            p.cover_template_snapshot,
            p.settings AS project_settings,
            c.name AS client_name,
            c.name_ar AS client_name_ar,
            c.email AS client_email,
            e.name AS event_name,
            e.name_ar AS event_name_ar,
            e.start_datetime,
            e.end_datetime,
            e.venue,
            e.event_type,
            t.name AS cover_template_name,
            t.name_ar AS cover_template_name_ar,
            t.design_data AS cover_template_design_data
        FROM invitation_recipients r
        JOIN invitation_projects p ON p.id = r.project_id
        JOIN clients c ON c.id = p.client_id
        JOIN events e ON e.id = p.event_id
        LEFT JOIN templates t ON t.id = p.cover_template_id
        WHERE r.public_token = $1
        LIMIT 1
        `,
        [token]
    );

    if (!rows.length) {
        throw new AppError('Invitation link not found', 404, 'NOT_FOUND');
    }

    const recipient = rows[0];

    if (recipient.overall_status === 'opted_out') {
        throw new AppError('Invitation link is no longer available', 410, 'INVITATION_INACTIVE');
    }

    const invitationSnapshot = safeJson(recipient.invitation_snapshot, null);
    if (invitationSnapshot && invitationSnapshot.project && Array.isArray(invitationSnapshot.pages)) {
        const snapshotRecipient = invitationSnapshot.recipient && typeof invitationSnapshot.recipient === 'object'
            ? invitationSnapshot.recipient
            : {};
        const snapshotProject = invitationSnapshot.project;
        const snapshotPages = invitationSnapshot.pages;
        const snapshotLanguage = normalizeLanguage(
            invitationSnapshot.language || snapshotRecipient.preferred_language || recipient.preferred_language,
            snapshotProject.default_language || recipient.default_language || 'ar'
        );

        return {
            recipient: {
                ...recipient,
                ...snapshotRecipient,
                recipient_id: recipient.recipient_id,
                project_id: recipient.project_id,
                public_token: recipient.public_token,
                invitation_snapshot: invitationSnapshot,
                invitation_snapshot_hash: recipient.invitation_snapshot_hash || invitationSnapshot.project_snapshot_hash || null,
                invitation_snapshot_at: recipient.invitation_snapshot_at || invitationSnapshot.captured_at || null
            },
            project: snapshotProject,
            pages: snapshotPages,
            language: snapshotLanguage,
            snapshot: invitationSnapshot
        };
    }

    const { rows: pageRows } = await db.query(
        `
        SELECT
            p.*,
            COALESCE((SELECT COUNT(*)::int FROM invitation_modules m WHERE m.page_id = p.id), 0) AS module_count
        FROM invitation_project_pages p
        WHERE p.project_id = $1
        ORDER BY p.sort_order ASC, p.created_at ASC
        `,
        [recipient.project_id]
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
        [recipient.project_id]
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
        if (snapshot && snapshot.type === 'poll' && snapshot.poll_id) {
            const runtime = await fetchPollRuntimeState(db, snapshot.poll_id, recipient.client_id, recipient.event_id);
            if (!runtime) {
                continue;
            }

            const liveSnapshot = shapePollSnapshot(runtime.poll, runtime.options, runtime.stats);
            page.settings = {
                ...settings,
                addon_snapshot: liveSnapshot,
                poll_snapshot: liveSnapshot
            };
        } else if (
            (snapshot && snapshot.type === 'questionnaire' && snapshot.questionnaire_id)
            || (settings.addon_type === 'questionnaire' && settings.addon_id)
        ) {
            const questionnaireId = snapshot?.questionnaire_id || settings.addon_id;
            const runtime = await fetchQuestionnaireRuntimeState(db, questionnaireId, recipient.client_id, recipient.event_id);
            if (!runtime) {
                continue;
            }

            const liveSnapshot = shapeQuestionnaireSnapshot(runtime.questionnaire, runtime.questions);
            page.settings = {
                ...settings,
                addon_snapshot: liveSnapshot,
                questionnaire_snapshot: liveSnapshot
            };
        }
    }

    const project = {
        id: recipient.project_record_id,
        client_id: recipient.client_id,
        event_id: recipient.event_id,
        name: recipient.project_name,
        name_ar: recipient.project_name_ar,
        description: recipient.project_description,
        description_ar: recipient.project_description_ar,
        status: recipient.project_status,
        default_language: recipient.default_language,
        settings: safeJson(recipient.project_settings, {}),
        cover_template_id: recipient.cover_template_id,
        cover_template_snapshot: safeJson(recipient.cover_template_snapshot, null),
        client: {
            id: recipient.client_id,
            name: recipient.client_name,
            name_ar: recipient.client_name_ar,
            email: recipient.client_email
        },
        event: {
            id: recipient.event_id,
            name: recipient.event_name,
            name_ar: recipient.event_name_ar,
            start_datetime: recipient.start_datetime,
            end_datetime: recipient.end_datetime,
            venue: recipient.venue,
            event_type: recipient.event_type
        },
        cover_template: recipient.cover_template_id
            ? {
                id: recipient.cover_template_id,
                name: recipient.cover_template_name,
                name_ar: recipient.cover_template_name_ar,
                design_data: safeJson(recipient.cover_template_design_data, null)
            }
            : null
    };

    const language = normalizeLanguage(recipient.preferred_language, recipient.default_language || 'ar');

    return { recipient, project, pages, language, snapshot: null };
}

function normalizeSelectedOptionIds(value) {
    const rawValues = Array.isArray(value)
        ? value
        : typeof value === 'string'
            ? value.split(',')
            : value !== undefined && value !== null
                ? [value]
                : [];

    return [...new Set(rawValues.map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim())).filter(Boolean))];
}

function normalizeQuestionnaireAnswers(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((answer) => ({
            questionId: typeof answer?.questionId === 'string' ? answer.questionId.trim() : '',
            optionIds: Array.isArray(answer?.optionIds)
                ? answer.optionIds.map((id) => (typeof id === 'string' ? id.trim() : '')).filter(Boolean)
                : [],
            text: typeof answer?.text === 'string' ? answer.text.trim() : '',
            number: answer?.number === undefined || answer?.number === null || answer?.number === ''
                ? null
                : Number(answer.number),
            boolean: typeof answer?.boolean === 'boolean' ? answer.boolean : null
        }))
        .filter((answer) => answer.questionId);
}

async function fetchRsvpModule(db, projectId) {
    const { rows } = await db.query(
        `
        SELECT
            m.*,
            p.page_key,
            p.page_type
        FROM invitation_modules m
        JOIN invitation_project_pages p ON p.id = m.page_id
        WHERE p.project_id = $1
          AND p.page_type = 'rsvp'
          AND m.module_type = 'rsvp'
        ORDER BY p.sort_order ASC, m.sort_order ASC, m.created_at ASC
        LIMIT 1
        `,
        [projectId]
    );

    if (rows.length) {
        const module = rows[0];
        const { rows: fields } = await db.query(
            `
            SELECT *
            FROM invitation_module_fields
            WHERE module_id = $1
            ORDER BY sort_order ASC, created_at ASC
            `,
            [module.id]
        );

        return { module: shapeModule(module, fields), pageKey: module.page_key };
    }

    const { rows: pages } = await db.query(
        `
        SELECT *
        FROM invitation_project_pages
        WHERE project_id = $1
          AND page_type = 'rsvp'
        ORDER BY sort_order ASC, created_at ASC
        LIMIT 1
        `,
        [projectId]
    );

    if (!pages.length) {
        throw new AppError('RSVP page is not configured for this project', 404, 'RSVP_NOT_CONFIGURED');
    }

    const module = await createDefaultRsvpModule(db, pages[0]);
    return { module, pageKey: pages[0].page_key };
}

async function recordOpenEvent(db, recipient, language, req, sessionToken) {
    const existing = await db.query(
        'SELECT * FROM public_invitation_sessions WHERE session_token = $1 LIMIT 1',
        [sessionToken]
    );

    const ipAddress = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
        .toString()
        .split(',')[0]
        .trim() || null;
    const userAgent = req.get('user-agent') || null;
    const referrer = req.get('referer') || req.get('referrer') || null;

    let sessionRow;
    if (existing.rows.length) {
        const { rows } = await db.query(
            `
            UPDATE public_invitation_sessions
            SET
                open_count = open_count + 1,
                last_seen_at = NOW(),
                language_selected = COALESCE($1, language_selected),
                updated_at = NOW()
            WHERE session_token = $2
            RETURNING *
            `,
            [language, sessionToken]
        );
        sessionRow = rows[0];
    } else {
        const { rows } = await db.query(
            `
            INSERT INTO public_invitation_sessions (
                id,
                project_id,
                recipient_id,
                session_token,
                ip_address,
                user_agent,
                referrer,
                language_selected,
                open_count,
                opened_at,
                last_seen_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, NOW(), NOW())
            RETURNING *
            `,
            [
                generateUuid(),
                recipient.project_id,
                recipient.recipient_id,
                sessionToken,
                ipAddress,
                userAgent,
                referrer,
                language
            ]
        );
        sessionRow = rows[0];
    }

    await db.query(
        `
        UPDATE invitation_recipients
        SET
            overall_status = CASE
                WHEN overall_status IN ('draft', 'queued', 'sent', 'delivered') THEN 'opened'
                ELSE overall_status
            END,
            first_opened_at = COALESCE(first_opened_at, NOW()),
            last_opened_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        `,
        [recipient.recipient_id]
    );

    await db.query(
        `
        INSERT INTO invitation_events (
            id,
            project_id,
            recipient_id,
            session_id,
            event_type,
            event_name,
            event_data
        )
        VALUES ($1, $2, $3, $4, 'open', $5, $6)
        `,
        [
            generateUuid(),
            recipient.project_id,
            recipient.recipient_id,
            sessionRow.id,
            'Invitation opened',
            JSON.stringify({ language })
        ]
    );

    return sessionRow;
}

// GET /api/public/invitations/:token
router.get('/:token', async (req, res, next) => {
    try {
        const bundle = await fetchPublicInvitationBundle(pool, req.params.token);

        res.json({
            data: {
                project: bundle.project,
                recipient: {
                    id: bundle.recipient.recipient_id,
                    display_name: bundle.recipient.display_name,
                    display_name_ar: bundle.recipient.display_name_ar,
                    invite_code: bundle.recipient.invite_code,
                    public_token: bundle.recipient.public_token,
                    preferred_language: bundle.recipient.preferred_language,
                    preferred_channel: bundle.recipient.preferred_channel,
                    overall_status: bundle.recipient.overall_status,
                    metadata: safeJson(bundle.recipient.recipient_metadata, {})
                },
                pages: bundle.pages,
                language: bundle.language
            }
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/public/invitations/:token/open
router.post('/:token/open', async (req, res, next) => {
    const db = await pool.connect();

    try {
        const bundle = await fetchPublicInvitationBundle(db, req.params.token);
        const language = normalizeLanguage(req.body?.language, bundle.language);
        const sessionToken = req.body?.sessionToken || generateSessionToken();

        await db.query('BEGIN');
        const session = await recordOpenEvent(db, bundle.recipient, language, req, sessionToken);
        await db.query('COMMIT');

        res.json({
            data: {
                sessionToken: session.session_token,
                language,
                openedAt: session.opened_at,
                lastSeenAt: session.last_seen_at
            }
        });
    } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        db.release();
    }
});

// POST /api/public/invitations/:token/pages/:pageKey/vote
router.post('/:token/pages/:pageKey/vote', async (req, res, next) => {
    const db = await pool.connect();

    try {
        const bundle = await fetchPublicInvitationBundle(db, req.params.token);
        const page = bundle.pages.find((entry) => entry.page_key === req.params.pageKey);

        if (!page) {
            throw new AppError('Poll page not found', 404, 'NOT_FOUND');
        }

        const settings = safeJson(page.settings, {});
        const snapshot = safeJson(settings.addon_snapshot || settings.poll_snapshot, null);

        if (!snapshot || snapshot.type !== 'poll' || !snapshot.poll_id) {
            throw new AppError('Poll page is not configured', 400, 'VALIDATION_ERROR');
        }

        const selectedOptionIds = normalizeSelectedOptionIds(req.body?.optionIds ?? req.body?.optionId);
        if (!selectedOptionIds.length) {
            throw new AppError('At least one poll option must be selected', 400, 'VALIDATION_ERROR');
        }

        const sessionToken = typeof req.body?.sessionToken === 'string' && req.body.sessionToken.trim()
            ? req.body.sessionToken.trim()
            : generateSessionToken();
        const language = normalizeLanguage(req.body?.language, bundle.language);

        await db.query('BEGIN');

        const runtime = await fetchPollRuntimeState(db, snapshot.poll_id, bundle.recipient.client_id, bundle.recipient.event_id);
        if (!runtime) {
            throw new AppError('Selected poll not found', 404, 'POLL_NOT_FOUND');
        }

        const poll = runtime.poll;
        if (poll.status !== 'published') {
            throw new AppError('Poll is not available for voting', 400, 'POLL_NOT_AVAILABLE');
        }

        const startDate = poll.start_date ? new Date(poll.start_date) : null;
        if (startDate && !Number.isNaN(startDate.getTime()) && startDate.getTime() > Date.now()) {
            throw new AppError('Poll has not started yet', 400, 'POLL_NOT_STARTED');
        }

        const endDate = poll.end_date ? new Date(poll.end_date) : null;
        if (endDate && !Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) {
            throw new AppError('Poll has ended', 410, 'POLL_ENDED');
        }

        const selectedOptionSet = new Set(selectedOptionIds);
        const optionIdSet = new Set(runtime.options.map((option) => option.id));
        for (const optionId of selectedOptionSet) {
            if (!optionIdSet.has(optionId)) {
                throw new AppError('Selected poll option not found', 404, 'POLL_OPTION_NOT_FOUND');
            }
        }

        if (!poll.allow_multiple_choice && selectedOptionSet.size > 1) {
            throw new AppError('Multiple choices are not allowed for this poll', 400, 'POLL_MULTIPLE_NOT_ALLOWED');
        }

        if (poll.allow_multiple_choice && selectedOptionSet.size > poll.max_votes_per_user) {
            throw new AppError('Vote limit exceeded', 400, 'POLL_VOTE_LIMIT_EXCEEDED');
        }

        const voteGuestId = poll.poll_mode === 'named'
            ? bundle.recipient.client_guest_id || bundle.recipient.guest_id || null
            : null;
        const voteSessionId = poll.poll_mode === 'anonymous' || !voteGuestId ? sessionToken : null;

        if (poll.require_login && poll.poll_mode === 'named' && !voteGuestId) {
            throw new AppError('Guest identification is required for this poll', 403, 'POLL_LOGIN_REQUIRED');
        }

        const existingVotesQuery = voteGuestId
            ? 'SELECT id FROM poll_votes WHERE poll_id = $1 AND guest_id = $2 LIMIT 1'
            : 'SELECT id FROM poll_votes WHERE poll_id = $1 AND session_id = $2 LIMIT 1';
        const existingVotesParams = voteGuestId ? [poll.id, voteGuestId] : [poll.id, voteSessionId];

        const { rows: existingVotes } = await db.query(existingVotesQuery, existingVotesParams);
        if (existingVotes.length) {
            throw new AppError('You have already voted in this poll', 409, 'POLL_ALREADY_VOTED');
        }

        for (const optionId of selectedOptionSet) {
            await db.query(
                `
                INSERT INTO poll_votes (
                    id,
                    poll_id,
                    option_id,
                    guest_id,
                    session_id
                )
                VALUES ($1, $2, $3, $4, $5)
                `,
                [
                    generateUuid(),
                    poll.id,
                    optionId,
                    voteGuestId,
                    voteSessionId
                ]
            );
        }

        await db.query(
            `
            INSERT INTO invitation_events (
                id,
                project_id,
                recipient_id,
                session_id,
                event_type,
                event_name,
                event_data
            )
            VALUES ($1, $2, $3, $4, 'poll_vote', $5, $6)
            `,
            [
                generateUuid(),
                bundle.recipient.project_id,
                bundle.recipient.recipient_id,
                null,
                'Poll vote submitted',
                JSON.stringify({
                    pageKey: page.page_key,
                    pollId: poll.id,
                    optionIds: [...selectedOptionSet],
                    pollMode: poll.poll_mode,
                    language
                })
            ]
        );

        await db.query('COMMIT');

        const refreshed = await fetchPollRuntimeState(db, poll.id, bundle.recipient.client_id, bundle.recipient.event_id);
        const liveSnapshot = refreshed ? shapePollSnapshot(refreshed.poll, refreshed.options, refreshed.stats) : snapshot;

        res.json({
            data: {
                pageKey: page.page_key,
                poll: liveSnapshot,
                selectedOptionIds: [...selectedOptionSet],
                voted: true,
                sessionToken: voteSessionId
            }
        });
    } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        db.release();
    }
});

// GET /api/public/invitations/:token/pages/:pageKey/questionnaire-state
router.get('/:token/pages/:pageKey/questionnaire-state', async (req, res, next) => {
    const db = await pool.connect();
    try {
        const bundle = await fetchPublicInvitationBundle(db, req.params.token);
        const page = bundle.pages.find((entry) => entry.page_key === req.params.pageKey);
        if (!page) {
            throw new AppError('Questionnaire page not found', 404, 'NOT_FOUND');
        }

        const settings = safeJson(page.settings, {});
        const snapshot = safeJson(settings.addon_snapshot || settings.questionnaire_snapshot, null);
        if (!snapshot || snapshot.type !== 'questionnaire' || !snapshot.questionnaire_id) {
            throw new AppError('Questionnaire page is not configured', 400, 'VALIDATION_ERROR');
        }

        const runtime = await fetchQuestionnaireRuntimeState(
            db,
            snapshot.questionnaire_id,
            bundle.recipient.client_id,
            bundle.recipient.event_id
        );
        if (!runtime) {
            throw new AppError('Questionnaire not found', 404, 'NOT_FOUND');
        }

        const { rows: submissionRows } = await db.query(
            `
            SELECT id, submitted_at
            FROM questionnaire_submissions
            WHERE questionnaire_id = $1
              AND (
                recipient_id = $2
                OR (recipient_id IS NULL AND session_id = $3)
              )
            ORDER BY submitted_at DESC
            LIMIT 1
            `,
            [runtime.questionnaire.id, bundle.recipient.recipient_id, req.query?.sessionToken || '']
        );

        res.json({
            data: {
                pageKey: page.page_key,
                questionnaire: shapeQuestionnaireSnapshot(runtime.questionnaire, runtime.questions),
                submitted: Boolean(submissionRows.length),
                submittedAt: submissionRows[0]?.submitted_at || null
            }
        });
    } catch (error) {
        next(error);
    } finally {
        db.release();
    }
});

// POST /api/public/invitations/:token/pages/:pageKey/questionnaire-submit
router.post('/:token/pages/:pageKey/questionnaire-submit', async (req, res, next) => {
    const db = await pool.connect();
    try {
        const bundle = await fetchPublicInvitationBundle(db, req.params.token);
        const page = bundle.pages.find((entry) => entry.page_key === req.params.pageKey);
        if (!page) {
            throw new AppError('Questionnaire page not found', 404, 'NOT_FOUND');
        }

        const settings = safeJson(page.settings, {});
        const snapshot = safeJson(settings.addon_snapshot || settings.questionnaire_snapshot, null);
        if (!snapshot || snapshot.type !== 'questionnaire' || !snapshot.questionnaire_id) {
            throw new AppError('Questionnaire page is not configured', 400, 'VALIDATION_ERROR');
        }

        const runtime = await fetchQuestionnaireRuntimeState(
            db,
            snapshot.questionnaire_id,
            bundle.recipient.client_id,
            bundle.recipient.event_id
        );
        if (!runtime) {
            throw new AppError('Questionnaire not found', 404, 'NOT_FOUND');
        }

        const questionnaire = runtime.questionnaire;
        if (questionnaire.status !== 'published') {
            throw new AppError('Questionnaire is not available', 400, 'QUESTIONNAIRE_NOT_AVAILABLE');
        }

        const now = Date.now();
        const startDate = questionnaire.start_date ? new Date(questionnaire.start_date).getTime() : null;
        const endDate = questionnaire.end_date ? new Date(questionnaire.end_date).getTime() : null;
        if (startDate && !Number.isNaN(startDate) && startDate > now) {
            throw new AppError('Questionnaire has not started yet', 400, 'QUESTIONNAIRE_NOT_STARTED');
        }
        if (endDate && !Number.isNaN(endDate) && endDate < now) {
            throw new AppError('Questionnaire has ended', 410, 'QUESTIONNAIRE_ENDED');
        }

        const sessionToken = typeof req.body?.sessionToken === 'string' && req.body.sessionToken.trim()
            ? req.body.sessionToken.trim()
            : generateSessionToken();
        const answers = normalizeQuestionnaireAnswers(req.body?.answers);
        if (!answers.length) {
            throw new AppError('At least one answer is required', 400, 'VALIDATION_ERROR');
        }

        const questionMap = new Map(runtime.questions.map((question) => [question.id, question]));
        const answeredQuestionIds = new Set(answers.map((answer) => answer.questionId));

        for (const question of runtime.questions) {
            if (question.is_required && !answeredQuestionIds.has(question.id)) {
                throw new AppError('Required question is missing an answer', 400, 'VALIDATION_ERROR');
            }
        }

        await db.query('BEGIN');

        const { rows: existingRows } = await db.query(
            `
            SELECT id
            FROM questionnaire_submissions
            WHERE questionnaire_id = $1
              AND (
                recipient_id = $2
                OR (recipient_id IS NULL AND session_id = $3)
              )
            LIMIT 1
            `,
            [questionnaire.id, bundle.recipient.recipient_id, sessionToken]
        );
        if (existingRows.length) {
            throw new AppError('Questionnaire already submitted', 409, 'QUESTIONNAIRE_ALREADY_SUBMITTED');
        }

        const submissionId = generateUuid();
        await db.query(
            `
            INSERT INTO questionnaire_submissions (
                id, questionnaire_id, event_id, project_id, recipient_id, client_guest_id, session_id, metadata
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8::jsonb
            )
            `,
            [
                submissionId,
                questionnaire.id,
                bundle.recipient.event_id,
                bundle.recipient.project_id,
                bundle.recipient.recipient_id || null,
                bundle.recipient.client_guest_id || null,
                bundle.recipient.recipient_id ? null : sessionToken,
                JSON.stringify({ pageKey: page.page_key })
            ]
        );

        for (const answer of answers) {
            const question = questionMap.get(answer.questionId);
            if (!question) {
                throw new AppError('Question not found in questionnaire', 404, 'QUESTION_NOT_FOUND');
            }

            const questionType = question.question_type;
            if (questionType === 'yes_no') {
                if (typeof answer.boolean !== 'boolean') {
                    throw new AppError('Yes/No answer must be boolean', 400, 'VALIDATION_ERROR');
                }
                await db.query(
                    `
                    INSERT INTO questionnaire_answers (
                        id, submission_id, question_id, answer_boolean, answer_json
                    ) VALUES ($1, $2, $3, $4, $5::jsonb)
                    `,
                    [generateUuid(), submissionId, question.id, answer.boolean, JSON.stringify({})]
                );
            } else if (questionType === 'single_choice') {
                if (!answer.optionIds.length) {
                    throw new AppError('Single choice answer is required', 400, 'VALIDATION_ERROR');
                }
                const optionId = answer.optionIds[0];
                const validOptionIds = new Set((question.options || []).map((option) => option.id));
                if (!validOptionIds.has(optionId)) {
                    throw new AppError('Selected option is invalid for this question', 400, 'VALIDATION_ERROR');
                }
                await db.query(
                    `
                    INSERT INTO questionnaire_answers (
                        id, submission_id, question_id, option_id, answer_json
                    ) VALUES ($1, $2, $3, $4, $5::jsonb)
                    `,
                    [generateUuid(), submissionId, question.id, optionId, JSON.stringify({})]
                );
            } else if (questionType === 'multiple_choice') {
                if (!answer.optionIds.length) {
                    throw new AppError('Multiple choice answer is required', 400, 'VALIDATION_ERROR');
                }
                const validOptionIds = new Set((question.options || []).map((option) => option.id));
                for (const optionId of answer.optionIds) {
                    if (!validOptionIds.has(optionId)) {
                        throw new AppError('Selected option is invalid for this question', 400, 'VALIDATION_ERROR');
                    }
                    await db.query(
                        `
                        INSERT INTO questionnaire_answers (
                            id, submission_id, question_id, option_id, answer_json
                        ) VALUES ($1, $2, $3, $4, $5::jsonb)
                        `,
                        [generateUuid(), submissionId, question.id, optionId, JSON.stringify({})]
                    );
                }
            } else if (questionType === 'short_text') {
                if (!answer.text) {
                    throw new AppError('Short text answer is required', 400, 'VALIDATION_ERROR');
                }
                await db.query(
                    `
                    INSERT INTO questionnaire_answers (
                        id, submission_id, question_id, answer_text, answer_json
                    ) VALUES ($1, $2, $3, $4, $5::jsonb)
                    `,
                    [generateUuid(), submissionId, question.id, answer.text, JSON.stringify({})]
                );
            } else if (questionType === 'rating') {
                if (answer.number === null || Number.isNaN(answer.number)) {
                    throw new AppError('Rating answer is required', 400, 'VALIDATION_ERROR');
                }
                const questionSettings = safeJson(question.settings, {});
                const minValue = Number(questionSettings.min ?? 1);
                const maxValue = Number(questionSettings.max ?? 5);
                if (answer.number < minValue || answer.number > maxValue) {
                    throw new AppError('Rating answer out of range', 400, 'VALIDATION_ERROR');
                }
                await db.query(
                    `
                    INSERT INTO questionnaire_answers (
                        id, submission_id, question_id, answer_number, answer_json
                    ) VALUES ($1, $2, $3, $4, $5::jsonb)
                    `,
                    [generateUuid(), submissionId, question.id, answer.number, JSON.stringify({})]
                );
            }
        }

        await db.query(
            `
            INSERT INTO invitation_events (
                id, project_id, recipient_id, session_id, event_type, event_name, event_data
            ) VALUES (
                $1, $2, $3, $4, 'questionnaire_submit', $5, $6::jsonb
            )
            `,
            [
                generateUuid(),
                bundle.recipient.project_id,
                bundle.recipient.recipient_id,
                null,
                'Questionnaire submitted',
                JSON.stringify({
                    pageKey: page.page_key,
                    questionnaireId: questionnaire.id
                })
            ]
        );

        await db.query('COMMIT');

        res.json({
            data: {
                pageKey: page.page_key,
                questionnaireId: questionnaire.id,
                submitted: true,
                sessionToken: bundle.recipient.recipient_id ? null : sessionToken
            }
        });
    } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        db.release();
    }
});

// POST /api/public/invitations/:token/rsvp
router.post('/:token/rsvp', async (req, res, next) => {
    const db = await pool.connect();

    try {
        const bundle = await fetchPublicInvitationBundle(db, req.params.token);
        const language = normalizeLanguage(req.body?.language, bundle.language);
        const attendance = req.body?.attendance;
        const allowedAttendance = new Set(['attending', 'not_attending', 'maybe']);
        const guestCountRaw = req.body?.guestCount;
        const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
        const sessionToken = req.body?.sessionToken || generateSessionToken();

        if (!allowedAttendance.has(attendance)) {
            throw new AppError('A valid attendance response is required', 400, 'VALIDATION_ERROR');
        }

        const guestCount = guestCountRaw === undefined || guestCountRaw === null || guestCountRaw === ''
            ? null
            : Number.parseInt(guestCountRaw, 10);

        if (guestCount !== null && (Number.isNaN(guestCount) || guestCount < 0 || guestCount > 20)) {
            throw new AppError('Guest count must be between 0 and 20', 400, 'VALIDATION_ERROR');
        }

        await db.query('BEGIN');

        const { module } = await fetchRsvpModule(db, bundle.recipient.project_id);
        const { rows: existingResponseRows } = await db.query(
            `
            SELECT id
            FROM invitation_module_responses
            WHERE module_id = $1
              AND project_id = $2
              AND recipient_id = $3
            LIMIT 1
            `,
            [module.id, bundle.recipient.project_id, bundle.recipient.recipient_id]
        );

        let responseId = existingResponseRows[0]?.id || generateUuid();

        if (existingResponseRows.length) {
            await db.query(
                `
                UPDATE invitation_module_responses
                SET
                    response_status = 'submitted',
                    score = 0,
                    is_correct = NULL,
                    response_data = $1::jsonb,
                    submitted_at = NOW(),
                    updated_at = NOW()
                WHERE id = $2
                `,
                [
                    JSON.stringify({
                        attendance,
                        guestCount,
                        notes,
                        language
                    }),
                    responseId
                ]
            );

            await db.query(
                'DELETE FROM invitation_module_response_answers WHERE response_id = $1',
                [responseId]
            );
        } else {
            await db.query(
                `
                INSERT INTO invitation_module_responses (
                    id,
                    module_id,
                    project_id,
                    recipient_id,
                    response_status,
                    score,
                    is_correct,
                    response_data,
                    submitted_at
                )
                VALUES ($1, $2, $3, $4, 'submitted', 0, NULL, $5::jsonb, NOW())
                `,
                [
                    responseId,
                    module.id,
                    bundle.recipient.project_id,
                    bundle.recipient.recipient_id,
                    JSON.stringify({
                        attendance,
                        guestCount,
                        notes,
                        language
                    })
                ]
            );
        }

        const fieldMap = new Map(module.fields.map((field) => [field.field_key, field]));
        const answerRows = [
            {
                fieldKey: 'attendance',
                value: attendance,
                text: attendance
            },
            {
                fieldKey: 'guest_count',
                value: guestCount,
                text: guestCount === null ? '' : String(guestCount)
            },
            {
                fieldKey: 'notes',
                value: notes,
                text: notes
            }
        ];

        for (const [index, answer] of answerRows.entries()) {
            const field = fieldMap.get(answer.fieldKey);
            if (!field) {
                continue;
            }

            await db.query(
                `
                INSERT INTO invitation_module_response_answers (
                    id,
                    response_id,
                    field_id,
                    answer_value,
                    answer_text,
                    is_correct,
                    points_awarded
                )
                VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
                `,
                [
                    generateUuid(),
                    responseId,
                    field.id,
                    JSON.stringify({
                        value: answer.value
                    }),
                    answer.text || null,
                    null,
                    0
                ]
            );
        }

        const { rows: sessionRows } = await db.query(
            'SELECT id FROM public_invitation_sessions WHERE session_token = $1 LIMIT 1',
            [sessionToken]
        );
        let sessionId = sessionRows[0]?.id || null;

        if (!sessionId) {
            const session = await recordOpenEvent(db, bundle.recipient, language, req, sessionToken);
            sessionId = session.id;
        }

        await db.query(
            `
            UPDATE invitation_recipients
            SET
                overall_status = 'responded',
                responded_at = NOW(),
                last_opened_at = COALESCE(last_opened_at, NOW()),
                updated_at = NOW()
            WHERE id = $1
            `,
            [bundle.recipient.recipient_id]
        );

        await db.query(
            `
            INSERT INTO invitation_events (
                id,
                project_id,
                recipient_id,
                session_id,
                event_type,
                event_name,
                event_data
            )
            VALUES ($1, $2, $3, $4, 'rsvp_submit', $5, $6)
            `,
            [
                generateUuid(),
                bundle.recipient.project_id,
                bundle.recipient.recipient_id,
                sessionId,
                'RSVP submitted',
                JSON.stringify({
                    attendance,
                    guestCount,
                    notes,
                    language
                })
            ]
        );

        await db.query('COMMIT');

        res.json({
            data: {
                responseId,
                status: 'submitted',
                attendance,
                guestCount,
                notes,
                language
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
