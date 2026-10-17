// One command for development (works in PowerShell, cmd and bash). Ctrl+C stops everything.
//   npm run dev:local     -> local Postgres + API + frontend (API never touches .env's DATABASE_URL)
//   npm run dev:supabase  -> API + frontend using the database configured in .env (Supabase)
import { spawn } from 'child_process';
import path from 'path';
import { startLocalDb, LOCAL_DB_URL } from './localDb.js';

const useSupabase = process.argv.includes('--supabase');

let db = { stop: async () => {} };
let apiEnv = { ...process.env };

if (useSupabase) {
    // Bring the configured database up to date before starting (no-op if already current).
    const { execFileSync } = await import('child_process');
    try {
        execFileSync(process.execPath, ['backend/scripts/migrate.js'], { stdio: 'inherit' });
    } catch {
        console.error('Migrations failed against the database in .env; fix DATABASE_URL and retry.');
        process.exit(1);
    }
} else {
    db = await startLocalDb().catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
    // Explicit values win over .env (dotenv never overrides variables that are already set).
    apiEnv = {
        ...process.env,
        DATABASE_URL: LOCAL_DB_URL,
        DB_SSL: 'false',
        JWT_SECRET: 'local-dev-only',
        NODE_ENV: 'development',
        PORT: '5000',
        ALLOWED_ORIGINS: '',
    };
}

const children = [
    spawn(process.execPath, ['--watch', 'backend/index.js'], { env: apiEnv, stdio: 'inherit' }),
    spawn(process.execPath, [path.resolve('node_modules/vite/bin/vite.js')], {
        env: { ...process.env, VITE_API_URL: '' },
        stdio: 'inherit',
    }),
];

let stopping = false;
const shutdown = async (code = 0) => {
    if (stopping) return;
    stopping = true;
    for (const child of children) child.kill();
    await db.stop();
    process.exit(code);
};

for (const child of children) {
    child.on('exit', (code) => { if (!stopping) shutdown(code ?? 1); });
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(`\nDatabase: ${useSupabase ? 'Supabase (from .env)' : 'local Postgres'}  ·  API: http://localhost:5000  ·  App: see the Vite URL above  ·  Ctrl+C to stop\n`);
