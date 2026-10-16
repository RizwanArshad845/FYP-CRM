import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading env from root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const { Pool } = pg;

// Supabase PostgreSQL connection string
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("WARNING: DATABASE_URL is not defined in your environment.");
} else {
  try {
    // Only log if not in production to keep logs clean and avoid parsing errors in strict environments
    if (process.env.NODE_ENV !== 'production') {
      const url = new URL(connectionString);
      console.log(`DB Configuration: Connecting to host ${url.hostname}`);
    }
  } catch (e) {
    console.log('DB Configuration: Using connection string (could not parse as URL for logging).');
  }
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  // Keep connections alive for faster reuse
  idleTimeoutMillis: 60000, // 1 minute
  // Fast timeout if the server is truly stuck
  connectionTimeoutMillis: 5000, 
  // Max simultaneous database queries - NOT a user limit.
  // 50 connections can easily support hundreds of active users.
  max: 50,
  // Minimum number of connections to keep open at all times (Instant Response)
  min: 3,
  // Keep TCP connection alive so Supabase doesn't drop it
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// ── CRITICAL: handle background pool errors so Node doesn't crash ──
pool.on('error', (err) => {
  console.error('⚠️  Unexpected idle-client error (connection will be replaced):', err.message);
});

// Simple connectivity check
pool.connect()
  .then((client) => {
    console.log('Successfully connected to Supabase PostgreSQL database via raw pg Pool!');
    client.release();        // release back to pool immediately
  })
  .catch(err => console.error('Connection error with Supabase database:', err.stack));

export default pool;
