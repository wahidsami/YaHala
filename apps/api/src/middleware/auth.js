import jwt from 'jsonwebtoken';
import pool from '../db/connection.js';
import { AppError } from './errorHandler.js';

export async function authenticate(req, res, next) {
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
            if (e.name === 'TokenExpiredError') {
                throw new AppError('Token expired', 401, 'TOKEN_EXPIRED');
            }
            throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
        }

        // Get user with permissions
        const { rows } = await pool.query(
            `SELECT u.id, u.email, u.name, u.status, r.name as role_name, r.id as role_id
       FROM dashboard_users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = $1`,
            [decoded.userId]
        );

        if (!rows.length) {
            throw new AppError('User not found', 401, 'USER_NOT_FOUND');
        }

        const user = rows[0];

        if (user.status !== 'active') {
            throw new AppError('Account inactive', 403, 'ACCOUNT_INACTIVE');
        }

        // Get permissions
        const { rows: permRows } = await pool.query(
            'SELECT permission FROM role_permissions WHERE role_id = $1',
            [user.role_id]
        );

        req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role_name,
            permissions: permRows.map(p => p.permission)
        };

        next();
    } catch (error) {
        next(error);
    }
}

export function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED'));
        }

        if (!req.user.permissions.includes(permission)) {
            return next(new AppError('Permission denied', 403, 'PERMISSION_DENIED'));
        }

        next();
    };
}
