import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { saveClientGuestAvatar } from '../services/clientGuestAssets.js';

const router = Router();

const GENDER_VALUES = new Set(['male', 'female', 'other']);
const STATUS_VALUES = new Set(['active', 'banned']);

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalText(value) {
    const text = normalizeText(value);
    return text || null;
}

function validateEmail(value) {
    const email = normalizeOptionalText(value);
    if (!email) {
        return null;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        throw new AppError('Email is invalid', 400, 'VALIDATION_ERROR');
    }

    return email;
}

function validateSaudiMobileNumber(value) {
    const mobileNumber = normalizeOptionalText(value);
    if (!mobileNumber) {
        return null;
    }

    const sanitized = mobileNumber.replace(/[\s()-]/g, '');

    if (/^05\d{8}$/.test(sanitized)) {
        return sanitized;
    }

    if (/^\+9665\d{8}$/.test(sanitized)) {
        return `0${sanitized.slice(4)}`;
    }

    throw new AppError('Enter a valid mobile number', 400, 'VALIDATION_ERROR');
}

function normalizeGender(value) {
    const text = normalizeText(value).toLowerCase();
    if (!text) {
        return 'male';
    }

    if (!GENDER_VALUES.has(text)) {
        throw new AppError('Gender is invalid', 400, 'VALIDATION_ERROR');
    }

    return text;
}

function normalizeStatus(value) {
    const text = normalizeText(value).toLowerCase();
    if (!text) {
        return 'active';
    }

    if (!STATUS_VALUES.has(text)) {
        throw new AppError('Status is invalid', 400, 'VALIDATION_ERROR');
    }

    return text;
}

async function findDuplicateGuest(db, clientId, { name, organization, email, mobileNumber }, excludeGuestId = null) {
    const clauses = ['client_id = $1'];
    const params = [clientId];
    let paramIndex = 2;

    if (excludeGuestId) {
        clauses.push(`id <> $${paramIndex}`);
        params.push(excludeGuestId);
        paramIndex += 1;
    }

    const normalizedName = normalizeText(name);
    const normalizedOrganization = normalizeOptionalText(organization);
    const normalizedEmail = normalizeOptionalText(email);
    const normalizedMobile = normalizeOptionalText(mobileNumber);

    clauses.push(`LOWER(name) = LOWER($${paramIndex})`);
    params.push(normalizedName);
    paramIndex += 1;

    clauses.push(`COALESCE(LOWER(organization), '') = COALESCE(LOWER($${paramIndex}), '')`);
    params.push(normalizedOrganization);
    paramIndex += 1;

    clauses.push(`COALESCE(LOWER(email), '') = COALESCE(LOWER($${paramIndex}), '')`);
    params.push(normalizedEmail);
    paramIndex += 1;

    clauses.push(`COALESCE(mobile_number, '') = COALESCE($${paramIndex}, '')`);
    params.push(normalizedMobile);
    paramIndex += 1;

    const { rows } = await db.query(
        `SELECT id, name, email, mobile_number FROM client_guests WHERE ${clauses.join(' AND ')} LIMIT 1`,
        params
    );

    return rows[0] || null;
}

function normalizeGuestPayload(body) {
    const name = normalizeText(body.name);
    if (!name) {
        throw new AppError('Guest name is required', 400, 'VALIDATION_ERROR');
    }

    return {
        name,
        position: normalizeOptionalText(body.position),
        organization: normalizeOptionalText(body.organization),
        email: validateEmail(body.email),
        mobileNumber: validateSaudiMobileNumber(body.mobileNumber),
        gender: normalizeGender(body.gender),
        status: normalizeStatus(body.status)
    };
}

function buildGuestSearchClause(whereClause, params, paramIndex, search) {
    const term = normalizeText(search);
    if (!term) {
        return { whereClause, params, paramIndex };
    }

    whereClause += ` AND (name ILIKE $${paramIndex} OR position ILIKE $${paramIndex} OR organization ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR mobile_number ILIKE $${paramIndex})`;
    params.push(`%${term}%`);
    return { whereClause, params, paramIndex: paramIndex + 1 };
}

router.use(authenticate);

router.get('/:id/guests', requirePermission('clients.view'), async (req, res, next) => {
    try {
        const clientId = req.params.id;
        const {
            search,
            status,
            gender,
            page = 1,
            pageSize = 12,
            sortBy = 'created_at',
            sortOrder = 'desc'
        } = req.query;

        let whereClause = 'client_id = $1';
        let params = [clientId];
        let paramIndex = 2;

        const searchClause = buildGuestSearchClause(whereClause, params, paramIndex, search);
        whereClause = searchClause.whereClause;
        params = searchClause.params;
        paramIndex = searchClause.paramIndex;

        if (status && status !== 'all') {
            whereClause += ` AND status = $${paramIndex}`;
            params.push(normalizeText(status).toLowerCase());
            paramIndex += 1;
        }

        if (gender && gender !== 'all') {
            whereClause += ` AND gender = $${paramIndex}`;
            params.push(normalizeText(gender).toLowerCase());
            paramIndex += 1;
        }

        const { rows: countRows } = await pool.query(
            `SELECT COUNT(*)::int AS total FROM client_guests WHERE ${whereClause}`,
            params
        );

        const validSortColumns = ['name', 'position', 'organization', 'email', 'mobile_number', 'status', 'gender', 'created_at'];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
        const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);

        const { rows: guests } = await pool.query(
            `SELECT *
             FROM client_guests
             WHERE ${whereClause}
             ORDER BY ${sortColumn} ${order}
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, parseInt(pageSize, 10), offset]
        );

        res.json({
            data: guests,
            pagination: {
                total: countRows[0]?.total || 0,
                page: parseInt(page, 10),
                pageSize: parseInt(pageSize, 10),
                totalPages: Math.ceil((countRows[0]?.total || 0) / parseInt(pageSize, 10))
            }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/:id/guests/:guestId', requirePermission('clients.view'), async (req, res, next) => {
    try {
        const { rows: guests } = await pool.query(
            'SELECT * FROM client_guests WHERE client_id = $1 AND id = $2',
            [req.params.id, req.params.guestId]
        );

        if (!guests.length) {
            throw new AppError('Guest not found', 404, 'NOT_FOUND');
        }

        res.json({ data: guests[0] });
    } catch (error) {
        next(error);
    }
});

router.post('/:id/guests', requirePermission('clients.edit'), async (req, res, next) => {
    try {
        const clientId = req.params.id;
        const payload = normalizeGuestPayload(req.body);
        const duplicateGuest = await findDuplicateGuest(pool, clientId, payload);

        if (duplicateGuest) {
            throw new AppError('Guest already exists with the same details for this client', 409, 'DUPLICATE_GUEST');
        }

        const guestId = uuidv4();
        const avatarPath = req.body.avatarDataUrl ? await saveClientGuestAvatar(clientId, guestId, req.body.avatarDataUrl) : null;

        await pool.query(
            `INSERT INTO client_guests (
                id,
                client_id,
                avatar_path,
                name,
                position,
                organization,
                email,
                mobile_number,
                gender,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                guestId,
                clientId,
                avatarPath,
                payload.name,
                payload.position,
                payload.organization,
                payload.email,
                payload.mobileNumber,
                payload.gender,
                payload.status
            ]
        );

        const { rows: guests } = await pool.query('SELECT * FROM client_guests WHERE id = $1', [guestId]);
        res.status(201).json({ data: guests[0] });
    } catch (error) {
        next(error);
    }
});

router.post('/:id/guests/import', requirePermission('clients.edit'), async (req, res, next) => {
    const db = await pool.connect();
    try {
        const clientId = req.params.id;
        const guests = Array.isArray(req.body?.guests) ? req.body.guests : [];

        if (!guests.length) {
            throw new AppError('Guests payload is required', 400, 'VALIDATION_ERROR');
        }

        if (guests.length > 500) {
            throw new AppError('Too many guests to import at once', 400, 'VALIDATION_ERROR');
        }

        await db.query('BEGIN');

        const inserted = [];
        for (const guestBody of guests) {
            const payload = normalizeGuestPayload(guestBody);
            const duplicateGuest = await findDuplicateGuest(db, clientId, payload);

            if (duplicateGuest) {
                throw new AppError('Guest already exists with the same details for this client', 409, 'DUPLICATE_GUEST');
            }

            const guestId = uuidv4();
            const avatarPath = guestBody.avatarDataUrl ? await saveClientGuestAvatar(clientId, guestId, guestBody.avatarDataUrl) : null;

            await db.query(
                `INSERT INTO client_guests (
                    id,
                    client_id,
                    avatar_path,
                    name,
                    position,
                    organization,
                    email,
                    mobile_number,
                    gender,
                    status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    guestId,
                    clientId,
                    avatarPath,
                    payload.name,
                    payload.position,
                    payload.organization,
                    payload.email,
                    payload.mobileNumber,
                    payload.gender,
                    payload.status
                ]
            );

            inserted.push(guestId);
        }

        await db.query('COMMIT');

        const { rows: rows } = await pool.query(
            `SELECT * FROM client_guests WHERE id = ANY($1::uuid[])`,
            [inserted]
        );

        res.status(201).json({
            data: rows,
            meta: {
                imported: rows.length
            }
        });
    } catch (error) {
        await db.query('ROLLBACK');
        next(error);
    } finally {
        db.release();
    }
});

router.put('/:id/guests/:guestId', requirePermission('clients.edit'), async (req, res, next) => {
    try {
        const existing = await pool.query(
            'SELECT * FROM client_guests WHERE client_id = $1 AND id = $2',
            [req.params.id, req.params.guestId]
        );

        if (!existing.rows.length) {
            throw new AppError('Guest not found', 404, 'NOT_FOUND');
        }

        const current = existing.rows[0];
        const payload = normalizeGuestPayload({
            name: req.body.name ?? current.name,
            position: req.body.position ?? current.position,
            organization: req.body.organization ?? current.organization,
            email: req.body.email ?? current.email,
            mobileNumber: req.body.mobileNumber ?? current.mobile_number,
            gender: req.body.gender ?? current.gender,
            status: req.body.status ?? current.status
        });
        const duplicateGuest = await findDuplicateGuest(pool, req.params.id, payload, req.params.guestId);

        if (duplicateGuest) {
            throw new AppError('Guest already exists with the same email or mobile number', 409, 'DUPLICATE_GUEST');
        }

        const avatarPath = req.body.avatarDataUrl
            ? await saveClientGuestAvatar(req.params.id, req.params.guestId, req.body.avatarDataUrl)
            : current.avatar_path;

        await pool.query(
            `UPDATE client_guests SET
                avatar_path = $1,
                name = $2,
                position = $3,
                organization = $4,
                email = $5,
                mobile_number = $6,
                gender = $7,
                status = $8,
                updated_at = NOW()
            WHERE client_id = $9 AND id = $10`,
            [
                avatarPath,
                payload.name,
                payload.position,
                payload.organization,
                payload.email,
                payload.mobileNumber,
                payload.gender,
                payload.status,
                req.params.id,
                req.params.guestId
            ]
        );

        const { rows: guests } = await pool.query('SELECT * FROM client_guests WHERE id = $1', [req.params.guestId]);
        res.json({ data: guests[0] });
    } catch (error) {
        next(error);
    }
});

router.patch('/:id/guests/:guestId/status', requirePermission('clients.edit'), async (req, res, next) => {
    try {
        const status = normalizeText(req.body.status).toLowerCase();
        if (!STATUS_VALUES.has(status)) {
            throw new AppError('Status is invalid', 400, 'VALIDATION_ERROR');
        }

        const { rows: guests } = await pool.query(
            'SELECT id FROM client_guests WHERE client_id = $1 AND id = $2',
            [req.params.id, req.params.guestId]
        );

        if (!guests.length) {
            throw new AppError('Guest not found', 404, 'NOT_FOUND');
        }

        await pool.query(
            'UPDATE client_guests SET status = $1, updated_at = NOW() WHERE client_id = $2 AND id = $3',
            [status, req.params.id, req.params.guestId]
        );

        const { rows: updated } = await pool.query('SELECT * FROM client_guests WHERE id = $1', [req.params.guestId]);
        res.json({ data: updated[0] });
    } catch (error) {
        next(error);
    }
});

router.delete('/:id/guests/:guestId', requirePermission('clients.edit'), async (req, res, next) => {
    try {
        const result = await pool.query(
            'DELETE FROM client_guests WHERE client_id = $1 AND id = $2 RETURNING id',
            [req.params.id, req.params.guestId]
        );

        if (!result.rows.length) {
            throw new AppError('Guest not found', 404, 'NOT_FOUND');
        }

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
