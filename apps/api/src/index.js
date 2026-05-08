import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import clientRoutes from './routes/clients.js';
import eventRoutes from './routes/events.js';
import invitationProjectRoutes from './routes/invitationProjects.js';
import deliveryRoutes from './routes/delivery.js';
import publicInvitationRoutes from './routes/publicInvitations.js';
import scannerRoutes from './routes/scanner.js';
import logsRoutes from './routes/activityLogs.js';
import templateRoutes from './routes/templates.js';
import submissionRoutes from './routes/submissions.js';
import memoryBookRoutes from './routes/memoryBook.js';
import clientGuestRoutes from './routes/clientGuests.js';
import guestRoutes from './routes/guests.js';
import reportsRoutes from './routes/reports.js';
import pollRoutes from './routes/polls.js';
import questionnaireRoutes from './routes/questionnaires.js';
import instructionsRoutes from './routes/instructions.js';
import pool from './db/connection.js';
import { errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const allowAnyLocalhostInDev = process.env.NODE_ENV !== 'production';
const localhostOriginPattern = /^https?:\/\/localhost(?::\d+)?$/i;

// Middleware
app.use(cors({
    origin(origin, callback) {
        const isAllowedLocalhost = allowAnyLocalhostInDev && origin && localhostOriginPattern.test(origin);
        if (!origin || allowedOrigins.includes(origin) || isAllowedLocalhost) {
            return callback(null, true);
        }

        return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(cookieParser());

// Static files for memory books
app.use('/storage', express.static(path.join(__dirname, '../storage')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/admin/auth', authRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api/admin/clients', clientRoutes);
app.use('/api/admin/clients', clientGuestRoutes);
app.use('/api/admin/guests', guestRoutes);
app.use('/api/admin/events', eventRoutes);
app.use('/api/admin/invitation-projects', invitationProjectRoutes);
app.use('/api/admin/templates', templateRoutes);
app.use('/api/admin/events', submissionRoutes);
app.use('/api/admin/events', memoryBookRoutes);
app.use('/api/admin/polls', pollRoutes);
app.use('/api/admin/questionnaires', questionnaireRoutes);
app.use('/api/admin/instructions', instructionsRoutes);
app.use('/api/admin/logs', logsRoutes);
app.use('/api/admin/reports', reportsRoutes);
app.use('/api/admin/delivery', deliveryRoutes);
app.use('/api/public/invitations', publicInvitationRoutes);
app.use('/api/scanner', scannerRoutes);

// Error handler
app.use(errorHandler);

async function ensureCriticalSchema() {
    const { rows } = await pool.query(
        `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'scanner_users'
          AND column_name = 'event_id'
        LIMIT 1
        `
    );

    if (!rows.length) {
        throw new Error('Missing required database column public.scanner_users.event_id. Run migrations before starting API.');
    }
}

async function startServer() {
    await ensureCriticalSchema();
    app.listen(PORT, () => {
        console.log(`🚀 API running on http://localhost:${PORT}`);
    });
}

startServer().catch((error) => {
    console.error('❌ API startup failed:', error.message);
    process.exit(1);
});
