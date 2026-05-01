import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

// GET /api/admin/events/:eventId/submissions
router.get('/:eventId/submissions', requirePermission('events.view'), async (req, res, next) => {
    try {
        const { eventId } = req.params;
        const { type, status, page = 1, pageSize = 25 } = req.query;

        let whereClause = 's.event_id = $1';
        const params = [eventId];
        let paramIndex = 2;

        if (type && type !== 'all') {
            whereClause += ` AND s.submission_type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }

        if (status && status !== 'all') {
            whereClause += ` AND s.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        const { rows: countRows } = await pool.query(
            `SELECT COUNT(*) as total FROM guest_submissions s WHERE ${whereClause}`,
            params
        );
        const total = parseInt(countRows[0].total);

        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        const { rows: submissions } = await pool.query(
            `SELECT s.*, g.name as guest_name, g.name_ar as guest_name_ar, g.guest_group
       FROM guest_submissions s
       LEFT JOIN guests g ON s.guest_id = g.id
       WHERE ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, parseInt(pageSize), offset]
        );

        res.json({
            data: submissions,
            pagination: { total, page: parseInt(page), pageSize: parseInt(pageSize), totalPages: Math.ceil(total / parseInt(pageSize)) }
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/admin/submissions/:id/approve
router.put('/submissions/:id/approve', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const { rows: existing } = await pool.query('SELECT id FROM guest_submissions WHERE id = $1', [req.params.id]);
        if (!existing.length) {
            throw new AppError('Submission not found', 404, 'NOT_FOUND');
        }

        await pool.query('UPDATE guest_submissions SET status = $1, updated_at = NOW() WHERE id = $2', ['approved', req.params.id]);
        res.json({ message: 'Submission approved' });
    } catch (error) {
        next(error);
    }
});

// PUT /api/admin/submissions/:id/hide
router.put('/submissions/:id/hide', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const { rows: existing } = await pool.query('SELECT id FROM guest_submissions WHERE id = $1', [req.params.id]);
        if (!existing.length) {
            throw new AppError('Submission not found', 404, 'NOT_FOUND');
        }

        await pool.query('UPDATE guest_submissions SET status = $1, updated_at = NOW() WHERE id = $2', ['hidden', req.params.id]);
        res.json({ message: 'Submission hidden' });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/submissions/bulk-approve
router.post('/submissions/bulk-approve', requirePermission('events.edit'), async (req, res, next) => {
    try {
        const { ids } = req.body;
        if (!ids?.length) {
            throw new AppError('No IDs provided', 400, 'VALIDATION_ERROR');
        }

        const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
        await pool.query(`UPDATE guest_submissions SET status = 'approved', updated_at = NOW() WHERE id IN (${placeholders})`, ids);
        res.json({ message: `${ids.length} submissions approved` });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/events/:eventId/submissions/stats
router.get('/:eventId/submissions/stats', requirePermission('events.view'), async (req, res, next) => {
    try {
        const { eventId } = req.params;

        const { rows: stats } = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN submission_type = 'voice' THEN 1 ELSE 0 END) as voice_count,
        SUM(CASE WHEN submission_type = 'text' THEN 1 ELSE 0 END) as text_count,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count
      FROM guest_submissions WHERE event_id = $1
    `, [eventId]);

        res.json({ data: stats[0] });
    } catch (error) {
        next(error);
    }
});

export default router;
