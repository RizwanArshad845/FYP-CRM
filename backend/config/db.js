import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

// Sized for serverless: each Vercel instance holds its own small pool, and the
// Supabase pooler multiplexes them. Raise `max` only for a long-lived server.
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Supabase requires TLS; set DB_SSL=false for a local Postgres (tests, dev).
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: Number(process.env.DB_POOL_MAX) || 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
});

// Background pool errors must not crash the process; the client is replaced.
pool.on('error', (err) => {
  console.error('Unexpected idle-client error:', err.message);
});

// Run `fn(client)` inside a single-connection transaction.
export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
