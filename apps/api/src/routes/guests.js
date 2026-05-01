import { Router } from 'express';
import pool from '../db/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function buildGuestWhereClause({ search, status, gender, clientId }, params) {
    let whereClause = '1=1';
    let paramIndex = 1;

    if (clientId && clientId !== 'all') {
        whereClause += ` AND cg.client_id = $${paramIndex}`;
        params.push(clientId);
        paramIndex += 1;
    }

    const term = normalizeText(search);
    if (term) {
        whereClause += ` AND (
            cg.name ILIKE $${paramIndex}
            OR cg.position ILIKE $${paramIndex}
            OR cg.organization ILIKE $${paramIndex}
            OR cg.email ILIKE $${paramIndex}
            OR cg.mobile_number ILIKE $${paramIndex}
            OR c.name ILIKE $${paramIndex}
            OR c.name_ar ILIKE $${paramIndex}
        )`;
        params.push(`%${term}%`);
        paramIndex += 1;
    }

    if (status && status !== 'all') {
        whereClause += ` AND cg.status = $${paramIndex}`;
        params.push(normalizeText(status).toLowerCase());
        paramIndex += 1;
    }

    if (gender && gender !== 'all') {
        whereClause += ` AND cg.gender = $${paramIndex}`;
        params.push(normalizeText(gender).toLowerCase());
        paramIndex += 1;
    }

    return { whereClause, params, paramIndex };
}

function resolveSortColumn(sortBy) {
    const mapping = {
        name: 'cg.name',
        position: 'cg.position',
        organization: 'cg.organization',
        email: 'cg.email',
        mobile_number: 'cg.mobile_number',
        status: 'cg.status',
        gender: 'cg.gender',
        client_name: 'c.name',
        invitation_count: 'invitation_count',
        responded_count: 'responded_count',
        created_at: 'cg.created_at'
    };

    return mapping[sortBy] || 'cg.created_at';
}

router.get('/', requirePermission('clients.view'), async (req, res, next) => {
    try {
        const {
            search,
            status,
            gender,
            clientId,
            page = 1,
            pageSize = 25,
            sortBy = 'created_at',
            sortOrder = 'desc'
        } = req.query;

        const params = [];
        const { whereClause } = buildGuestWhereClause({ search, status, gender, clientId }, params);

        const { rows: summaryRows } = await pool.query(
            `
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE cg.status = 'active')::int AS active,
                COUNT(*) FILTER (WHERE cg.status = 'banned')::int AS banned,
                COUNT(*) FILTER (WHERE EXISTS (
                    SELECT 1 FROM invitation_recipients r WHERE r.client_guest_id = cg.id
                ))::int AS invited,
                COUNT(*) FILTER (WHERE EXISTS (
                    SELECT 1 FROM invitation_recipients r
                    WHERE r.client_guest_id = cg.id AND r.overall_status = 'responded'
                ))::int AS responded
            FROM client_guests cg
            LEFT JOIN clients c ON c.id = cg.client_id
            WHERE ${whereClause}
            `,
            params
        );

        const total = summaryRows[0]?.total || 0;
        const validSortColumns = new Set([
            'name',
            'position',
            'organization',
            'email',
            'mobile_number',
            'status',
            'gender',
            'client_name',
            'invitation_count',
            'responded_count',
            'created_at'
        ]);
        const sortColumn = resolveSortColumn(validSortColumns.has(sortBy) ? sortBy : 'created_at');
        const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
        const limit = Math.max(1, parseInt(pageSize, 10) || 25);
        const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;

        const { rows: guests } = await pool.query(
            `
            SELECT
                cg.*,
                c.name AS client_name,
                c.name_ar AS client_name_ar,
                COALESCE(inv.invitation_count, 0)::int AS invitation_count,
                COALESCE(inv.responded_count, 0)::int AS responded_count,
                inv.last_invited_at
            FROM client_guests cg
            LEFT JOIN clients c ON c.id = cg.client_id
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(*)::int AS invitation_count,
                    COUNT(*) FILTER (WHERE r.overall_status = 'responded')::int AS responded_count,
                    MAX(r.created_at) AS last_invited_at
                FROM invitation_recipients r
                WHERE r.client_guest_id = cg.id
            ) inv ON true
            WHERE ${whereClause}
            ORDER BY ${sortColumn} ${order}
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
            `,
            [...params, limit, offset]
        );

        res.json({
            data: guests,
            summary: summaryRows[0] || {},
            pagination: {
                total,
                page: Math.max(1, parseInt(page, 10) || 1),
                pageSize: limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
