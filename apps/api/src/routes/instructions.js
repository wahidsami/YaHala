import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

const INSTRUCTION_STATUSES = new Set(['draft', 'published', 'archived']);

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

function normalizeStatus(value) {
    const status = normalizeText(value) || 'draft';
    if (!INSTRUCTION_STATUSES.has(status)) {
        throw new AppError('Instruction status is invalid', 400, 'VALIDATION_ERROR');
    }
    return status;
}

// GET /api/admin/instructions
router.get('/', requirePermission('events.view'), async (req, res, next) => {
    try {
        const { search, status = 'all', clientId, page = 1, pageSize = 25 } = req.query;

        let whereClause = '1=1';
        const params = [];
        let paramIndex = 1;

        if (search) {
            whereClause += ` AND (i.name ILIKE $${paramIndex} OR i.name_ar ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex += 1;
        }

        if (status && status !== 'all') {
            whereClause += ` AND i.status = $${paramIndex}`;
            params.push(status);
            paramIndex += 1;
        }

        if (clientId) {
            whereClause += ` AND i.client_id = $${paramIndex}`;
            params.push(clientId);
            paramIndex += 1;
        }

        const pageNumber = Math.max(Number.parseInt(page, 10) || 1, 1);
        const pageSizeNumber = Math.max(Number.parseInt(pageSize, 10) || 25, 1);
        const offset = (pageNumber - 1) * pageSizeNumber;

        const { rows: countRows } = await pool.query(
            `SELECT COUNT(*)::int AS total FROM instructions i WHERE ${whereClause}`,
            params
        );
        const total = countRows[0]?.total || 0;

        const { rows } = await pool.query(
            `
            SELECT
                i.id,
                i.client_id,
                i.name,
                i.name_ar,
                i.status,
                i.created_at,
                i.updated_at,
                c.name AS client_name,
                c.name_ar AS client_name_ar
            FROM instructions i
            JOIN clients c ON c.id = i.client_id
            WHERE ${whereClause}
            ORDER BY i.created_at DESC
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

// GET /api/admin/instructions/:id
router.get('/:id', requirePermission('events.view'), async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            `
            SELECT
                i.*,
                c.name AS client_name,
                c.name_ar AS client_name_ar
            FROM instructions i
            JOIN clients c ON c.id = i.client_id
            WHERE i.id = $1
            LIMIT 1
            `,
            [req.params.id]
        );

        if (!rows.length) {
            throw new AppError('Instruction not found', 404, 'NOT_FOUND');
        }

        res.json({ data: rows[0] });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/instructions
router.post('/', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const { clientId, name, nameAr, status = 'draft', contentSchema = {}, editorSettings = {} } = req.body;

        if (!clientId) {
            throw new AppError('Client is required', 400, 'VALIDATION_ERROR');
        }

        const normalizedName = normalizeText(name);
        if (!normalizedName) {
            throw new AppError('Instruction name is required', 400, 'VALIDATION_ERROR');
        }

        const { rows: clients } = await pool.query('SELECT id FROM clients WHERE id = $1 LIMIT 1', [clientId]);
        if (!clients.length) {
            throw new AppError('Client not found', 404, 'CLIENT_NOT_FOUND');
        }

        const id = uuidv4();
        await pool.query(
            `
            INSERT INTO instructions (
                id, client_id, name, name_ar, status, content_schema, editor_settings, created_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8
            )
            `,
            [
                id,
                clientId,
                normalizedName,
                normalizeOptionalText(nameAr),
                normalizeStatus(status),
                JSON.stringify(normalizeJsonObject(contentSchema, {})),
                JSON.stringify(normalizeJsonObject(editorSettings, {})),
                req.user?.id || null
            ]
        );

        const { rows: createdRows } = await pool.query(
            'SELECT * FROM instructions WHERE id = $1 LIMIT 1',
            [id]
        );

        res.status(201).json({ data: createdRows[0] });
    } catch (error) {
        next(error);
    }
});

// PUT /api/admin/instructions/:id
router.put('/:id', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const { rows: existingRows } = await pool.query('SELECT * FROM instructions WHERE id = $1 LIMIT 1', [req.params.id]);
        if (!existingRows.length) {
            throw new AppError('Instruction not found', 404, 'NOT_FOUND');
        }

        const existing = existingRows[0];
        const { clientId, name, nameAr, status, contentSchema, editorSettings } = req.body;

        const nextName = normalizeText(name);
        if (!nextName) {
            throw new AppError('Instruction name is required', 400, 'VALIDATION_ERROR');
        }

        const nextClientId = normalizeOptionalText(clientId) || existing.client_id;
        const { rows: clients } = await pool.query('SELECT id FROM clients WHERE id = $1 LIMIT 1', [nextClientId]);
        if (!clients.length) {
            throw new AppError('Client not found', 404, 'CLIENT_NOT_FOUND');
        }

        await pool.query(
            `
            UPDATE instructions
            SET
                client_id = $1,
                name = $2,
                name_ar = $3,
                status = $4,
                content_schema = $5::jsonb,
                editor_settings = $6::jsonb,
                updated_at = NOW()
            WHERE id = $7
            `,
            [
                nextClientId,
                nextName,
                normalizeOptionalText(nameAr),
                normalizeStatus(status || existing.status),
                JSON.stringify(normalizeJsonObject(contentSchema, existing.content_schema || {})),
                JSON.stringify(normalizeJsonObject(editorSettings, existing.editor_settings || {})),
                req.params.id
            ]
        );

        const { rows: updatedRows } = await pool.query('SELECT * FROM instructions WHERE id = $1 LIMIT 1', [req.params.id]);
        res.json({ data: updatedRows[0] });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/admin/instructions/:id
router.delete('/:id', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const { rows } = await pool.query('DELETE FROM instructions WHERE id = $1 RETURNING id', [req.params.id]);
        if (!rows.length) {
            throw new AppError('Instruction not found', 404, 'NOT_FOUND');
        }
        res.json({ message: 'Instruction deleted successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;
