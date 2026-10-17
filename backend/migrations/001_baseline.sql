-- 001_baseline: the schema as it exists in production today.
-- Merges setup-database.sql, migrations/final_update.sql and the former initDB()
-- in index.js. Every statement is idempotent, so this is safe on the live DB.
-- (The admin123 seed user from setup-database.sql is intentionally dropped.)

-- ──────────────────────────────────────────────
-- 1. LOOKUP TABLES (roles, departments, tags)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tags (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
-- 2. USERS
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    role_id         INT REFERENCES roles(id),
    department_id   INT REFERENCES departments(id),
    status          VARCHAR(20) DEFAULT 'active',
    base_salary     NUMERIC DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
-- 3. CLIENTS
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
    id              SERIAL PRIMARY KEY,
    company_name    VARCHAR(255),
    customer_name   VARCHAR(255),
    email           VARCHAR(255),
    phone           VARCHAR(50),
    payment_amount  NUMERIC DEFAULT 0,
    product_sold    VARCHAR(255),
    service_area    VARCHAR(255),
    contact_no_1    VARCHAR(50),
    contact_no_2    VARCHAR(50),
    client_concerns TEXT,
    tips_for_tech   TEXT,
    notes           TEXT,
    digital_presence TEXT,
    cin             VARCHAR(100),
    payment_gateway VARCHAR(100),
    discard_reason  TEXT,
    discarded_at    TIMESTAMP,
    status          VARCHAR(50) DEFAULT 'onboarding',
    flag_type       VARCHAR(50),
    sales_agent_id  INT REFERENCES users(id),
    cst_agent_id    INT REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
-- 4. ATTENDANCE
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_attendance (
    id          SERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(id),
    date        DATE DEFAULT CURRENT_DATE,
    clock_in    TIMESTAMP,
    clock_out   TIMESTAMP,
    status      VARCHAR(20) DEFAULT 'on-time',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance_breaks (
    id SERIAL PRIMARY KEY,
    attendance_id INT REFERENCES daily_attendance(id) ON DELETE CASCADE,
    break_in TIMESTAMP NOT NULL,
    break_out TIMESTAMP
);

-- ──────────────────────────────────────────────
-- 5. TASKS & TASK SUBMISSIONS
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    assigned_to     INT REFERENCES users(id),
    assigned_by     INT REFERENCES users(id),
    due_date        DATE,
    status          VARCHAR(50) DEFAULT 'pending',
    priority        VARCHAR(20) DEFAULT 'medium',
    category        VARCHAR(100) DEFAULT 'General',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_submissions (
    id                  SERIAL PRIMARY KEY,
    task_id             INT REFERENCES tasks(id),
    submission_notes    TEXT,
    attachment_url      TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
-- 6. EVENTS (company calendar)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
    id                  SERIAL PRIMARY KEY,
    title               VARCHAR(255) NOT NULL,
    date                DATE NOT NULL,
    type                VARCHAR(50),
    created_by_user_id  INT REFERENCES users(id),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
-- 7. PAYROLLS (Finance)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payrolls (
    id                  SERIAL PRIMARY KEY,
    user_id             INT REFERENCES users(id),
    pay_period_start    DATE,
    pay_period_end      DATE,
    base_salary         NUMERIC DEFAULT 0,
    deductions          NUMERIC DEFAULT 0,
    bonuses             NUMERIC DEFAULT 0,
    net_pay             NUMERIC DEFAULT 0,
    status              VARCHAR(20) DEFAULT 'pending',
    processed_by        INT REFERENCES users(id),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
-- 8. EXPENSES (Finance)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expenses (
    id              SERIAL PRIMARY KEY,
    category        VARCHAR(100),
    amount          NUMERIC DEFAULT 0,
    expense_date    DATE,
    status          VARCHAR(20) DEFAULT 'pending',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
-- 9. PERFORMANCE REVIEWS
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS performance_reviews (
    id              SERIAL PRIMARY KEY,
    user_id         INT REFERENCES users(id),
    reviewer_id     INT REFERENCES users(id),
    rating          NUMERIC DEFAULT 0,
    comments        TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
-- 10. SALES: MONTHLY TARGETS
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS monthly_targets (
    id              SERIAL PRIMARY KEY,
    user_id         INT REFERENCES users(id),
    assigned_by     INT REFERENCES users(id),
    target_month    DATE,
    target_amount   NUMERIC DEFAULT 0,
    achieved_amount NUMERIC DEFAULT 0,
    closer_target   NUMERIC DEFAULT 0,
    closer_achieved NUMERIC DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
-- 11. SALES: CALL RECORDINGS
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS call_recordings (
    id                  SERIAL PRIMARY KEY,
    user_id             INT REFERENCES users(id),
    client_id           INT REFERENCES clients(id),
    recording_url       TEXT,
    duration_seconds    INT DEFAULT 0,
    transcript          TEXT,
    outcome             VARCHAR(50) DEFAULT 'pending',
    quality_rating      NUMERIC DEFAULT 0,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
-- 12. SALES: FOLLOW UPS
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS follow_ups (
    id              SERIAL PRIMARY KEY,
    sales_agent_id  INT REFERENCES users(id),
    client_id       INT REFERENCES clients(id),
    closer_name     VARCHAR(255),
    client_name_text VARCHAR(255),
    due_date        DATE,
    contact_time    VARCHAR(10),
    follow_up_number INT,
    notes           TEXT,
    status          VARCHAR(50) DEFAULT 'pending',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
-- 13. CST: CLIENT STRATEGIES
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_strategies (
    id              SERIAL PRIMARY KEY,
    client_id       INT REFERENCES clients(id),
    strategy_text   TEXT,
    created_by      INT REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
-- 14. CST: CLIENT DEACTIVATION REQUESTS
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_deactivation_requests (
    id              SERIAL PRIMARY KEY,
    client_id       INT REFERENCES clients(id),
    requested_by    INT REFERENCES users(id),
    reason          TEXT,
    status          VARCHAR(50) DEFAULT 'pending',
    reviewed_by     INT REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
-- 15. CST: CLIENT TAGS
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_tags (
    id          SERIAL PRIMARY KEY,
    client_id   INT REFERENCES clients(id),
    tag_id      INT REFERENCES tags(id),
    assigned_by INT REFERENCES users(id),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
-- 16. CST: SCHEDULES
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS schedules (
    id          SERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(id),
    title       VARCHAR(255),
    description TEXT,
    start_time  TIMESTAMP,
    end_time    TIMESTAMP,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
-- 17. CST: CLIENT NOTES
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_notes (
    id              SERIAL PRIMARY KEY,
    client_id       INT REFERENCES clients(id) ON DELETE CASCADE,
    note_text       TEXT NOT NULL,
    created_by      INT REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
-- 18. CST MANAGER: AGENT TARGETS
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cst_agent_targets (
    id              SERIAL PRIMARY KEY,
    agent_id        INT REFERENCES users(id),
    target_month    VARCHAR(7) NOT NULL,   -- 'YYYY-MM'
    target_clients  INT DEFAULT 0,
    target_amount   NUMERIC DEFAULT 0,
    achieved_amount NUMERIC DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, target_month)
);

-- ──────────────────────────────────────────────
-- 19. FINAL ENHANCEMENTS TABLES
-- ──────────────────────────────────────────────

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

CREATE TABLE IF NOT EXISTS internal_concerns (
    id SERIAL PRIMARY KEY,
    concern_type VARCHAR(100),
    description TEXT,
    raised_by INT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cst_templates (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    content TEXT,
    type VARCHAR(50) DEFAULT 'email',
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resource_boards (
    id SERIAL PRIMARY KEY,
    board_state JSONB,
    created_by INT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
-- 20. COLUMNS / TABLES THAT ONLY EXISTED IN initDB() OR final_update.sql
-- ──────────────────────────────────────────────

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS email_2 VARCHAR(255),
    ADD COLUMN IF NOT EXISTS client_services TEXT;

ALTER TABLE follow_ups
    ADD COLUMN IF NOT EXISTS product VARCHAR(255),
    ADD COLUMN IF NOT EXISTS area VARCHAR(255),
    ADD COLUMN IF NOT EXISTS contact_no VARCHAR(50);

ALTER TABLE cst_agent_targets ADD COLUMN IF NOT EXISTS achieved_clients INT DEFAULT 0;

ALTER TABLE resource_boards ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT 'Untitled Board';

ALTER TABLE client_strategies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS user_notepads (
    id          SERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    content     TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- One-time copy from the retired per-role notepad tables (no-op once they are gone).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cst_agent_notepads') THEN
        INSERT INTO user_notepads (user_id, content, updated_at)
        SELECT agent_id, content, updated_at FROM cst_agent_notepads
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cst_manager_notepads') THEN
        INSERT INTO user_notepads (user_id, content, updated_at)
        SELECT manager_id, content, updated_at FROM cst_manager_notepads
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
END $$;

-- ============================================================
-- SEED DATA: Roles & Departments
-- ============================================================

INSERT INTO roles (name) VALUES
    ('admin'),
    ('sales'),
    ('sales_manager'),
    ('cst'),
    ('cst_manager'),
    ('finance')
ON CONFLICT (name) DO NOTHING;

INSERT INTO departments (name) VALUES
    ('Administration'),
    ('Sales'),
    ('Customer Success'),
    ('Finance'),
    ('Human Resources')
ON CONFLICT (name) DO NOTHING;
