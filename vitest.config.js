import { defineConfig } from 'vitest/config';

export const TEST_DB = {
  port: 15432, // 54329 falls in a Windows-reserved range on some machines
  user: 'postgres',
  password: 'postgres',
  database: 'crm_test',
};

export default defineConfig({
  test: {
    include: ['backend/tests/**/*.test.js'],
    environment: 'node',
    globalSetup: ['backend/tests/globalSetup.js'],
    // One shared database: run files one after another.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 120000,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-not-for-production',
      DB_SSL: 'false',
      DATABASE_URL: `postgres://${TEST_DB.user}:${TEST_DB.password}@localhost:${TEST_DB.port}/${TEST_DB.database}`,
    },
  },
});
