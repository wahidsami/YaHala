import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import pool from '../db/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { evaluateRules } from '../utils/ruleEngine.js';

const router = Router();
router.use(authenticate);

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

// GET /api/admin/templates
router.get('/', requirePermission('templates.view'), async (req, res, next) => {
    try {
        const { category, status, search, page = 1, pageSize = 25 } = req.query;

        let whereClause = '1=1';
        const params = [];
        let paramIndex = 1;

        if (category && category !== 'all') {
            whereClause += ` AND category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        if (status && status !== 'all') {
            whereClause += ` AND status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (search) {
            whereClause += ` AND (name ILIKE $${paramIndex} OR name_ar ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        const { rows: countRows } = await pool.query(
            `SELECT COUNT(*) as total FROM templates WHERE ${whereClause}`,
            params
        );
        const total = parseInt(countRows[0].total);

        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        const { rows: templates } = await pool.query(
            `SELECT id, name, name_ar, category, status, is_system, created_at, updated_at
      FROM templates WHERE ${whereClause}
      ORDER BY updated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, parseInt(pageSize), offset]
        );

        res.json({
            data: templates,
            pagination: { total, page: parseInt(page), pageSize: parseInt(pageSize), totalPages: Math.ceil(total / parseInt(pageSize)) }
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/templates/:id
router.get('/:id', requirePermission('templates.view'), async (req, res, next) => {
    try {
        const { rows: templates } = await pool.query('SELECT * FROM templates WHERE id = $1', [req.params.id]);

        if (!templates.length) {
            throw new AppError('Template not found', 404, 'NOT_FOUND');
        }

        const template = templates[0];
        res.json({
            data: {
                ...template,
                design_data_hash: computeDesignDataHash(template.design_data)
            }
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/templates
router.post('/', requirePermission('templates.create'), async (req, res, next) => {
    try {
        const { name, nameAr, category = 'custom', designData } = req.body;

        if (!name || !designData) {
            throw new AppError('Name and designData are required', 400, 'VALIDATION_ERROR');
        }

        const id = uuidv4();
        await pool.query(
            `INSERT INTO templates (id, name, name_ar, category, design_data, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, name, nameAr, category, JSON.stringify(designData), req.user.id]
        );

        const { rows: newTemplate } = await pool.query('SELECT * FROM templates WHERE id = $1', [id]);

        res.status(201).json({
            data: {
                ...newTemplate[0],
                design_data_hash: computeDesignDataHash(newTemplate[0].design_data)
            }
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/admin/templates/:id
router.put('/:id', requirePermission('templates.edit'), async (req, res, next) => {
    try {
        const { name, nameAr, category, status, designData } = req.body;

        const { rows: existing } = await pool.query('SELECT id FROM templates WHERE id = $1', [req.params.id]);
        if (!existing.length) {
            throw new AppError('Template not found', 404, 'NOT_FOUND');
        }

        // Save version
        if (designData) {
            const { rows: current } = await pool.query('SELECT design_data FROM templates WHERE id = $1', [req.params.id]);
            const { rows: versionCount } = await pool.query('SELECT COUNT(*) as count FROM template_versions WHERE template_id = $1', [req.params.id]);
            await pool.query(
                `INSERT INTO template_versions (id, template_id, version, design_data) VALUES ($1, $2, $3, $4)`,
                [uuidv4(), req.params.id, parseInt(versionCount[0].count) + 1, current[0].design_data]
            );
        }

        await pool.query(
            `UPDATE templates SET
        name = COALESCE($1, name),
        name_ar = COALESCE($2, name_ar),
        category = COALESCE($3, category),
        status = COALESCE($4, status),
        design_data = COALESCE($5, design_data),
        updated_at = NOW()
      WHERE id = $6`,
            [name, nameAr, category, status, designData ? JSON.stringify(designData) : null, req.params.id]
        );

        const { rows: updated } = await pool.query('SELECT * FROM templates WHERE id = $1', [req.params.id]);

        res.json({
            data: {
                ...updated[0],
                design_data_hash: computeDesignDataHash(updated[0].design_data)
            }
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/templates/:id/clone
router.post('/:id/clone', requirePermission('templates.create'), async (req, res, next) => {
    try {
        const { rows: source } = await pool.query('SELECT * FROM templates WHERE id = $1', [req.params.id]);
        if (!source.length) {
            throw new AppError('Template not found', 404, 'NOT_FOUND');
        }

        const { name } = req.body;
        const newId = uuidv4();
        const newName = name || `${source[0].name} (Copy)`;

        await pool.query(
            `INSERT INTO templates (id, name, name_ar, category, design_data, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [newId, newName, source[0].name_ar, source[0].category, source[0].design_data, req.user.id]
        );

        const { rows: newTemplate } = await pool.query('SELECT * FROM templates WHERE id = $1', [newId]);

        res.status(201).json({
            data: {
                ...newTemplate[0],
                design_data_hash: computeDesignDataHash(newTemplate[0].design_data)
            }
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/admin/templates/:id
router.delete('/:id', requirePermission('templates.delete'), async (req, res, next) => {
    try {
        const { rows: existing } = await pool.query('SELECT id, is_system FROM templates WHERE id = $1', [req.params.id]);
        if (!existing.length) {
            throw new AppError('Template not found', 404, 'NOT_FOUND');
        }

        if (existing[0].is_system) {
            throw new AppError('Cannot delete system template', 400, 'SYSTEM_TEMPLATE');
        }

        await pool.query('UPDATE templates SET status = $1, updated_at = NOW() WHERE id = $2', ['archived', req.params.id]);
        res.json({ message: 'Template archived' });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/templates/:id/preview
router.post('/:id/preview', requirePermission('templates.view'), async (req, res, next) => {
    try {
        const { timeState = 'before_event', scanState = 'not_scanned', language = 'ar', guestGroup = 'regular', eventType = 'wedding' } = req.body;

        const { rows: templates } = await pool.query('SELECT design_data FROM templates WHERE id = $1', [req.params.id]);
        if (!templates.length) {
            throw new AppError('Template not found', 404, 'NOT_FOUND');
        }

        const designData = templates[0].design_data;

        const context = {
            time: { state: timeState },
            scan: { status: scanState },
            guest: { group: guestGroup },
            event: { type: eventType },
            language
        };

        const result = { context, sections: {}, debug: [], layout: designData.layout || {} };

        for (const [sectionId, section] of Object.entries(designData.sections || {})) {
            result.sections[sectionId] = {
                widgets: (section.widgets || []).map(widget => {
                    const { visible, reason } = evaluateRules(widget, context);
                    result.debug.push({ widgetId: widget.id, widgetType: widget.type, visible, reason });
                    return { ...widget, _visible: visible, _reason: reason };
                })
            };
        }

        res.json({
            data: {
                ...result,
                design_data_hash: computeDesignDataHash(designData)
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
