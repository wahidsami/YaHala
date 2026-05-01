import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { savePollCover, savePollOptionMedia } from '../services/pollAssets.js';

const router = Router();

router.use(authenticate);

const POLL_STATUSES = new Set(['draft', 'published', 'ended', 'archived']);
const POLL_MODES = new Set(['named', 'anonymous']);
const SHOW_RESULTS_MODES = new Set(['immediately', 'after_vote', 'after_end', 'hidden']);
const EVENT_ADDON_IDS = new Set(['poll', 'questionnaire', 'quiz', 'instructions', 'guest_book', 'files_downloads']);

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalText(value) {
    const text = normalizeText(value);
    return text || null;
}

function normalizeJsonObject(value, fallback = {}) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    if (typeof value === 'object') {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function normalizeBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        return value !== 0;
    }

    const text = normalizeText(value).toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(text)) {
        return true;
    }

    if (['false', '0', 'no', 'off'].includes(text)) {
        return false;
    }

    return fallback;
}

function normalizeInteger(value, fallback = 1, min = 1) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
        return fallback;
    }

    return Math.max(min, parsed);
}

function normalizeDateOrNull(value) {
    const text = normalizeOptionalText(value);
    if (!text) {
        return null;
    }

    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
        throw new AppError('Date value is invalid', 400, 'VALIDATION_ERROR');
    }

    return date.toISOString();
}

function normalizeStatus(value) {
    const text = normalizeText(value);
    if (!text) {
        return 'draft';
    }

    if (!POLL_STATUSES.has(text)) {
        throw new AppError('Poll status is invalid', 400, 'VALIDATION_ERROR');
    }

    return text;
}

function normalizePollMode(value) {
    const text = normalizeText(value);
    if (!text) {
        return 'named';
    }

    if (!POLL_MODES.has(text)) {
        throw new AppError('Poll mode is invalid', 400, 'VALIDATION_ERROR');
    }

    return text;
}

function normalizeShowResultsMode(value) {
    const text = normalizeText(value);
    if (!text) {
        return 'after_vote';
    }

    if (!SHOW_RESULTS_MODES.has(text)) {
        throw new AppError('Show results mode is invalid', 400, 'VALIDATION_ERROR');
    }

    return text;
}

function normalizeAddIns(addIns) {
    if (!Array.isArray(addIns)) {
        return [];
    }

    return addIns
        .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
        .filter((item) => EVENT_ADDON_IDS.has(item));
}

function normalizePollOptions(options) {
    if (!Array.isArray(options)) {
        return [];
    }

    return options
        .map((option, index) => {
            const text = normalizeOptionalText(option?.text);
            const textAr = normalizeOptionalText(option?.textAr);
            const fallbackText = text || textAr;

            if (!fallbackText) {
                return null;
            }

            return {
                id: normalizeOptionalText(option?.id) || null,
                text: fallbackText,
                text_ar: textAr,
                image_path: normalizeOptionalText(option?.imagePath),
                image_data_url: normalizeOptionalText(option?.imageDataUrl),
                icon_path: normalizeOptionalText(option?.iconPath),
                icon_data_url: normalizeOptionalText(option?.iconDataUrl),
                icon: normalizeOptionalText(option?.icon),
                color_override: normalizeOptionalText(option?.colorOverride),
                sort_order: Number.isFinite(Number(option?.sortOrder)) ? Number.parseInt(option.sortOrder, 10) : index
            };
        })
        .filter(Boolean);
}

async function resolvePollOptionMedia(pollId, optionId, option) {
    const resolvedIconPath = option.icon_data_url
        ? await savePollOptionMedia(pollId, optionId, option.icon_data_url, 'icon')
        : normalizeOptionalText(option.icon_path);
    const resolvedImagePath = option.image_data_url
        ? await savePollOptionMedia(pollId, optionId, option.image_data_url, 'image')
        : normalizeOptionalText(option.image_path);

    return {
        icon_path: resolvedIconPath,
        image_path: resolvedImagePath
    };
}

async function ensureEventMatchesClient(client, clientId, eventId) {
    const { rows } = await client.query('SELECT id, client_id FROM events WHERE id = $1', [eventId]);
    if (!rows.length) {
        throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }

    if (rows[0].client_id !== clientId) {
        throw new AppError('Event does not belong to the selected client', 400, 'VALIDATION_ERROR');
    }
}

async function loadPollWithOptions(client, pollId) {
    const { rows: polls } = await client.query(
        `SELECT p.*, c.name as client_name, c.name_ar as client_name_ar, e.name as event_name, e.name_ar as event_name_ar
         FROM polls p
         JOIN clients c ON c.id = p.client_id
         JOIN events e ON e.id = p.event_id
         WHERE p.id = $1`,
        [pollId]
    );

    if (!polls.length) {
        return null;
    }

    const { rows: options } = await client.query(
        `SELECT *
         FROM poll_options
         WHERE poll_id = $1
         ORDER BY sort_order ASC, created_at ASC`,
        [pollId]
    );

    return {
        ...polls[0],
        options
    };
}

async function loadPollReport(client, pollId) {
    const poll = await loadPollWithOptions(client, pollId);
    if (!poll) {
        return null;
    }

    const { rows: summaryRows } = await client.query(
        `
        SELECT
            COUNT(*)::int AS total_votes,
            COUNT(DISTINCT COALESCE(guest_id::text, session_id))::int AS total_participants,
            COUNT(DISTINCT guest_id)::int AS named_participants,
            COUNT(DISTINCT session_id)::int AS anonymous_participants
        FROM poll_votes
        WHERE poll_id = $1
        `,
        [pollId]
    );

    const { rows: optionStats } = await client.query(
        `
        SELECT
            po.id,
            COUNT(pv.id)::int AS votes_count
        FROM poll_options po
        LEFT JOIN poll_votes pv ON pv.option_id = po.id
        WHERE po.poll_id = $1
        GROUP BY po.id
        `,
        [pollId]
    );

    const optionStatsMap = new Map(optionStats.map((row) => [row.id, Number(row.votes_count) || 0]));
    const totalVotes = Number(summaryRows[0]?.total_votes || 0);

    const { rows: votes } = await client.query(
        `
        SELECT
            pv.id,
            pv.poll_id,
            pv.option_id,
            pv.guest_id,
            pv.session_id,
            pv.created_at,
            po.text AS option_text,
            po.text_ar AS option_text_ar,
            po.sort_order AS option_sort_order,
            cg.name AS guest_name,
            cg.email AS guest_email,
            cg.mobile_number AS guest_mobile_number,
            cg.position AS guest_position,
            cg.avatar_path AS guest_avatar_path
        FROM poll_votes pv
        JOIN poll_options po ON po.id = pv.option_id
        LEFT JOIN client_guests cg ON cg.id = pv.guest_id
        WHERE pv.poll_id = $1
        ORDER BY pv.created_at ASC, pv.id ASC
        `,
        [pollId]
    );

    return {
        poll,
        summary: {
            total_votes: totalVotes,
            total_participants: Number(summaryRows[0]?.total_participants || 0),
            named_participants: Number(summaryRows[0]?.named_participants || 0),
            anonymous_participants: Number(summaryRows[0]?.anonymous_participants || 0)
        },
        options: poll.options.map((option) => ({
            ...option,
            votes_count: optionStatsMap.get(option.id) || 0,
            percentage: totalVotes > 0 ? Math.round(((optionStatsMap.get(option.id) || 0) / totalVotes) * 100) : 0
        })),
        votes
    };
}

function escapeCsvValue(value) {
    if (value === null || value === undefined) {
        return '';
    }

    const text = String(value);
    if (/["\n,]/.test(text)) {
        return `"${text.replaceAll('"', '""')}"`;
    }

    return text;
}

// GET /api/admin/polls/stats
router.get('/stats', requirePermission('events.view'), async (req, res, next) => {
    try {
        const { clientId, eventId, status, mode } = req.query;
        let whereClause = '1=1';
        const params = [];
        let paramIndex = 1;

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

        if (status && status !== 'all') {
            whereClause += ` AND p.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (mode && mode !== 'all') {
            whereClause += ` AND p.poll_mode = $${paramIndex}`;
            params.push(mode);
            paramIndex++;
        }

        const { rows: pollStats } = await pool.query(
            `SELECT
                COUNT(*)::int AS total_polls,
                COUNT(*) FILTER (WHERE status = 'published')::int AS published_polls,
                COUNT(*) FILTER (WHERE status = 'draft')::int AS draft_polls,
                COUNT(*) FILTER (WHERE status = 'ended')::int AS ended_polls,
                COUNT(*) FILTER (WHERE poll_mode = 'anonymous')::int AS anonymous_polls,
                COUNT(*) FILTER (WHERE poll_mode = 'named')::int AS named_polls
             FROM polls p
             WHERE ${whereClause}`,
            params
        );

        const { rows: voteStats } = await pool.query(
            `SELECT
                COUNT(*)::int AS total_votes,
                COUNT(DISTINCT COALESCE(guest_id::text, session_id))::int AS total_participants
             FROM poll_votes pv
             JOIN polls p ON p.id = pv.poll_id
             WHERE ${whereClause}`,
            params
        );

        res.json({
            data: {
                ...(pollStats[0] || {}),
                ...(voteStats[0] || {}),
                active_polls: pollStats[0]?.published_polls || 0
            }
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/polls
router.get('/', requirePermission('events.view'), async (req, res, next) => {
    try {
        const {
            search,
            status = 'all',
            mode = 'all',
            clientId,
            eventId,
            page = 1,
            pageSize = 25,
            sortBy = 'created_at',
            sortOrder = 'desc'
        } = req.query;

        let whereClause = '1=1';
        const params = [];
        let paramIndex = 1;

        if (search) {
            whereClause += ` AND (p.title ILIKE $${paramIndex} OR p.title_ar ILIKE $${paramIndex} OR p.subtitle ILIKE $${paramIndex} OR p.subtitle_ar ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (status && status !== 'all') {
            whereClause += ` AND p.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (mode && mode !== 'all') {
            whereClause += ` AND p.poll_mode = $${paramIndex}`;
            params.push(mode);
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
            `SELECT COUNT(*)::int AS total
             FROM polls p
             WHERE ${whereClause}`,
            params
        );

        const total = countRows[0]?.total || 0;
        const validSortColumns = ['title', 'status', 'poll_mode', 'start_date', 'end_date', 'created_at'];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
        const offset = (Number.parseInt(page, 10) - 1) * Number.parseInt(pageSize, 10);

        const { rows: polls } = await pool.query(
            `SELECT
                p.*,
                c.name AS client_name,
                c.name_ar AS client_name_ar,
                e.name AS event_name,
                e.name_ar AS event_name_ar,
                COALESCE(opt.option_count, 0)::int AS option_count,
                COALESCE(vote_stats.total_votes, 0)::int AS total_votes,
                COALESCE(vote_stats.participants_count, 0)::int AS participants_count
             FROM polls p
             JOIN clients c ON c.id = p.client_id
             JOIN events e ON e.id = p.event_id
             LEFT JOIN (
                SELECT poll_id, COUNT(*)::int AS option_count
                FROM poll_options
                GROUP BY poll_id
             ) opt ON opt.poll_id = p.id
             LEFT JOIN (
                SELECT
                    poll_id,
                    COUNT(*)::int AS total_votes,
                    COUNT(DISTINCT COALESCE(guest_id::text, session_id))::int AS participants_count
                FROM poll_votes
                GROUP BY poll_id
             ) vote_stats ON vote_stats.poll_id = p.id
             WHERE ${whereClause}
             ORDER BY p.${sortColumn} ${order}
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, Number.parseInt(pageSize, 10), offset]
        );

        res.json({
            data: polls,
            pagination: {
                total,
                page: Number.parseInt(page, 10),
                pageSize: Number.parseInt(pageSize, 10),
                totalPages: Math.ceil(total / Number.parseInt(pageSize, 10))
            }
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/polls/:id
router.get('/:id', requirePermission('events.view'), async (req, res, next) => {
    try {
        const poll = await loadPollWithOptions(pool, req.params.id);
        if (!poll) {
            throw new AppError('Poll not found', 404, 'NOT_FOUND');
        }

        res.json({ data: poll });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/polls/:id/report
router.get('/:id/report', requirePermission('events.view'), async (req, res, next) => {
    try {
        const report = await loadPollReport(pool, req.params.id);
        if (!report) {
            throw new AppError('Poll not found', 404, 'NOT_FOUND');
        }

        res.json({ data: report });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/polls/:id/export
router.get('/:id/export', requirePermission('events.view'), async (req, res, next) => {
    try {
        const report = await loadPollReport(pool, req.params.id);
        if (!report) {
            throw new AppError('Poll not found', 404, 'NOT_FOUND');
        }

        const lines = [];
        lines.push([
            'poll_id',
            'poll_title',
            'poll_mode',
            'status',
            'option',
            'guest_name',
            'guest_email',
            'guest_mobile_number',
            'guest_position',
            'session_id',
            'created_at'
        ].join(','));

        for (const vote of report.votes) {
            const anonymous = report.poll.poll_mode === 'anonymous';
            lines.push([
                escapeCsvValue(report.poll.id),
                escapeCsvValue(report.poll.title),
                escapeCsvValue(report.poll.poll_mode),
                escapeCsvValue(report.poll.status),
                escapeCsvValue(vote.option_text || ''),
                escapeCsvValue(anonymous ? 'Anonymous' : vote.guest_name || ''),
                escapeCsvValue(anonymous ? '' : vote.guest_email || ''),
                escapeCsvValue(anonymous ? '' : vote.guest_mobile_number || ''),
                escapeCsvValue(anonymous ? '' : vote.guest_position || ''),
                escapeCsvValue(anonymous ? '' : vote.session_id || ''),
                escapeCsvValue(vote.created_at || '')
            ].join(','));
        }

        const csv = lines.join('\n');
        const fileName = `poll-report-${req.params.id}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(csv);
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/polls
router.post('/', requirePermission('events.edit'), async (req, res, next) => {
    const client = await pool.connect();
    try {
        const {
            clientId,
            eventId,
            title,
            titleAr,
            subtitle,
            subtitleAr,
            description,
            descriptionAr,
            coverImageDataUrl,
            coverImagePath,
            themeSettings = {},
            layoutSettings = {},
            status = 'draft',
            pollMode = 'named',
            allowMultipleChoice = false,
            requireLogin = true,
            startDate,
            endDate,
            maxVotesPerUser = 1,
            showResultsMode = 'after_vote',
            options = []
        } = req.body;

        if (!clientId || !eventId || !title) {
            throw new AppError('Client, event, and title are required', 400, 'VALIDATION_ERROR');
        }

        await ensureEventMatchesClient(client, clientId, eventId);

        const normalizedOptions = normalizePollOptions(options);
        if (!normalizedOptions.length) {
            throw new AppError('At least one poll option is required', 400, 'VALIDATION_ERROR');
        }

        const pollId = uuidv4();
        const resolvedStatus = normalizeStatus(status);
        const resolvedMode = normalizePollMode(pollMode);
        const resolvedShowResultsMode = normalizeShowResultsMode(showResultsMode);
        const resolvedCoverImagePath = coverImageDataUrl
            ? await savePollCover(pollId, coverImageDataUrl)
            : normalizeOptionalText(coverImagePath);

        await client.query('BEGIN');

        await client.query(
            `INSERT INTO polls (
                id,
                client_id,
                event_id,
                title,
                title_ar,
                subtitle,
                subtitle_ar,
                description,
                description_ar,
                cover_image_path,
                theme_settings,
                layout_settings,
                status,
                poll_mode,
                allow_multiple_choice,
                require_login,
                start_date,
                end_date,
                max_votes_per_user,
                show_results_mode,
                created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
            [
                pollId,
                clientId,
                eventId,
                normalizeText(title),
                normalizeOptionalText(titleAr),
                normalizeOptionalText(subtitle),
                normalizeOptionalText(subtitleAr),
                normalizeOptionalText(description),
                normalizeOptionalText(descriptionAr),
                resolvedCoverImagePath,
                JSON.stringify(normalizeJsonObject(themeSettings, {})),
                JSON.stringify(normalizeJsonObject(layoutSettings, {})),
                resolvedStatus,
                resolvedMode,
                normalizeBoolean(allowMultipleChoice, false),
                normalizeBoolean(requireLogin, true),
                normalizeDateOrNull(startDate),
                normalizeDateOrNull(endDate),
                normalizeInteger(maxVotesPerUser, 1, 1),
                resolvedShowResultsMode,
                req.user.id
            ]
        );

        for (const option of normalizedOptions) {
            const optionId = uuidv4();
            const media = await resolvePollOptionMedia(pollId, optionId, option);
            await client.query(
                `INSERT INTO poll_options (
                    id,
                    poll_id,
                    text,
                    text_ar,
                    image_path,
                    icon_path,
                    icon,
                    color_override,
                    sort_order
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    optionId,
                    pollId,
                    option.text,
                    option.text_ar,
                    media.image_path,
                    media.icon_path,
                    option.icon,
                    option.color_override,
                    option.sort_order
                ]
            );
        }

        await client.query('COMMIT');

        const created = await loadPollWithOptions(pool, pollId);
        res.status(201).json({ data: created });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
});

// PUT /api/admin/polls/:id
router.put('/:id', requirePermission('events.edit'), async (req, res, next) => {
    const client = await pool.connect();
    try {
        const {
            clientId,
            eventId,
            title,
            titleAr,
            subtitle,
            subtitleAr,
            description,
            descriptionAr,
            coverImageDataUrl,
            coverImagePath,
            themeSettings = {},
            layoutSettings = {},
            status,
            pollMode,
            allowMultipleChoice,
            requireLogin,
            startDate,
            endDate,
            maxVotesPerUser,
            showResultsMode,
            options = []
        } = req.body;

        const { rows: existingRows } = await client.query('SELECT * FROM polls WHERE id = $1', [req.params.id]);
        if (!existingRows.length) {
            throw new AppError('Poll not found', 404, 'NOT_FOUND');
        }

        const existing = existingRows[0];
        const nextClientId = normalizeOptionalText(clientId) || existing.client_id;
        const nextEventId = normalizeOptionalText(eventId) || existing.event_id;

        await ensureEventMatchesClient(client, nextClientId, nextEventId);

        const normalizedOptions = normalizePollOptions(options);
        if (!normalizedOptions.length) {
            throw new AppError('At least one poll option is required', 400, 'VALIDATION_ERROR');
        }

        const resolvedCoverImagePath = coverImageDataUrl
            ? await savePollCover(req.params.id, coverImageDataUrl)
            : Object.prototype.hasOwnProperty.call(req.body, 'coverImagePath')
                ? normalizeOptionalText(coverImagePath)
                : existing.cover_image_path;

        await client.query('BEGIN');

        const nextStatus = normalizeStatus(typeof status === 'undefined' ? existing.status : status);
        const nextMode = normalizePollMode(typeof pollMode === 'undefined' ? existing.poll_mode : pollMode);
        const nextShowResultsMode = normalizeShowResultsMode(
            typeof showResultsMode === 'undefined' ? existing.show_results_mode : showResultsMode
        );

        await client.query(
            `UPDATE polls SET
                client_id = COALESCE($1, client_id),
                event_id = COALESCE($2, event_id),
                title = COALESCE($3, title),
                title_ar = COALESCE($4, title_ar),
                subtitle = COALESCE($5, subtitle),
                subtitle_ar = COALESCE($6, subtitle_ar),
                description = COALESCE($7, description),
                description_ar = COALESCE($8, description_ar),
                cover_image_path = COALESCE($9, cover_image_path),
                theme_settings = COALESCE($10::jsonb, theme_settings),
                layout_settings = COALESCE($11::jsonb, layout_settings),
                status = $12,
                poll_mode = $13,
                allow_multiple_choice = COALESCE($14, allow_multiple_choice),
                require_login = COALESCE($15, require_login),
                start_date = COALESCE($16, start_date),
                end_date = COALESCE($17, end_date),
                max_votes_per_user = COALESCE($18, max_votes_per_user),
                show_results_mode = $19,
                updated_at = NOW()
             WHERE id = $20`,
            [
                nextClientId,
                nextEventId,
                normalizeOptionalText(title),
                normalizeOptionalText(titleAr),
                normalizeOptionalText(subtitle),
                normalizeOptionalText(subtitleAr),
                normalizeOptionalText(description),
                normalizeOptionalText(descriptionAr),
                resolvedCoverImagePath,
                JSON.stringify(normalizeJsonObject(themeSettings, {})),
                JSON.stringify(normalizeJsonObject(layoutSettings, {})),
                nextStatus,
                nextMode,
                typeof allowMultipleChoice === 'undefined' ? null : normalizeBoolean(allowMultipleChoice, existing.allow_multiple_choice),
                typeof requireLogin === 'undefined' ? null : normalizeBoolean(requireLogin, existing.require_login),
                typeof startDate === 'undefined' ? null : normalizeDateOrNull(startDate),
                typeof endDate === 'undefined' ? null : normalizeDateOrNull(endDate),
                typeof maxVotesPerUser === 'undefined' ? null : normalizeInteger(maxVotesPerUser, existing.max_votes_per_user, 1),
                nextShowResultsMode,
                req.params.id
            ]
        );

        const { rows: currentOptions } = await client.query(
            `SELECT id, votes_count
             FROM poll_options
             WHERE poll_id = $1`,
            [req.params.id]
        );

        const currentOptionMap = new Map(currentOptions.map((option) => [option.id, option]));
        const incomingIds = new Set();

        for (const option of normalizedOptions) {
            if (option.id && currentOptionMap.has(option.id)) {
                incomingIds.add(option.id);
                const media = await resolvePollOptionMedia(req.params.id, option.id, option);
                await client.query(
                    `UPDATE poll_options SET
                        text = $1,
                        text_ar = $2,
                        image_path = $3,
                        icon_path = $4,
                        icon = $5,
                        color_override = $6,
                        sort_order = $7,
                        updated_at = NOW()
                     WHERE id = $8`,
                    [
                        option.text,
                        option.text_ar,
                        media.image_path,
                        media.icon_path,
                        option.icon,
                        option.color_override,
                        option.sort_order,
                        option.id
                    ]
                );
                continue;
            }

            const optionId = uuidv4();
            incomingIds.add(optionId);
            const media = await resolvePollOptionMedia(req.params.id, optionId, option);
            await client.query(
                `INSERT INTO poll_options (
                    id,
                    poll_id,
                    text,
                    text_ar,
                    image_path,
                    icon_path,
                    icon,
                    color_override,
                    sort_order
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    optionId,
                    req.params.id,
                    option.text,
                    option.text_ar,
                    media.image_path,
                    media.icon_path,
                    option.icon,
                    option.color_override,
                    option.sort_order
                ]
            );
        }

        for (const [optionId, optionRow] of currentOptionMap.entries()) {
            if (incomingIds.has(optionId)) {
                continue;
            }

            if (Number(optionRow.votes_count) > 0) {
                throw new AppError('Cannot remove poll options that already have votes', 400, 'POLL_OPTION_HAS_VOTES');
            }

            await client.query('DELETE FROM poll_options WHERE id = $1', [optionId]);
        }

        await client.query('COMMIT');

        const updated = await loadPollWithOptions(pool, req.params.id);
        res.json({ data: updated });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
});

// PATCH /api/admin/polls/:id/status
router.patch('/:id/status', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!POLL_STATUSES.has(status)) {
            throw new AppError('Poll status is invalid', 400, 'VALIDATION_ERROR');
        }

        const { rows: existing } = await pool.query('SELECT id FROM polls WHERE id = $1', [req.params.id]);
        if (!existing.length) {
            throw new AppError('Poll not found', 404, 'NOT_FOUND');
        }

        await pool.query('UPDATE polls SET status = $1, updated_at = NOW() WHERE id = $2', [status, req.params.id]);

        const updated = await loadPollWithOptions(pool, req.params.id);
        res.json({ data: updated });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/admin/polls/:id
router.delete('/:id', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const { rows: existing } = await pool.query('SELECT id FROM polls WHERE id = $1', [req.params.id]);
        if (!existing.length) {
            throw new AppError('Poll not found', 404, 'NOT_FOUND');
        }

        await pool.query('DELETE FROM polls WHERE id = $1', [req.params.id]);
        res.json({ message: 'Poll deleted successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;
