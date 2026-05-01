import bcrypt from 'bcryptjs';
import pool from './connection.js';

async function seed() {
    console.log('🌱 Seeding PostgreSQL database...');

    try {
        // Create roles
        console.log('  Creating roles...');
        const roles = [
            { name: 'super_admin', description: 'Full system access' },
            { name: 'admin_user', description: 'Client and event management' },
            { name: 'report_viewer', description: 'Read-only reports access' }
        ];

        for (const role of roles) {
            await pool.query(
                `INSERT INTO roles (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
                [role.name, role.description]
            );
        }

        // Get role IDs
        const { rows: roleRows } = await pool.query('SELECT id, name FROM roles');
        const roleMap = {};
        roleRows.forEach(r => roleMap[r.name] = r.id);

        // Create permissions
        console.log('  Creating permissions...');
        const permissions = {
            super_admin: [
                'dashboard.view', 'clients.view', 'clients.create', 'clients.edit', 'clients.delete',
                'events.view', 'events.create', 'events.edit', 'events.delete',
                'templates.view', 'templates.create', 'templates.edit', 'templates.delete',
                'guests.view', 'guests.create', 'guests.edit', 'guests.delete', 'guests.import',
                'scanner_users.view', 'scanner_users.create', 'scanner_users.edit', 'scanner_users.delete',
                'reports.view', 'reports.export', 'logs.view', 'settings.view', 'settings.edit'
            ],
            admin_user: [
                'dashboard.view', 'clients.view', 'clients.create', 'clients.edit',
                'events.view', 'events.create', 'events.edit',
                'templates.view', 'templates.create', 'templates.edit',
                'guests.view', 'guests.create', 'guests.edit', 'guests.import',
                'scanner_users.view', 'scanner_users.create', 'scanner_users.edit',
                'reports.view', 'reports.export'
            ],
            report_viewer: ['dashboard.view', 'clients.view', 'events.view', 'reports.view']
        };

        for (const [roleName, perms] of Object.entries(permissions)) {
            for (const perm of perms) {
                await pool.query(
                    `INSERT INTO role_permissions (role_id, permission) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [roleMap[roleName], perm]
                );
            }
        }

        // Create super admin user
        console.log('  Creating super admin user...');
        const passwordHash = await bcrypt.hash('Admin@123', 10);
        await pool.query(
            `INSERT INTO dashboard_users (email, password_hash, name, role_id, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING`,
            ['admin@rawaj.com', passwordHash, 'Super Admin', roleMap.super_admin, 'active']
        );

        console.log('✅ Seeding completed');
        console.log('');
        console.log('🔐 Super Admin Credentials:');
        console.log('   Email: admin@rawaj.com');
        console.log('   Password: Admin@123');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error.message);
        process.exit(1);
    }
}

seed();
