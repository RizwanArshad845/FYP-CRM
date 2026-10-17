// Local development database: a real Postgres kept in ./.local-db (gitignored).
// Usage: npm run db:local   (Ctrl+C to stop) — or use `npm run dev:local` for DB + API + frontend.
import EmbeddedPostgres from 'embedded-postgres';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

export const LOCAL_DB_PORT = Number(process.env.LOCAL_DB_PORT) || 15433;
export const LOCAL_DB_URL = `postgres://postgres:postgres@localhost:${LOCAL_DB_PORT}/crm`;

const canConnect = async () => {
    const client = new pg.Client({ connectionString: LOCAL_DB_URL, connectionTimeoutMillis: 2000 });
    try {
        await client.connect();
        await client.end();
        return true;
    } catch {
        return false;
    }
};

/**
 * Starts the local Postgres (or reuses one already running on the port) and
 * applies migrations. Returns a stop() that only stops a server we started.
 */
export async function startLocalDb() {
    if (await canConnect()) {
        console.log(`Reusing local Postgres already running on port ${LOCAL_DB_PORT}`);
    } else {
        const dataDir = path.resolve('.local-db');
        const firstRun = !fs.existsSync(path.join(dataDir, 'PG_VERSION'));
        var server = new EmbeddedPostgres({
            databaseDir: dataDir,
            user: 'postgres',
            password: 'postgres',
            port: LOCAL_DB_PORT,
            persistent: true,
            initdbFlags: ['--encoding=UTF8', '--locale=C'],
            onLog: () => {},
        });
        try {
            if (firstRun) await server.initialise();
            await server.start();
            if (firstRun) await server.createDatabase('crm');
        } catch (err) {
            throw new Error(
                `Could not start local Postgres on port ${LOCAL_DB_PORT} (${err?.message || 'unknown error'}). ` +
                'Another Postgres may be holding the port or the .local-db folder; stop it and retry.'
            );
        }
    }

    execFileSync(process.execPath, ['backend/scripts/migrate.js'], {
        env: { ...process.env, DATABASE_URL: LOCAL_DB_URL, DB_SSL: 'false', JWT_SECRET: process.env.JWT_SECRET || 'local-dev-only' },
        stdio: 'inherit',
    });

    return { stop: async () => { if (server) await server.stop(); } };
}

// Run directly: keep the DB up until Ctrl+C
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const db = await startLocalDb();
        console.log(`\nLocal Postgres running at ${LOCAL_DB_URL}\nPress Ctrl+C to stop.`);
        const stop = async () => { await db.stop(); process.exit(0); };
        process.on('SIGINT', stop);
        process.on('SIGTERM', stop);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}
