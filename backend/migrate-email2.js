import pool from './config/db.js';

async function migrate() {
    try {
        console.log('Adding email_2 to clients table...');
        await pool.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS email_2 VARCHAR(255);');
        console.log('Success!');
        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

migrate();
