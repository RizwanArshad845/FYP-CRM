// Applies backend/migrations/NNN_*.sql in order, once each, recording them in
// schema_migrations. Each file runs in its own transaction.
// Usage: npm run migrate
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { withTransaction } from '../config/db.js';

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

const run = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name        VARCHAR(255) PRIMARY KEY,
            applied_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const applied = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const files = (await fs.readdir(migrationsDir)).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();

    for (const file of files) {
        if (applied.has(file)) continue;
        const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
        await withTransaction(async (client) => {
            await client.query(sql);
            await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        });
        console.log(`applied ${file}`);
    }
    console.log('migrations up to date');
};

run()
    .catch((err) => {
        console.error('migration failed:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
