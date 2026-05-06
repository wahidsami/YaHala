import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import pool from '../db/connection.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { saveClientLogo } from '../services/clientAssets.js';

const router = Router();

const COMPANY_TYPES = new Set(['gov', 'private']);
const COMPANY_SECTORS = new Set([
    'Government / Public Sector',
    'Banking',
    'Financial Services',
    'Insurance',
    'Real Estate',
    'Construction',
    'Infrastructure',
    'Transportation & Logistics',
    'Aviation',
    'Healthcare',
    'Pharmaceuticals',
    'Education',
    'Retail',
    'E-commerce',
    'Hospitality & Tourism',
    'Food & Beverage',
    'Agriculture',
    'Manufacturing',
    'Technology & Telecom',
    'Media & Entertainment',
    'Mining & Metals',
    'Energy & Utilities',
    'Oil & Gas',
    'Petrochemicals',
    'Professional Services',
    'Automotive',
    'Defense & Security',
    'Non-Profit',
    'Other'
]);

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalText(value) {
    const text = normalizeText(value);
    return text || null;
}

function normalizeWebsiteUrl(value) {
    const text = normalizeText(value);
    if (!text) {
        return null;
    }

    try {
        const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`;
        return new URL(withProtocol).toString();
    } catch {
        throw new AppError('Website URL is invalid', 400, 'VALIDATION_ERROR');
    }
}

function normalizeCompanyType(value) {
    const text = normalizeText(value);
    if (!text) {
        return null;
    }

    if (!COMPANY_TYPES.has(text)) {
        throw new AppError('Company type is invalid', 400, 'VALIDATION_ERROR');
    }

    return text;
}

function normalizeCompanySector(value) {
    const text = normalizeText(value);
    if (!text) {
        return null;
    }

    if (!COMPANY_SECTORS.has(text)) {
        throw new AppError('Company sector is invalid', 400, 'VALIDATION_ERROR');
    }

    return text;
}

function normalizeClientAddress(body) {
    return {
        addressRegion: normalizeOptionalText(body.addressRegion),
        addressCity: normalizeOptionalText(body.addressCity),
        addressDistrict: normalizeOptionalText(body.addressDistrict),
        addressStreet: normalizeOptionalText(body.addressStreet),
        addressBuildingNumber: normalizeOptionalText(body.addressBuildingNumber),
        addressAdditionalNumber: normalizeOptionalText(body.addressAdditionalNumber),
        addressPostalCode: normalizeOptionalText(body.addressPostalCode),
        addressUnitNumber: normalizeOptionalText(body.addressUnitNumber)
    };
}

function normalizeClientAddressForUpdate(body) {
    const addressFields = [
        'addressRegion',
        'addressCity',
        'addressDistrict',
        'addressStreet',
        'addressBuildingNumber',
        'addressAdditionalNumber',
        'addressPostalCode',
        'addressUnitNumber'
    ];

    return addressFields.reduce((accumulator, field) => {
        if (!Object.prototype.hasOwnProperty.call(body, field)) {
            accumulator[field] = undefined;
            return accumulator;
        }

        accumulator[field] = normalizeOptionalText(body[field]);
        return accumulator;
    }, {});
}

// Apply auth to all routes
router.use(authenticate);

// GET /api/admin/clients - List clients with filters
router.get('/', requirePermission('clients.view'), async (req, res, next) => {
    try {
        const { search, status, subscription, page = 1, pageSize = 25, sortBy = 'created_at', sortOrder = 'desc' } = req.query;

        let whereClause = '1=1';
        const params = [];
        let paramIndex = 1;

        if (search) {
            whereClause += ` AND (name ILIKE $${paramIndex} OR name_ar ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (status && status !== 'all') {
            whereClause += ` AND status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (subscription && subscription !== 'all') {
            whereClause += ` AND subscription_tier = $${paramIndex}`;
            params.push(subscription);
            paramIndex++;
        }

        // Count total
        const { rows: countRows } = await pool.query(
            `SELECT COUNT(*) as total FROM clients WHERE ${whereClause}`,
            params
        );
        const total = parseInt(countRows[0].total);

        // Validate sort column
        const validSortColumns = ['name', 'email', 'status', 'subscription_tier', 'created_at'];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

        // Fetch paginated
        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        const { rows: clients } = await pool.query(
            `SELECT c.*, 
        (SELECT COUNT(*) FROM events WHERE client_id = c.id) as event_count
      FROM clients c
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, parseInt(pageSize), offset]
        );

        res.json({
            data: clients,
            pagination: {
                total,
                page: parseInt(page),
                pageSize: parseInt(pageSize),
                totalPages: Math.ceil(total / parseInt(pageSize))
            }
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/clients/:id - Get single client
router.get('/:id', requirePermission('clients.view'), async (req, res, next) => {
    try {
        const { rows: clients } = await pool.query(
            `SELECT c.*,
        (SELECT COUNT(*) FROM events WHERE client_id = c.id) as event_count,
        (SELECT COUNT(*) FROM events WHERE client_id = c.id AND status = 'active') as active_events,
        (SELECT COUNT(*) FROM scanner_users WHERE client_id = c.id) as scanner_count
      FROM clients c
      WHERE c.id = $1`,
            [req.params.id]
        );

        if (!clients.length) {
            throw new AppError('Client not found', 404, 'NOT_FOUND');
        }

        res.json({ data: clients[0] });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/clients - Create client
router.post('/', requirePermission('clients.create'), async (req, res, next) => {
    try {
        const {
            name,
            nameAr,
            email,
            phone,
            websiteUrl,
            contactPerson,
            companyType,
            companySector,
            logoDataUrl,
            status = 'active',
            subscriptionTier = 'basic',
            eventLimit = 10,
            guestLimit = 1000
        } = req.body;

        if (!name || !email) {
            throw new AppError('Name and email are required', 400, 'VALIDATION_ERROR');
        }

        const normalizedWebsiteUrl = normalizeWebsiteUrl(websiteUrl);
        const normalizedCompanyType = normalizeCompanyType(companyType);
        const normalizedCompanySector = normalizeCompanySector(companySector);
        const address = normalizeClientAddress(req.body);

        // Check email unique
        const { rows: existing } = await pool.query('SELECT id FROM clients WHERE email = $1', [email]);
        if (existing.length) {
            throw new AppError('Email already exists', 400, 'DUPLICATE_EMAIL');
        }

        const id = uuidv4();
        const logoPath = logoDataUrl ? await saveClientLogo(id, logoDataUrl) : null;
        await pool.query(
            `
            INSERT INTO clients (
                id,
                name,
                name_ar,
                email,
                phone,
                website_url,
                contact_person,
                company_type,
                company_sector,
                logo_path,
                address_region,
                address_city,
                address_district,
                address_street,
                address_building_number,
                address_additional_number,
                address_postal_code,
                address_unit_number,
                status,
                subscription_tier,
                event_limit,
                guest_limit
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
            )
            `,
            [
                id,
                normalizeText(name),
                normalizeOptionalText(nameAr),
                normalizeText(email),
                normalizeOptionalText(phone),
                normalizedWebsiteUrl,
                normalizeOptionalText(contactPerson),
                normalizedCompanyType,
                normalizedCompanySector,
                logoPath,
                address.addressRegion,
                address.addressCity,
                address.addressDistrict,
                address.addressStreet,
                address.addressBuildingNumber,
                address.addressAdditionalNumber,
                address.addressPostalCode,
                address.addressUnitNumber,
                status,
                subscriptionTier,
                eventLimit,
                guestLimit
            ]
        );

        const { rows: newClient } = await pool.query('SELECT * FROM clients WHERE id = $1', [id]);

        res.status(201).json({ data: newClient[0] });
    } catch (error) {
        next(error);
    }
});

// PUT /api/admin/clients/:id - Update client
router.put('/:id', requirePermission('clients.edit'), async (req, res, next) => {
    try {
        const {
            name,
            nameAr,
            email,
            phone,
            websiteUrl,
            contactPerson,
            companyType,
            companySector,
            logoDataUrl,
            status,
            subscriptionTier,
            eventLimit,
            guestLimit
        } = req.body;

        const { rows: existing } = await pool.query('SELECT id FROM clients WHERE id = $1', [req.params.id]);
        if (!existing.length) {
            throw new AppError('Client not found', 404, 'NOT_FOUND');
        }

        if (email) {
            const { rows: emailCheck } = await pool.query('SELECT id FROM clients WHERE email = $1 AND id != $2', [email, req.params.id]);
            if (emailCheck.length) {
                throw new AppError('Email already exists', 400, 'DUPLICATE_EMAIL');
            }
        }

        const normalizedWebsiteUrl = websiteUrl === undefined ? undefined : normalizeWebsiteUrl(websiteUrl);
        const normalizedCompanyType = companyType === undefined ? undefined : normalizeCompanyType(companyType);
        const normalizedCompanySector = companySector === undefined ? undefined : normalizeCompanySector(companySector);
        const address = normalizeClientAddressForUpdate(req.body);
        const logoPath = logoDataUrl ? await saveClientLogo(req.params.id, logoDataUrl) : undefined;

        await pool.query(
            `
            UPDATE clients SET
                name = COALESCE($1, name),
                name_ar = COALESCE($2, name_ar),
                email = COALESCE($3, email),
                phone = COALESCE($4, phone),
                website_url = COALESCE($5, website_url),
                contact_person = COALESCE($6, contact_person),
                company_type = COALESCE($7, company_type),
                company_sector = COALESCE($8, company_sector),
                logo_path = COALESCE($9, logo_path),
                address_region = COALESCE($10, address_region),
                address_city = COALESCE($11, address_city),
                address_district = COALESCE($12, address_district),
                address_street = COALESCE($13, address_street),
                address_building_number = COALESCE($14, address_building_number),
                address_additional_number = COALESCE($15, address_additional_number),
                address_postal_code = COALESCE($16, address_postal_code),
                address_unit_number = COALESCE($17, address_unit_number),
                status = COALESCE($18, status),
                subscription_tier = COALESCE($19, subscription_tier),
                event_limit = COALESCE($20, event_limit),
                guest_limit = COALESCE($21, guest_limit),
                updated_at = NOW()
            WHERE id = $22
            `,
            [
                name === undefined ? undefined : normalizeText(name),
                nameAr === undefined ? undefined : normalizeOptionalText(nameAr),
                email === undefined ? undefined : normalizeText(email),
                phone === undefined ? undefined : normalizeOptionalText(phone),
                normalizedWebsiteUrl,
                contactPerson === undefined ? undefined : normalizeOptionalText(contactPerson),
                normalizedCompanyType,
                normalizedCompanySector,
                logoPath,
                address.addressRegion,
                address.addressCity,
                address.addressDistrict,
                address.addressStreet,
                address.addressBuildingNumber,
                address.addressAdditionalNumber,
                address.addressPostalCode,
                address.addressUnitNumber,
                status === undefined ? undefined : status,
                subscriptionTier === undefined ? undefined : subscriptionTier,
                eventLimit === undefined ? undefined : eventLimit,
                guestLimit === undefined ? undefined : guestLimit,
                req.params.id
            ]
        );

        const { rows: updated } = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);

        res.json({ data: updated[0] });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/admin/clients/:id - Soft delete (deactivate)
router.delete('/:id', requirePermission('clients.delete'), async (req, res, next) => {
    try {
        const { rows: existing } = await pool.query('SELECT id FROM clients WHERE id = $1', [req.params.id]);
        if (!existing.length) {
            throw new AppError('Client not found', 404, 'NOT_FOUND');
        }

        await pool.query(
            `UPDATE clients
             SET status = 'inactive', updated_at = NOW()
             WHERE id = $1`,
            [req.params.id]
        );

        res.json({ message: 'Client deactivated successfully' });
    } catch (error) {
        next(error);
    }
});

// PATCH /api/admin/clients/:id/status - Toggle or set client status
router.patch('/:id/status', requirePermission('clients.edit'), async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!status || !['active', 'inactive', 'suspended'].includes(status)) {
            throw new AppError('Status is invalid', 400, 'VALIDATION_ERROR');
        }

        const { rows: existing } = await pool.query('SELECT id FROM clients WHERE id = $1', [req.params.id]);
        if (!existing.length) {
            throw new AppError('Client not found', 404, 'NOT_FOUND');
        }

        await pool.query(
            'UPDATE clients SET status = $1, updated_at = NOW() WHERE id = $2',
            [status, req.params.id]
        );

        const { rows: updated } = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
        res.json({ data: updated[0] });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/clients/:id/stats
router.get('/:id/stats', requirePermission('clients.view'), async (req, res, next) => {
    try {
        const clientId = req.params.id;

        const { rows: client } = await pool.query('SELECT event_limit, guest_limit FROM clients WHERE id = $1', [clientId]);
        if (!client.length) {
            throw new AppError('Client not found', 404, 'NOT_FOUND');
        }

        const { rows: eventCount } = await pool.query('SELECT COUNT(*) as count FROM events WHERE client_id = $1', [clientId]);
        const { rows: activeEvents } = await pool.query('SELECT COUNT(*) as count FROM events WHERE client_id = $1 AND status = $2', [clientId, 'active']);
        const { rows: scannerCount } = await pool.query('SELECT COUNT(*) as count FROM scanner_users WHERE client_id = $1', [clientId]);
        const { rows: guestCount } = await pool.query('SELECT COUNT(*) as count FROM client_guests WHERE client_id = $1', [clientId]);

        res.json({
            data: {
                events: { used: parseInt(eventCount[0].count), limit: client[0].event_limit },
                guests: { used: parseInt(guestCount[0].count), limit: client[0].guest_limit },
                activeEvents: parseInt(activeEvents[0].count),
                scannerUsers: parseInt(scannerCount[0].count)
            }
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/clients/:id/scanner-users
router.get('/:id/scanner-users', requirePermission('scanner_users.view'), async (req, res, next) => {
    try {
        const clientId = req.params.id;
        const { rows: client } = await pool.query('SELECT id FROM clients WHERE id = $1', [clientId]);
        if (!client.length) {
            throw new AppError('Client not found', 404, 'NOT_FOUND');
        }

        const { rows } = await pool.query(
            `
            SELECT id, client_id, name, status, event_id, created_at, updated_at
            FROM scanner_users
            WHERE client_id = $1
            ORDER BY created_at DESC
            `,
            [clientId]
        );

        res.json({ data: rows });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/clients/:id/scanner-users
router.post('/:id/scanner-users', requirePermission('scanner_users.create'), async (req, res, next) => {
    try {
        const clientId = req.params.id;
        const name = normalizeText(req.body?.name);
        const pin = normalizeText(req.body?.pin);
        const status = normalizeText(req.body?.status || 'active') || 'active';
        const eventId = req.body?.event_id || null;

        if (!name || !pin) {
            throw new AppError('Name and PIN are required', 400, 'VALIDATION_ERROR');
        }
        if (pin.length < 4 || pin.length > 12) {
            throw new AppError('PIN must be between 4 and 12 characters', 400, 'VALIDATION_ERROR');
        }
        if (!['active', 'inactive'].includes(status)) {
            throw new AppError('Status is invalid', 400, 'VALIDATION_ERROR');
        }
        if (eventId) {
            const { rows: event } = await pool.query('SELECT id FROM events WHERE id = $1 AND client_id = $2', [eventId, clientId]);
            if (!event.length) {
                throw new AppError('Event not found or does not belong to client', 400, 'INVALID_EVENT');
            }
        }

        const { rows: client } = await pool.query('SELECT id FROM clients WHERE id = $1', [clientId]);
        if (!client.length) {
            throw new AppError('Client not found', 404, 'NOT_FOUND');
        }

        const { rows: duplicate } = await pool.query(
            `
            SELECT id
            FROM scanner_users
            WHERE client_id = $1 AND LOWER(name) = LOWER($2)
            LIMIT 1
            `,
            [clientId, name]
        );
        if (duplicate.length) {
            throw new AppError('Scanner user name already exists for this client', 400, 'DUPLICATE_SCANNER_USER');
        }

        const pinHash = await bcrypt.hash(pin, 10);
        const { rows } = await pool.query(
            `
            INSERT INTO scanner_users (id, client_id, name, pin_hash, status, event_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, client_id, name, status, event_id, created_at, updated_at
            `,
            [uuidv4(), clientId, name, pinHash, status, eventId]
        );

        res.status(201).json({ data: rows[0] });
    } catch (error) {
        next(error);
    }
});

export default router;
