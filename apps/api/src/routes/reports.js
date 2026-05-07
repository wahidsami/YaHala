import { Router } from 'express';
import pool from '../db/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/overview', requirePermission('reports.view'), async (req, res, next) => {
    try {
        const { rows: summaryRows } = await pool.query(`
            SELECT
                (SELECT COUNT(*)::int FROM clients) AS clients_total,
                (SELECT COUNT(*)::int FROM events) AS events_total,
                (SELECT COUNT(*)::int FROM client_guests) AS guests_total,
                (SELECT COUNT(*)::int FROM clients WHERE status = 'active') AS active_clients,
                (SELECT COUNT(*)::int FROM events WHERE status = 'active') AS active_events,
                (SELECT COUNT(*)::int FROM scanner_users WHERE status = 'active') AS scanner_users
        `);

        const { rows: invitationRows } = await pool.query(`
            SELECT
                COUNT(*)::int AS total_recipients,
                COUNT(*) FILTER (WHERE overall_status = 'sent')::int AS sent_count,
                COUNT(*) FILTER (WHERE overall_status = 'delivered')::int AS delivered_count,
                COUNT(*) FILTER (WHERE overall_status = 'opened')::int AS opened_count,
                COUNT(*) FILTER (WHERE overall_status = 'responded')::int AS responded_count,
                COUNT(*) FILTER (WHERE overall_status = 'failed')::int AS failed_count,
                COUNT(*) FILTER (WHERE overall_status = 'opted_out')::int AS opted_out_count,
                COUNT(*) FILTER (WHERE responded_at IS NOT NULL)::int AS response_timestamp_count
            FROM invitation_recipients
        `);

        const { rows: rsvpRows } = await pool.query(`
            SELECT
                COUNT(*)::int AS total_submissions,
                COUNT(*) FILTER (WHERE LOWER(COALESCE(ir.response_data->>'attendance', '')) = 'attending')::int AS attending_count,
                COUNT(*) FILTER (WHERE LOWER(COALESCE(ir.response_data->>'attendance', '')) = 'not_attending')::int AS not_attending_count,
                COUNT(*) FILTER (WHERE LOWER(COALESCE(ir.response_data->>'attendance', '')) = 'maybe')::int AS maybe_count
            FROM invitation_module_responses ir
            JOIN invitation_modules m ON m.id = ir.module_id
            WHERE m.module_type = 'rsvp'
        `);

        const { rows: pollRows } = await pool.query(`
            SELECT
                COUNT(*)::int AS total_polls,
                COUNT(*) FILTER (WHERE status = 'published')::int AS published_polls,
                COUNT(*) FILTER (WHERE status = 'draft')::int AS draft_polls,
                COUNT(*) FILTER (WHERE status = 'ended')::int AS ended_polls,
                COUNT(*) FILTER (WHERE poll_mode = 'anonymous')::int AS anonymous_polls,
                COUNT(*) FILTER (WHERE poll_mode = 'named')::int AS named_polls
            FROM polls
        `);

        const { rows: questionnaireRows } = await pool.query(`
            SELECT
                COUNT(*)::int AS total_questionnaires,
                COUNT(*) FILTER (WHERE status = 'published')::int AS published_questionnaires,
                COUNT(*) FILTER (WHERE status = 'draft')::int AS draft_questionnaires,
                COUNT(*) FILTER (WHERE status = 'archived')::int AS archived_questionnaires,
                COALESCE((SELECT COUNT(*)::int FROM questionnaire_submissions), 0) AS total_submissions
            FROM questionnaires
        `);

        const { rows: recentResponses } = await pool.query(`
            SELECT
                ir.id,
                ir.submitted_at,
                ir.response_data,
                ir.recipient_id,
                r.display_name,
                r.display_name_ar,
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
            LIMIT 10
        `);

        const { rows: topProjects } = await pool.query(`
            SELECT
                p.id,
                p.name,
                p.name_ar,
                c.name AS client_name,
                c.name_ar AS client_name_ar,
                e.name AS event_name,
                e.name_ar AS event_name_ar,
                COUNT(r.id)::int AS recipient_count,
                COUNT(*) FILTER (WHERE r.overall_status = 'responded')::int AS responded_count,
                COUNT(*) FILTER (WHERE r.overall_status = 'opened')::int AS opened_count,
                COUNT(*) FILTER (WHERE r.overall_status = 'failed')::int AS failed_count
            FROM invitation_projects p
            JOIN clients c ON c.id = p.client_id
            JOIN events e ON e.id = p.event_id
            LEFT JOIN invitation_recipients r ON r.project_id = p.id
            GROUP BY p.id, c.id, e.id
            ORDER BY responded_count DESC, recipient_count DESC, p.created_at DESC
            LIMIT 10
        `);

        const { rows: topPolls } = await pool.query(`
            SELECT
                p.id,
                p.title,
                p.title_ar,
                p.status,
                p.poll_mode,
                c.name AS client_name,
                c.name_ar AS client_name_ar,
                e.name AS event_name,
                e.name_ar AS event_name_ar,
                COALESCE(vote_stats.total_votes, 0)::int AS total_votes,
                COALESCE(vote_stats.participants_count, 0)::int AS participants_count
            FROM polls p
            JOIN clients c ON c.id = p.client_id
            JOIN events e ON e.id = p.event_id
            LEFT JOIN (
                SELECT
                    poll_id,
                    COUNT(*)::int AS total_votes,
                    COUNT(DISTINCT COALESCE(guest_id::text, session_id))::int AS participants_count
                FROM poll_votes
                GROUP BY poll_id
            ) vote_stats ON vote_stats.poll_id = p.id
            ORDER BY total_votes DESC, participants_count DESC, p.created_at DESC
            LIMIT 10
        `);

        const { rows: topQuestionnaires } = await pool.query(`
            SELECT
                q.id,
                q.title,
                q.title_ar,
                q.status,
                c.name AS client_name,
                c.name_ar AS client_name_ar,
                e.name AS event_name,
                e.name_ar AS event_name_ar,
                COALESCE((SELECT COUNT(*)::int FROM questionnaire_questions qq WHERE qq.questionnaire_id = q.id), 0) AS question_count,
                COALESCE((SELECT COUNT(*)::int FROM questionnaire_submissions qs WHERE qs.questionnaire_id = q.id), 0) AS submission_count
            FROM questionnaires q
            JOIN clients c ON c.id = q.client_id
            JOIN events e ON e.id = q.event_id
            ORDER BY submission_count DESC, question_count DESC, q.created_at DESC
            LIMIT 10
        `);

        const { rows: recentActivity } = await pool.query(`
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

        res.json({
            data: {
                summary: summaryRows[0] || {},
                invitations: invitationRows[0] || {},
                rsvp: rsvpRows[0] || {},
                polls: pollRows[0] || {},
                questionnaires: questionnaireRows[0] || {},
                recentResponses,
                topProjects,
                topPolls,
                topQuestionnaires,
                recentActivity
            }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/events', requirePermission('reports.view'), async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                e.id,
                e.name,
                e.name_ar,
                e.status,
                e.start_datetime,
                e.end_datetime,
                e.event_logo_path,
                c.name AS client_name,
                c.name_ar AS client_name_ar,
                c.logo_path AS client_logo_path
            FROM events e
            JOIN clients c ON c.id = e.client_id
            ORDER BY e.start_datetime DESC NULLS LAST, e.created_at DESC
        `);

        res.json({ data: rows });
    } catch (error) {
        next(error);
    }
});

router.get('/events/:eventId', requirePermission('reports.view'), async (req, res, next) => {
    try {
        const { eventId } = req.params;
        const tableCheck = await pool.query(`SELECT to_regclass('public.event_walk_ins') AS walk_ins_table`);
        const hasWalkIns = Boolean(tableCheck.rows?.[0]?.walk_ins_table);

        const { rows: metaRows } = await pool.query(`
            SELECT
                e.id,
                e.name,
                e.name_ar,
                e.status,
                e.event_type,
                e.start_datetime,
                e.end_datetime,
                e.venue,
                e.location_mode,
                e.google_map_url,
                e.address_street,
                e.address_city,
                e.address_region,
                e.event_logo_path,
                c.id AS client_id,
                c.name AS client_name,
                c.name_ar AS client_name_ar,
                c.logo_path AS client_logo_path
            FROM events e
            JOIN clients c ON c.id = e.client_id
            WHERE e.id = $1
            LIMIT 1
        `, [eventId]);

        if (!metaRows.length) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const eventMeta = metaRows[0];

        const { rows: invitationStatsRows } = await pool.query(`
            SELECT
                COUNT(r.id)::int AS total_recipients,
                COUNT(*) FILTER (WHERE r.overall_status = 'sent')::int AS sent_count,
                COUNT(*) FILTER (WHERE r.overall_status = 'delivered')::int AS delivered_count,
                COUNT(*) FILTER (WHERE r.overall_status = 'opened')::int AS opened_count,
                COUNT(*) FILTER (WHERE r.overall_status = 'responded')::int AS responded_count,
                COUNT(*) FILTER (WHERE r.overall_status = 'failed')::int AS failed_count,
                COUNT(*) FILTER (WHERE r.overall_status = 'opted_out')::int AS opted_out_count,
                COUNT(*) FILTER (
                    WHERE COALESCE(r.metadata->>'attendance_status', r.metadata->>'check_in_status', '') IN ('attended', 'checked_in')
                )::int AS checked_in_count
            FROM invitation_projects p
            LEFT JOIN invitation_recipients r ON r.project_id = p.id
            WHERE p.event_id = $1
        `, [eventId]);

        const { rows: rsvpRows } = await pool.query(`
            SELECT
                COUNT(*)::int AS total_submissions,
                COUNT(*) FILTER (WHERE LOWER(COALESCE(mr.response_data->>'attendance', '')) = 'attending')::int AS attending_count,
                COUNT(*) FILTER (WHERE LOWER(COALESCE(mr.response_data->>'attendance', '')) = 'not_attending')::int AS not_attending_count,
                COUNT(*) FILTER (WHERE LOWER(COALESCE(mr.response_data->>'attendance', '')) = 'maybe')::int AS maybe_count
            FROM invitation_module_responses mr
            JOIN invitation_modules m ON m.id = mr.module_id AND m.module_type = 'rsvp'
            WHERE mr.event_id = $1
        `, [eventId]);

        let walkInStats = { walk_in_count: 0 };
        if (hasWalkIns) {
            const { rows } = await pool.query(`
                SELECT COUNT(*)::int AS walk_in_count
                FROM event_walk_ins
                WHERE event_id = $1
            `, [eventId]);
            walkInStats = rows[0] || walkInStats;
        }

        const { rows: attendeeRows } = await pool.query(`
            SELECT
                r.id AS recipient_id,
                r.public_token,
                r.display_name,
                r.display_name_ar,
                r.email,
                r.phone,
                r.overall_status,
                r.responded_at,
                r.opened_at,
                COALESCE(r.metadata->>'attendance_status', r.metadata->>'check_in_status', 'pending') AS attendance_status,
                cg.id AS guest_id,
                cg.position,
                cg.organization
            FROM invitation_projects p
            JOIN invitation_recipients r ON r.project_id = p.id
            LEFT JOIN client_guests cg ON cg.id = r.client_guest_id
            WHERE p.event_id = $1
            ORDER BY r.created_at DESC
        `, [eventId]);

        res.json({
            data: {
                event: eventMeta,
                invitationStats: invitationStatsRows[0] || {},
                rsvpStats: rsvpRows[0] || {},
                walkInStats,
                attendees: attendeeRows
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
