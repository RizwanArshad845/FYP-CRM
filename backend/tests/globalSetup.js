// Starts a throwaway real Postgres for the test run and applies all migrations.
import EmbeddedPostgres from 'embedded-postgres';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { TEST_DB } from '../../vitest.config.js';

let pg;
let dataDir;

export async function setup() {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-test-pg-'));
  pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: TEST_DB.user,
    password: TEST_DB.password,
    port: TEST_DB.port,
    persistent: false,
    // Match Supabase: UTF-8 regardless of the Windows locale
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(TEST_DB.database);

  // Run the real migration script against the test DB
  execFileSync(process.execPath, ['backend/scripts/migrate.js'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-not-for-production',
      DB_SSL: 'false',
      DATABASE_URL: `postgres://${TEST_DB.user}:${TEST_DB.password}@localhost:${TEST_DB.port}/${TEST_DB.database}`,
    },
    stdio: 'inherit',
  });
}

export async function teardown() {
  await pg?.stop();
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
}
