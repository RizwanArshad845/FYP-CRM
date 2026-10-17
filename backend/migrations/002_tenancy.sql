-- 002_tenancy: every business row belongs to exactly one organization.
-- Existing data (if any) is backfilled into organization #1 ("NexusWave").

CREATE TABLE IF NOT EXISTS organizations (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    industry    VARCHAR(100),
    size        VARCHAR(50),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- The current company becomes org #1, but only on a DB that already has users.
-- A fresh DB starts empty; organizations are created through onboarding.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users) THEN
        INSERT INTO organizations (id, name, slug) VALUES (1, 'NexusWave', 'nexuswave')
        ON CONFLICT (id) DO NOTHING;
        PERFORM setval(pg_get_serial_sequence('organizations', 'id'), GREATEST((SELECT MAX(id) FROM organizations), 1));
    ELSE
        -- Global seed rows from 001 have no owner; each org seeds its own.
        DELETE FROM departments;
        DELETE FROM tags;
    END IF;
END $$;

DO $$
DECLARE
    t TEXT;
    tenant_tables TEXT[] := ARRAY[
        'users', 'departments', 'tags',
        'clients', 'client_notes', 'client_tags', 'client_strategies', 'client_deactivation_requests',
        'tasks', 'task_submissions', 'events', 'schedules',
        'concerns', 'internal_concerns', 'cst_templates', 'resource_boards', 'user_notepads',
        'follow_ups', 'call_recordings', 'important_call_recordings',
        'monthly_targets', 'cst_agent_targets', 'performance_reviews',
        'payrolls', 'expenses', 'daily_attendance', 'attendance_breaks'
    ];
BEGIN
    FOREACH t IN ARRAY tenant_tables LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES organizations(id) ON DELETE CASCADE', t);
        EXECUTE format('UPDATE %I SET tenant_id = 1 WHERE tenant_id IS NULL', t);
        EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET NOT NULL', t);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id)', 'idx_' || t || '_tenant', t);
    END LOOP;
END $$;

-- Lookup lists are per organization now.
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS departments_tenant_name_key ON departments (tenant_id, name);
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS tags_tenant_name_key ON tags (tenant_id, name);
