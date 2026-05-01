import { Router } from 'express';
import pool from '../db/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/summary', requirePermission('dashboard.view'), async (req, res, next) => {
    try {
        const { rows: totalsRows } = await pool.query(`
            SELECT
                (SELECT COUNT(*)::int FROM clients) AS clients_total,
                (SELECT COUNT(*)::int FROM events) AS events_total,
                (SELECT COUNT(*)::int FROM guests) AS guests_total,
                (SELECT COUNT(*)::int FROM activity_logs WHERE action IN ('guest_attended', 'duplicate_scan')) AS scans_total,
                (SELECT COUNT(*)::int FROM events WHERE status = 'active') AS active_events,
                (SELECT COUNT(*)::int FROM clients WHERE status = 'active') AS active_clients,
                (SELECT COUNT(*)::int FROM scanner_users WHERE status = 'active') AS scanner_users
        `);

        const { rows: monthlyTrendRows } = await pool.query(`
            WITH months AS (
                SELECT generate_series(
                    date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
                    date_trunc('month', CURRENT_DATE),
                    INTERVAL '1 month'
                )::date AS month_start
            ),
            client_counts AS (
                SELECT date_trunc('month', created_at)::date AS month_start, COUNT(*)::int AS count
                FROM clients
                GROUP BY 1
            ),
            event_counts AS (
                SELECT date_trunc('month', created_at)::date AS month_start, COUNT(*)::int AS count
                FROM events
                GROUP BY 1
            ),
            guest_counts AS (
                SELECT date_trunc('month', created_at)::date AS month_start, COUNT(*)::int AS count
                FROM guests
                GROUP BY 1
            ),
            scan_counts AS (
                SELECT date_trunc('month', created_at)::date AS month_start, COUNT(*)::int AS count
                FROM activity_logs
                WHERE action IN ('guest_attended', 'duplicate_scan')
                GROUP BY 1
            )
            SELECT
                to_char(m.month_start, 'Mon YYYY') AS label,
                COALESCE(c.count, 0)::int AS clients,
                COALESCE(e.count, 0)::int AS events,
                COALESCE(g.count, 0)::int AS guests,
                COALESCE(s.count, 0)::int AS scans
            FROM months m
            LEFT JOIN client_counts c USING (month_start)
            LEFT JOIN event_counts e USING (month_start)
            LEFT JOIN guest_counts g USING (month_start)
            LEFT JOIN scan_counts s USING (month_start)
            ORDER BY m.month_start ASC
        `);

        const { rows: eventStatusRows } = await pool.query(`
            SELECT status, COUNT(*)::int AS count
            FROM events
            GROUP BY status
            ORDER BY count DESC, status ASC
        `);

        const { rows: recentActivityRows } = await pool.query(`
            SELECT
                al.id,
                al.action,
                al.user_type,
                al.entity_type,
                al.entity_id,
                al.details,
                al.created_at,
                COALESCE(du.name, su.name, 'System') AS actor_name
            FROM activity_logs al
            LEFT JOIN dashboard_users du
                ON al.user_type = 'admin' AND du.id = al.user_id
            LEFT JOIN scanner_users su
                ON al.user_type = 'scanner' AND su.id = al.user_id
            ORDER BY al.created_at DESC
            LIMIT 10
        `);

        const { rows: recentRsvpRows } = await pool.query(`
            SELECT
                ir.id,
                ir.submitted_at,
                ir.response_data,
                ir.recipient_id,
                r.display_name,
                r.display_name_ar,
                p.id AS project_id,
                p.name AS project_name,
                p.name_ar AS project_name_ar,
                e.name AS event_name,
                e.name_ar AS event_name_ar
            FROM invitation_module_responses ir
            JOIN invitation_modules m ON m.id = ir.module_id AND m.module_type = 'rsvp'
            JOIN invitation_recipients r ON r.id = ir.recipient_id
            JOIN invitation_projects p ON p.id = ir.project_id
            JOIN events e ON e.id = p.event_id
            ORDER BY ir.submitted_at DESC
            LIMIT 5
        `);

        res.json({
            data: {
                totals: totalsRows[0] || {},
                monthlyTrend: monthlyTrendRows,
                eventStatusBreakdown: eventStatusRows,
                recentRsvpResponses: recentRsvpRows,
                recentActivity: recentActivityRows.map((row) => ({
                    id: row.id,
                    action: row.action,
                    userType: row.user_type,
                    entityType: row.entity_type,
                    entityId: row.entity_id,
                    details: row.details,
                    createdAt: row.created_at,
                    actorName: row.actor_name
                }))
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
