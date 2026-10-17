// Read-only: shows which database DATABASE_URL points at and what's already in it.
// Usage: npm run db:info
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const raw = process.env.DATABASE_URL;
if (!raw) {
    console.log('DATABASE_URL is not set');
    process.exit(1);
}
if (raw.includes('[YOUR-PASSWORD]')) {
    console.log('DATABASE_URL still contains the [YOUR-PASSWORD] placeholder');
    process.exit(1);
}

const url = new URL(raw);
console.log(`host: ${url.hostname}  port: ${url.port}  database: ${url.pathname.slice(1)}  user: ${url.username}`);

const client = new pg.Client({
    connectionString: raw,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});
await client.connect();
const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name
`);
console.log(`public tables (${tables.rows.length}): ${tables.rows.map((r) => r.table_name).join(', ') || '(none)'}`);

const names = new Set(tables.rows.map((r) => r.table_name));
if (names.has('schema_migrations')) {
    const applied = await client.query('SELECT name FROM schema_migrations ORDER BY name');
    console.log(`applied migrations: ${applied.rows.map((r) => r.name).join(', ') || '(none)'}`);
}
const noRls = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity");
console.log(`tables without RLS: ${noRls.rows.map((r) => r.tablename).join(', ') || 'none'}`);
for (const t of ['roles', 'portal_types', 'users', 'clients', 'organizations']) {
    if (names.has(t)) {
        const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
        console.log(`${t}: ${rows[0].n} rows`);
    }
}
await client.end();
