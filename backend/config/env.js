import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Root .env for local dev; on Vercel the variables come from project settings.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'];
const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

export const env = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: Number(process.env.PORT) || 5000,
    IS_VERCEL: Boolean(process.env.VERCEL),
    // Comma-separated list; empty means same-origin only (the Vercel setup).
    ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
};

export const isProduction = env.NODE_ENV === 'production';
