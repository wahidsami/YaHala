import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/connection.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// POST /api/admin/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new AppError('Email and password are required', 400, 'VALIDATION_ERROR');
        }

        // Find user with role
        const { rows } = await pool.query(
            `SELECT u.*, r.name as role_name 
       FROM dashboard_users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.email = $1`,
            [email]
        );

        if (!rows.length) {
            throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
        }

        const user = rows[0];

        // Check status
        if (user.status !== 'active') {
            throw new AppError('Account is not active', 403, 'ACCOUNT_INACTIVE');
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
        }

        // Get permissions
        const { rows: permRows } = await pool.query(
            'SELECT permission FROM role_permissions WHERE role_id = $1',
            [user.role_id]
        );
        const permissions = permRows.map(p => p.permission);

        // Generate tokens
        const accessToken = jwt.sign(
            { userId: user.id, email: user.email, role: user.role_name },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
        );

        const refreshToken = jwt.sign(
            { userId: user.id, tokenId: uuidv4() },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
        );

        // Store refresh token
        const tokenHash = await bcrypt.hash(refreshToken, 10);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await pool.query(
            'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
            [user.id, tokenHash, expiresAt]
        );

        // Update last login
        await pool.query('UPDATE dashboard_users SET last_login = NOW() WHERE id = $1', [user.id]);

        // Set refresh token cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role_name,
                permissions
            }
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/auth/refresh
router.post('/refresh', async (req, res, next) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            throw new AppError('Refresh token required', 401, 'NO_REFRESH_TOKEN');
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        } catch (e) {
            throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
        }

        // Get user
        const { rows } = await pool.query(
            `SELECT u.*, r.name as role_name 
       FROM dashboard_users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = $1`,
            [decoded.userId]
        );

        if (!rows.length || rows[0].status !== 'active') {
            throw new AppError('User not found or inactive', 401, 'USER_INVALID');
        }

        const user = rows[0];

        // Generate new access token
        const accessToken = jwt.sign(
            { userId: user.id, email: user.email, role: user.role_name },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
        );

        res.json({ accessToken });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/auth/logout
router.post('/logout', async (req, res, next) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (refreshToken) {
            try {
                const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
                await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [decoded.userId]);
            } catch (e) {
                // Token invalid, ignore
            }
        }

        res.clearCookie('refreshToken');
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/auth/me
router.get('/me', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new AppError('No token provided', 401, 'NO_TOKEN');
        }

        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        } catch (e) {
            throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
        }

        const { rows } = await pool.query(
            `SELECT u.id, u.email, u.name, r.name as role_name, r.id as role_id
       FROM dashboard_users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = $1`,
            [decoded.userId]
        );

        if (!rows.length) {
            throw new AppError('User not found', 404, 'USER_NOT_FOUND');
        }

        const user = rows[0];

        // Get permissions
        const { rows: permRows } = await pool.query(
            'SELECT permission FROM role_permissions WHERE role_id = $1',
            [user.role_id]
        );

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role_name,
                permissions: permRows.map(p => p.permission)
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
