import { Router } from 'express';
import pool from '../db/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function buildWhereClause(filters, params) {
    let whereClause = '1=1';
    let paramIndex = 1;

    const search = normalizeText(filters.search);
    if (search) {
        whereClause += ` AND (
            al.action ILIKE $${paramIndex}
            OR COALESCE(al.entity_type, '') ILIKE $${paramIndex}
            OR COALESCE(al.details::text, '') ILIKE $${paramIndex}
            OR COALESCE(al.ip_address, '') ILIKE $${paramIndex}
            OR COALESCE(du.name, su.name, 'System') ILIKE $${paramIndex}
            OR COALESCE(du.email, '') ILIKE $${paramIndex}
        )`;
        params.push(`%${search}%`);
        paramIndex += 1;
    }

    if (filters.action && filters.action !== 'all') {
        whereClause += ` AND al.action = $${paramIndex}`;
        params.push(normalizeText(filters.action));
        paramIndex += 1;
    }

    if (filters.userType && filters.userType !== 'all') {
        whereClause += ` AND al.user_type = $${paramIndex}`;
        params.push(normalizeText(filters.userType));
        paramIndex += 1;
    }

    if (filters.entityType && filters.entityType !== 'all') {
        whereClause += ` AND al.entity_type = $${paramIndex}`;
        params.push(normalizeText(filters.entityType));
        paramIndex += 1;
    }

    if (filters.entityId) {
        whereClause += ` AND al.entity_id = $${paramIndex}::uuid`;
        params.push(normalizeText(filters.entityId));
        paramIndex += 1;
    }

    if (filters.fromDate) {
        whereClause += ` AND al.created_at::date >= $${paramIndex}::date`;
        params.push(normalizeText(filters.fromDate));
        paramIndex += 1;
    }

    if (filters.toDate) {
        whereClause += ` AND al.created_at::date <= $${paramIndex}::date`;
        params.push(normalizeText(filters.toDate));
        paramIndex += 1;
    }

    return { whereClause, params };
}

function resolveSortColumn(sortBy) {
    const mapping = {
        created_at: 'al.created_at',
        action: 'al.action',
        user_type: 'al.user_type',
        entity_type: 'al.entity_type',
        actor_name: 'actor_name',
        entity_id: 'al.entity_id'
    };

    return mapping[sortBy] || 'al.created_at';
}

function parseJsonDetails(details) {
    if (!details || typeof details !== 'object') {
        return {};
    }

    return details;
}

router.get('/', requirePermission('logs.view'), async (req, res, next) => {
    try {
        const {
            search,
            action = 'all',
            userType = 'all',
            entityType = 'all',
            entityId = '',
            fromDate = '',
            toDate = '',
            page = 1,
            pageSize = 25,
            sortBy = 'created_at',
            sortOrder = 'desc'
        } = req.query;

        const params = [];
        const { whereClause } = buildWhereClause(
            {
                search,
                action,
                userType,
                entityType,
                entityId,
                fromDate,
                toDate
            },
            params
        );

        const baseFromClause = `
            FROM activity_logs al
            LEFT JOIN dashboard_users du
                ON al.user_type = 'admin' AND du.id = al.user_id
            LEFT JOIN scanner_users su
                ON al.user_type = 'scanner' AND su.id = al.user_id
        `;

        const { rows: summaryRows } = await pool.query(
            `
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE al.user_type = 'admin')::int AS admin_actions,
                COUNT(*) FILTER (WHERE al.user_type = 'scanner')::int AS scanner_actions,
                COUNT(*) FILTER (WHERE al.action = 'guest_attended')::int AS guest_attended,
                COUNT(*) FILTER (WHERE al.action = 'duplicate_scan')::int AS duplicate_scans
            ${baseFromClause}
            WHERE ${whereClause}
            `,
            params
        );

        const validSortColumns = new Set(['created_at', 'action', 'user_type', 'entity_type', 'actor_name', 'entity_id']);
        const sortColumn = resolveSortColumn(validSortColumns.has(sortBy) ? sortBy : 'created_at');
        const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
        const limit = Math.max(1, parseInt(pageSize, 10) || 25);
        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const offset = (currentPage - 1) * limit;

        const { rows: logs } = await pool.query(
            `
            SELECT
                al.id,
                al.user_id,
                al.user_type,
                al.action,
                al.entity_type,
                al.entity_id,
                al.details,
                al.ip_address,
                al.created_at,
                COALESCE(du.name, su.name, 'System') AS actor_name,
                COALESCE(du.email, '') AS actor_email,
                CASE
                    WHEN al.user_type = 'admin' THEN 'Admin'
                    WHEN al.user_type = 'scanner' THEN 'Scanner'
                    ELSE 'System'
                END AS actor_role
            ${baseFromClause}
            WHERE ${whereClause}
            ORDER BY ${sortColumn} ${order}
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
            `,
            [...params, limit, offset]
        );

        const total = summaryRows[0]?.total || 0;

        res.json({
            data: logs.map((log) => ({
                ...log,
                details: parseJsonDetails(log.details)
            })),
            summary: summaryRows[0] || {},
            pagination: {
                total,
                page: currentPage,
                pageSize: limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
