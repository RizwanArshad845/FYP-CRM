// Local development database: a real Postgres kept in ./.local-db (gitignored).
// Usage: npm run db:local   (Ctrl+C to stop)
// Then run the API with:
//   DATABASE_URL=postgres://postgres:postgres@localhost:15433/crm DB_SSL=false
import EmbeddedPostgres from 'embedded-postgres';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = Number(process.env.LOCAL_DB_PORT) || 15433;
const dataDir = path.resolve('.local-db');
const url = `postgres://postgres:postgres@localhost:${PORT}/crm`;
const firstRun = !fs.existsSync(path.join(dataDir, 'PG_VERSION'));

const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
});

if (firstRun) await pg.initialise();
await pg.start();
if (firstRun) await pg.createDatabase('crm');

execFileSync(process.execPath, ['backend/scripts/migrate.js'], {
    env: { ...process.env, DATABASE_URL: url, DB_SSL: 'false', JWT_SECRET: process.env.JWT_SECRET || 'local-dev-only' },
    stdio: 'inherit',
});

console.log(`\nLocal Postgres running at ${url}\nPress Ctrl+C to stop.`);

const stop = async () => {
    await pg.stop();
    process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
