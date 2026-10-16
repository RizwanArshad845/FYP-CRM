-- ============================================================
-- NexusWave CRM — Final Updates Schema Migration
-- ============================================================

-- 1. Break In/Out Support
CREATE TABLE IF NOT EXISTS attendance_breaks (
    id SERIAL PRIMARY KEY,
    attendance_id INT REFERENCES daily_attendance(id) ON DELETE CASCADE,
    break_in TIMESTAMP NOT NULL,
    break_out TIMESTAMP
);

-- 2. CST Agent & Monthly Targets
ALTER TABLE cst_agent_targets 
    ADD COLUMN IF NOT EXISTS target_amount NUMERIC DEFAULT 0, 
    ADD COLUMN IF NOT EXISTS achieved_amount NUMERIC DEFAULT 0;

ALTER TABLE monthly_targets 
    ADD COLUMN IF NOT EXISTS closer_target NUMERIC DEFAULT 0, 
    ADD COLUMN IF NOT EXISTS closer_achieved NUMERIC DEFAULT 0;

-- 3. Follow-Ups Enhancements
ALTER TABLE follow_ups 
    ADD COLUMN IF NOT EXISTS closer_name VARCHAR(255), 
    ADD COLUMN IF NOT EXISTS client_name_text VARCHAR(255), 
    ADD COLUMN IF NOT EXISTS contact_time VARCHAR(10), 
    ADD COLUMN IF NOT EXISTS follow_up_number INT;

-- 4. Clients Enhancements
ALTER TABLE clients 
    ADD COLUMN IF NOT EXISTS cin VARCHAR(100), 
    ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(100), 
    ADD COLUMN IF NOT EXISTS discard_reason TEXT, 
    ADD COLUMN IF NOT EXISTS discarded_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS email_2 VARCHAR(255);

-- 5. Important Call Recordings
CREATE TABLE IF NOT EXISTS important_call_recordings (
    id                  SERIAL PRIMARY KEY,
    user_id             INT REFERENCES users(id) ON DELETE CASCADE,
    client_id           INT REFERENCES clients(id) ON DELETE CASCADE,
    recording_url       TEXT,
    duration_seconds    INT DEFAULT 0,
    transcript          TEXT,
    outcome             VARCHAR(50) DEFAULT 'pending',
    quality_rating      NUMERIC DEFAULT 0,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Concerns
CREATE TABLE IF NOT EXISTS concerns (
    id SERIAL PRIMARY KEY,
    concern_type VARCHAR(100), -- call flow, environment, closer, workstation, internet, dialer, other
    description TEXT,
    raised_by INT REFERENCES users(id) ON DELETE SET NULL,
    assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Internal Concerns (CST)
CREATE TABLE IF NOT EXISTS internal_concerns (
    id SERIAL PRIMARY KEY,
    concern_type VARCHAR(100), -- Tech Team, Client, Others
    description TEXT,
    raised_by INT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. CST Templates
CREATE TABLE IF NOT EXISTS cst_templates (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    content TEXT,
    type VARCHAR(50) DEFAULT 'email', -- email, text
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Resource Boards
CREATE TABLE IF NOT EXISTS resource_boards (
    id SERIAL PRIMARY KEY,
    board_state JSONB,
    created_by INT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
