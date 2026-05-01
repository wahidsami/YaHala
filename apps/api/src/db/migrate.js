import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

async function migrate() {
    console.log('🔄 Running PostgreSQL migrations...');

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    for (const file of files) {
        console.log(`  📄 Running ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

        try {
            await pool.query(sql);
            console.log(`  ✅ ${file} completed`);
        } catch (error) {
            console.error(`  ❌ ${file} failed:`, error.message);
            process.exit(1);
        }
    }

    console.log('✅ All migrations completed');
    process.exit(0);
}

migrate();
