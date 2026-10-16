import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ── GLOBAL EXCEPTION HANDLERS (CRITICAL FOR ELECTRON STABILITY) ──
process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception in Backend:', err);
    // Do not exit process, let the server stay alive
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection in Backend at:', promise, 'reason:', reason);
    // Do not exit process
});
import pool from './config/db.js';

import userRoutes from './routes/userRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import cstRoutes from './routes/cstRoutes.js';
import salesRoutes from './routes/salesRoutes.js';
import cstManagerRoutes from './routes/cstManagerRoutes.js';
import salesManagerRoutes from './routes/salesManagerRoutes.js';
import financeRoutes from './routes/financeRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import authRoutes from './routes/authRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import notepadRoutes from './routes/notepadRoutes.js';
import concernsRoutes from './routes/concernsRoutes.js';
import templatesRoutes from './routes/templatesRoutes.js';
import boardRoutes from './routes/boardRoutes.js';
import { protect } from './middleware/authMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Database Schema if needed
const initDB = async () => {
    try {
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS base_salary NUMERIC DEFAULT 0');
        await pool.query(`
            ALTER TABLE clients 
            ADD COLUMN IF NOT EXISTS cin VARCHAR(100), 
            ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(100), 
            ADD COLUMN IF NOT EXISTS discard_reason TEXT, 
            ADD COLUMN IF NOT EXISTS discarded_at TIMESTAMP
        `);
        await pool.query(`
            ALTER TABLE follow_ups 
            ADD COLUMN IF NOT EXISTS closer_name VARCHAR(255), 
            ADD COLUMN IF NOT EXISTS client_name_text VARCHAR(255), 
            ADD COLUMN IF NOT EXISTS contact_time VARCHAR(10), 
            ADD COLUMN IF NOT EXISTS follow_up_number INT
        `);
        // Moved ALTER TABLE for cst_agent_targets down below its CREATE TABLE

        // Ensure CST Manager tables exist, as they might have been missed during migration
        await pool.query(`
            CREATE TABLE IF NOT EXISTS client_strategies (
                id SERIAL PRIMARY KEY,
                client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
                strategy_text TEXT,
                created_by VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS cst_agent_targets (
                id SERIAL PRIMARY KEY,
                agent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                target_month VARCHAR(7) NOT NULL,
                target_clients INTEGER NOT NULL DEFAULT 0,
                achieved_clients INTEGER DEFAULT 0,
                target_amount NUMERIC DEFAULT 0,
                achieved_amount NUMERIC DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT cst_agent_targets_agent_id_target_month_key UNIQUE (agent_id, target_month)
            );
        `);
        
        await pool.query(`
            ALTER TABLE cst_agent_targets 
            ADD COLUMN IF NOT EXISTS target_amount NUMERIC DEFAULT 0, 
            ADD COLUMN IF NOT EXISTS achieved_amount NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS achieved_clients INTEGER DEFAULT 0
        `);
        
        await pool.query(`
            ALTER TABLE monthly_targets 
            ADD COLUMN IF NOT EXISTS closer_target NUMERIC DEFAULT 0, 
            ADD COLUMN IF NOT EXISTS closer_achieved NUMERIC DEFAULT 0
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS client_notes (
                id SERIAL PRIMARY KEY,
                client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
                note_text TEXT NOT NULL,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS concerns (
                id SERIAL PRIMARY KEY,
                concern_type VARCHAR(100),
                description TEXT,
                raised_by INT REFERENCES users(id) ON DELETE SET NULL,
                assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
                status VARCHAR(50) DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS internal_concerns (
                id SERIAL PRIMARY KEY,
                concern_type VARCHAR(100),
                description TEXT,
                raised_by INT REFERENCES users(id) ON DELETE SET NULL,
                status VARCHAR(50) DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS attendance_breaks (
                id SERIAL PRIMARY KEY,
                attendance_id INT REFERENCES daily_attendance(id) ON DELETE CASCADE,
                break_in TIMESTAMP NOT NULL,
                break_out TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS important_call_recordings (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                client_id INT REFERENCES clients(id) ON DELETE CASCADE,
                recording_url TEXT,
                duration_seconds INT DEFAULT 0,
                transcript TEXT,
                outcome VARCHAR(50) DEFAULT 'pending',
                quality_rating NUMERIC DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS resource_boards (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) DEFAULT 'Untitled Board',
                board_state JSONB,
                created_by INT REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS follow_ups (
                id SERIAL PRIMARY KEY,
                sales_agent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
                due_date DATE NOT NULL,
                notes TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                closer_name VARCHAR(255),
                client_name_text VARCHAR(255),
                contact_time TIME,
                follow_up_number INTEGER,
                product VARCHAR(255),
                area VARCHAR(255),
                contact_no VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Safety: Ensure all new columns exist in follow_ups
        const followUpCols = ['product', 'area', 'contact_no', 'closer_name', 'client_name_text', 'contact_time', 'follow_up_number'];
        for (const col of followUpCols) {
            await pool.query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='follow_ups' AND column_name='${col}') THEN
                        ALTER TABLE follow_ups ADD COLUMN ${col} VARCHAR(255);
                    END IF;
                END $$;
            `);
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS cst_templates (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255),
                content TEXT,
                type VARCHAR(50) DEFAULT 'email',
                created_by INT REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_notepads (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            DO $$ 
            BEGIN 
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cst_agent_notepads') THEN
                    INSERT INTO user_notepads (user_id, content, updated_at)
                    SELECT agent_id, content, updated_at 
                    FROM cst_agent_notepads
                    ON CONFLICT (user_id) DO NOTHING;
                END IF;
            END $$;
        `);

        await pool.query(`
            DO $$ 
            BEGIN 
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cst_manager_notepads') THEN
                    INSERT INTO user_notepads (user_id, content, updated_at)
                    SELECT manager_id, content, updated_at 
                    FROM cst_manager_notepads
                    ON CONFLICT (user_id) DO NOTHING;
                END IF;
            END $$;
        `);

        console.log('Database schema verified (tables ensured)');
    } catch (err) {
        console.error('Migration error:', err);
    }
};

// Base Health Check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Express Backend is running from within Electron!' });
});

// Mounted Routes
app.use('/api/users', userRoutes);
app.use('/api/clients', protect, clientRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/cst', protect, cstRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/cst-manager', cstManagerRoutes);
app.use('/api/sales-manager', salesManagerRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notepads', protect, notepadRoutes);
app.use('/api/concerns', concernsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/boards', boardRoutes);

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    initDB().then(() => {
        app.listen(PORT, () => {
            console.log(`\n❤️ HEARTBEAT: CRM Backend v2.0 (NUCLEAR UPDATE) is live on PORT ${PORT}`);
            console.log(`📂 Base Directory: ${__dirname}\n`);
        });
    });
} else {
    // For Vercel Serverless
    initDB().catch(console.error);
}

export default app;
