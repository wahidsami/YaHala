import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

const QUESTIONNAIRE_STATUSES = new Set(['draft', 'published', 'archived']);
const QUESTION_TYPES = new Set(['yes_no', 'single_choice', 'multiple_choice', 'short_text', 'rating']);

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

function normalizeInteger(value, fallback = 0, min = 0) {
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
    const text = normalizeText(value) || 'draft';
    if (!QUESTIONNAIRE_STATUSES.has(text)) {
        throw new AppError('Questionnaire status is invalid', 400, 'VALIDATION_ERROR');
    }
    return text;
}

function normalizeQuestions(questions) {
    if (!Array.isArray(questions) || !questions.length) {
        throw new AppError('At least one question is required', 400, 'VALIDATION_ERROR');
    }

    return questions.map((question, index) => {
        const questionType = normalizeText(question?.questionType || question?.question_type);
        if (!QUESTION_TYPES.has(questionType)) {
            throw new AppError('Question type is invalid', 400, 'VALIDATION_ERROR');
        }

        const title = normalizeText(question?.title);
        const titleAr = normalizeOptionalText(question?.titleAr || question?.title_ar);
        if (!title && !titleAr) {
            throw new AppError('Question title is required', 400, 'VALIDATION_ERROR');
        }

        const options = Array.isArray(question?.options)
            ? question.options
                .map((option, optionIndex) => {
                    const label = normalizeText(option?.label);
                    const labelAr = normalizeOptionalText(option?.labelAr || option?.label_ar);
                    const value = normalizeText(option?.value) || label;
                    if (!value || (!label && !labelAr)) {
                        return null;
                    }
                    return {
                        id: normalizeOptionalText(option?.id),
                        label: label || value,
                        labelAr,
                        value,
                        sortOrder: Number.isFinite(Number(option?.sortOrder))
                            ? Number.parseInt(option.sortOrder, 10)
                            : optionIndex
                    };
                })
                .filter(Boolean)
            : [];

        if (['single_choice', 'multiple_choice', 'yes_no'].includes(questionType) && options.length < 2) {
            throw new AppError('Choice-based questions require at least two options', 400, 'VALIDATION_ERROR');
        }

        return {
            id: normalizeOptionalText(question?.id),
            questionType,
            title: title || titleAr,
            titleAr,
            description: normalizeOptionalText(question?.description),
            descriptionAr: normalizeOptionalText(question?.descriptionAr || question?.description_ar),
            isRequired: Boolean(question?.isRequired ?? question?.is_required),
            sortOrder: Number.isFinite(Number(question?.sortOrder))
                ? Number.parseInt(question.sortOrder, 10)
                : index,
            settings: normalizeJsonObject(question?.settings, {}),
            options
        };
    });
}

async function ensureEventMatchesClient(client, clientId, eventId) {
    const { rows } = await client.query('SELECT id, client_id FROM events WHERE id = $1', [eventId]);
    if (!rows.length) {
        throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    }
    if (rows[0].client_id !== clientId) {
        throw new AppError('Event does not belong to selected client', 400, 'VALIDATION_ERROR');
    }
}

async function loadQuestionnaire(client, questionnaireId) {
    const { rows: questionnaires } = await client.query(
        `
        SELECT q.*, c.name AS client_name, c.name_ar AS client_name_ar, e.name AS event_name, e.name_ar AS event_name_ar
        FROM questionnaires q
        JOIN clients c ON c.id = q.client_id
        JOIN events e ON e.id = q.event_id
        WHERE q.id = $1
        `,
        [questionnaireId]
    );
    if (!questionnaires.length) {
        return null;
    }

    const questionnaire = questionnaires[0];
    const { rows: questions } = await client.query(
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
        const { rows } = await client.query(
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

    const optionsByQuestion = options.reduce((accumulator, option) => {
        if (!accumulator[option.question_id]) {
            accumulator[option.question_id] = [];
        }
        accumulator[option.question_id].push(option);
        return accumulator;
    }, {});

    return {
        ...questionnaire,
        questions: questions.map((question) => ({
            ...question,
            options: optionsByQuestion[question.id] || []
        }))
    };
}

// GET /api/admin/questionnaires
router.get('/', requirePermission('events.view'), async (req, res, next) => {
    try {
        const {
            search,
            status = 'all',
            clientId,
            eventId,
            page = 1,
            pageSize = 25
        } = req.query;

        let whereClause = '1=1';
        const params = [];
        let paramIndex = 1;

        if (search) {
            whereClause += ` AND (q.title ILIKE $${paramIndex} OR q.title_ar ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex += 1;
        }
        if (status && status !== 'all') {
            whereClause += ` AND q.status = $${paramIndex}`;
            params.push(status);
            paramIndex += 1;
        }
        if (clientId) {
            whereClause += ` AND q.client_id = $${paramIndex}`;
            params.push(clientId);
            paramIndex += 1;
        }
        if (eventId) {
            whereClause += ` AND q.event_id = $${paramIndex}`;
            params.push(eventId);
            paramIndex += 1;
        }

        const { rows: countRows } = await pool.query(
            `SELECT COUNT(*)::int AS total FROM questionnaires q WHERE ${whereClause}`,
            params
        );
        const total = countRows[0]?.total || 0;
        const pageNumber = Math.max(Number.parseInt(page, 10) || 1, 1);
        const pageSizeNumber = Math.max(Number.parseInt(pageSize, 10) || 25, 1);
        const offset = (pageNumber - 1) * pageSizeNumber;

        const { rows } = await pool.query(
            `
            SELECT
                q.*,
                c.name AS client_name,
                c.name_ar AS client_name_ar,
                e.name AS event_name,
                e.name_ar AS event_name_ar,
                COALESCE(stats.question_count, 0)::int AS question_count,
                COALESCE(stats.submission_count, 0)::int AS submission_count
            FROM questionnaires q
            JOIN clients c ON c.id = q.client_id
            JOIN events e ON e.id = q.event_id
            LEFT JOIN (
                SELECT
                    qq.id AS questionnaire_id,
                    (SELECT COUNT(*) FROM questionnaire_questions qqq WHERE qqq.questionnaire_id = qq.id) AS question_count,
                    (SELECT COUNT(*) FROM questionnaire_submissions qs WHERE qs.questionnaire_id = qq.id) AS submission_count
                FROM questionnaires qq
            ) stats ON stats.questionnaire_id = q.id
            WHERE ${whereClause}
            ORDER BY q.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `,
            [...params, pageSizeNumber, offset]
        );

        res.json({
            data: rows,
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

// GET /api/admin/questionnaires/:id
router.get('/:id', requirePermission('events.view'), async (req, res, next) => {
    try {
        const questionnaire = await loadQuestionnaire(pool, req.params.id);
        if (!questionnaire) {
            throw new AppError('Questionnaire not found', 404, 'NOT_FOUND');
        }
        res.json({ data: questionnaire });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/questionnaires/:id/report
router.get('/:id/report', requirePermission('events.view'), async (req, res, next) => {
    try {
        const questionnaire = await loadQuestionnaire(pool, req.params.id);
        if (!questionnaire) {
            throw new AppError('Questionnaire not found', 404, 'NOT_FOUND');
        }

        const { rows: submissionRows } = await pool.query(
            `
            SELECT COUNT(*)::int AS submission_count
            FROM questionnaire_submissions
            WHERE questionnaire_id = $1
            `,
            [req.params.id]
        );

        const { rows: answerRows } = await pool.query(
            `
            SELECT
                qa.question_id,
                qq.question_type,
                qq.title,
                qq.title_ar,
                COUNT(*)::int AS total_answers
            FROM questionnaire_answers qa
            JOIN questionnaire_questions qq ON qq.id = qa.question_id
            JOIN questionnaire_submissions qs ON qs.id = qa.submission_id
            WHERE qs.questionnaire_id = $1
            GROUP BY qa.question_id, qq.question_type, qq.title, qq.title_ar
            ORDER BY qq.title ASC
            `,
            [req.params.id]
        );

        res.json({
            data: {
                questionnaire,
                summary: {
                    submission_count: submissionRows[0]?.submission_count || 0
                },
                questions: answerRows
            }
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/questionnaires
router.post('/', requirePermission('events.edit'), async (req, res, next) => {
    const client = await pool.connect();
    try {
        const {
            clientId,
            eventId,
            title,
            titleAr,
            description,
            descriptionAr,
            status = 'draft',
            startDate,
            endDate,
            settings = {},
            questions = []
        } = req.body;

        if (!clientId || !eventId || !normalizeText(title)) {
            throw new AppError('Client, event, and title are required', 400, 'VALIDATION_ERROR');
        }

        await ensureEventMatchesClient(client, clientId, eventId);
        const normalizedQuestions = normalizeQuestions(questions);
        const questionnaireId = uuidv4();

        await client.query('BEGIN');
        await client.query(
            `
            INSERT INTO questionnaires (
                id, client_id, event_id, title, title_ar, description, description_ar,
                status, start_date, end_date, settings, created_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11::jsonb, $12
            )
            `,
            [
                questionnaireId,
                clientId,
                eventId,
                normalizeText(title),
                normalizeOptionalText(titleAr),
                normalizeOptionalText(description),
                normalizeOptionalText(descriptionAr),
                normalizeStatus(status),
                normalizeDateOrNull(startDate),
                normalizeDateOrNull(endDate),
                JSON.stringify(normalizeJsonObject(settings, {})),
                req.user?.id || null
            ]
        );

        for (const question of normalizedQuestions) {
            const questionId = uuidv4();
            await client.query(
                `
                INSERT INTO questionnaire_questions (
                    id, questionnaire_id, question_type, title, title_ar, description, description_ar, is_required, sort_order, settings
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb
                )
                `,
                [
                    questionId,
                    questionnaireId,
                    question.questionType,
                    question.title,
                    question.titleAr,
                    question.description,
                    question.descriptionAr,
                    question.isRequired,
                    question.sortOrder,
                    JSON.stringify(question.settings || {})
                ]
            );

            for (const option of question.options) {
                await client.query(
                    `
                    INSERT INTO questionnaire_options (
                        id, question_id, label, label_ar, value, sort_order
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6
                    )
                    `,
                    [uuidv4(), questionId, option.label, option.labelAr, option.value, option.sortOrder]
                );
            }
        }

        await client.query('COMMIT');
        const created = await loadQuestionnaire(pool, questionnaireId);
        res.status(201).json({ data: created });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        client.release();
    }
});

// PUT /api/admin/questionnaires/:id
router.put('/:id', requirePermission('events.edit'), async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { rows: existingRows } = await client.query('SELECT * FROM questionnaires WHERE id = $1', [req.params.id]);
        if (!existingRows.length) {
            throw new AppError('Questionnaire not found', 404, 'NOT_FOUND');
        }
        const existing = existingRows[0];
        const {
            clientId,
            eventId,
            title,
            titleAr,
            description,
            descriptionAr,
            status,
            startDate,
            endDate,
            settings,
            questions = []
        } = req.body;

        const nextClientId = normalizeOptionalText(clientId) || existing.client_id;
        const nextEventId = normalizeOptionalText(eventId) || existing.event_id;
        await ensureEventMatchesClient(client, nextClientId, nextEventId);
        const normalizedQuestions = normalizeQuestions(questions);

        await client.query('BEGIN');
        await client.query(
            `
            UPDATE questionnaires
            SET
                client_id = $1,
                event_id = $2,
                title = COALESCE($3, title),
                title_ar = COALESCE($4, title_ar),
                description = COALESCE($5, description),
                description_ar = COALESCE($6, description_ar),
                status = $7,
                start_date = COALESCE($8, start_date),
                end_date = COALESCE($9, end_date),
                settings = COALESCE($10::jsonb, settings),
                updated_at = NOW()
            WHERE id = $11
            `,
            [
                nextClientId,
                nextEventId,
                normalizeOptionalText(title),
                normalizeOptionalText(titleAr),
                normalizeOptionalText(description),
                normalizeOptionalText(descriptionAr),
                normalizeStatus(typeof status === 'undefined' ? existing.status : status),
                typeof startDate === 'undefined' ? null : normalizeDateOrNull(startDate),
                typeof endDate === 'undefined' ? null : normalizeDateOrNull(endDate),
                typeof settings === 'undefined' ? null : JSON.stringify(normalizeJsonObject(settings, {})),
                req.params.id
            ]
        );

        await client.query(
            `
            DELETE FROM questionnaire_options
            WHERE question_id IN (
                SELECT id
                FROM questionnaire_questions
                WHERE questionnaire_id = $1
            )
            `,
            [req.params.id]
        );
        await client.query('DELETE FROM questionnaire_questions WHERE questionnaire_id = $1', [req.params.id]);

        for (const question of normalizedQuestions) {
            const questionId = uuidv4();
            await client.query(
                `
                INSERT INTO questionnaire_questions (
                    id, questionnaire_id, question_type, title, title_ar, description, description_ar, is_required, sort_order, settings
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb
                )
                `,
                [
                    questionId,
                    req.params.id,
                    question.questionType,
                    question.title,
                    question.titleAr,
                    question.description,
                    question.descriptionAr,
                    question.isRequired,
                    question.sortOrder,
                    JSON.stringify(question.settings || {})
                ]
            );

            for (const option of question.options) {
                await client.query(
                    `
                    INSERT INTO questionnaire_options (
                        id, question_id, label, label_ar, value, sort_order
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6
                    )
                    `,
                    [uuidv4(), questionId, option.label, option.labelAr, option.value, option.sortOrder]
                );
            }
        }

        await client.query('COMMIT');
        const updated = await loadQuestionnaire(pool, req.params.id);
        res.json({ data: updated });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        client.release();
    }
});

// PATCH /api/admin/questionnaires/:id/status
router.patch('/:id/status', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const { status } = req.body;
        const resolvedStatus = normalizeStatus(status);
        const { rows } = await pool.query('UPDATE questionnaires SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id', [resolvedStatus, req.params.id]);
        if (!rows.length) {
            throw new AppError('Questionnaire not found', 404, 'NOT_FOUND');
        }
        const updated = await loadQuestionnaire(pool, req.params.id);
        res.json({ data: updated });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/admin/questionnaires/:id
router.delete('/:id', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const { rows } = await pool.query('DELETE FROM questionnaires WHERE id = $1 RETURNING id', [req.params.id]);
        if (!rows.length) {
            throw new AppError('Questionnaire not found', 404, 'NOT_FOUND');
        }
        res.json({ message: 'Questionnaire deleted successfully' });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/questionnaires/overview-stats
router.get('/overview-stats', requirePermission('events.view'), async (req, res, next) => {
    try {
        const { clientId, eventId } = req.query;
        let whereClause = '1=1';
        const params = [];
        let paramIndex = 1;

        if (clientId) {
            whereClause += ` AND q.client_id = $${paramIndex}`;
            params.push(clientId);
            paramIndex += 1;
        }
        if (eventId) {
            whereClause += ` AND q.event_id = $${paramIndex}`;
            params.push(eventId);
            paramIndex += 1;
        }

        const { rows } = await pool.query(
            `
            SELECT
                COUNT(*)::int AS total_questionnaires,
                COUNT(*) FILTER (WHERE q.status = 'published')::int AS published_questionnaires,
                COUNT(*) FILTER (WHERE q.status = 'draft')::int AS draft_questionnaires,
                COUNT(*) FILTER (WHERE q.status = 'archived')::int AS archived_questionnaires
            FROM questionnaires q
            WHERE ${whereClause}
            `,
            params
        );

        res.json({ data: rows[0] || {} });
    } catch (error) {
        next(error);
    }
});

export default router;
