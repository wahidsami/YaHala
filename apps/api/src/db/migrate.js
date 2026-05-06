import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

async function migrate() {
    console.log('🔄 Running PostgreSQL migrations...');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            filename VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    `);
    await pool.query('SELECT pg_advisory_lock(84233791)');

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    for (const file of files) {
        const { rows: alreadyAppliedRows } = await pool.query(
            'SELECT 1 FROM schema_migrations WHERE filename = $1 LIMIT 1',
            [file]
        );

        if (alreadyAppliedRows.length) {
            console.log(`  ⏭️  Skipping ${file} (already applied)`);
            continue;
        }

        console.log(`  📄 Running ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

        try {
            await pool.query('BEGIN');
            await pool.query(sql);
            await pool.query(
                'INSERT INTO schema_migrations (filename) VALUES ($1)',
                [file]
            );
            await pool.query('COMMIT');
            console.log(`  ✅ ${file} completed`);
        } catch (error) {
            await pool.query('ROLLBACK').catch(() => {});
            console.error(`  ❌ ${file} failed:`, error.message);
            process.exit(1);
        }
    }

    console.log('✅ All migrations completed');
    await pool.query('SELECT pg_advisory_unlock(84233791)');
    process.exit(0);
}

migrate();
