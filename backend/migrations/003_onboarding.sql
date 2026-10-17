-- 003_onboarding: fixed portal catalog, per-org portal config, per-user portal
-- access, and wizard progress.

-- Fixed catalog, never tenant-editable. `key` equals the matching roles.name,
-- so assigning a portal also assigns the legacy role used by existing checks.
CREATE TABLE IF NOT EXISTS portal_types (
    id            SERIAL PRIMARY KEY,
    key           VARCHAR(50) NOT NULL UNIQUE,
    label         VARCHAR(100) NOT NULL,
    description   TEXT,
    default_tier  VARCHAR(20) NOT NULL CHECK (default_tier IN ('Admin', 'Manager', 'Member')),
    sort_order    INT NOT NULL DEFAULT 0
);

INSERT INTO portal_types (key, label, description, default_tier, sort_order) VALUES
    ('admin',         'Admin',         'Company-wide administration, employees, performance and events', 'Admin',   1),
    ('sales',         'Sales',         'Sales agents: follow-ups, call recordings, monthly targets',      'Member',  2),
    ('sales_manager', 'Sales Manager', 'Client entry, sales targets and team performance',                'Manager', 3),
    ('cst',           'CST',           'Customer success agents: active clients, notes, schedules',      'Member',  4),
    ('cst_manager',   'CST Manager',   'Client assignment, strategies, deactivations, CST targets',       'Manager', 5),
    ('finance',       'Finance',       'Payroll, salary slips and expenses',                              'Member',  6)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS organization_portals (
    id              SERIAL PRIMARY KEY,
    tenant_id       INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    portal_type_id  INT NOT NULL REFERENCES portal_types(id),
    enabled         BOOLEAN NOT NULL DEFAULT true,
    custom_label    VARCHAR(100),
    -- Display-only overrides per tier, e.g. {"Member": "Account Executive"}
    tier_labels     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, portal_type_id)
);

CREATE TABLE IF NOT EXISTS user_portal_access (
    id                      SERIAL PRIMARY KEY,
    tenant_id               INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id                 INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    organization_portal_id  INT NOT NULL REFERENCES organization_portals(id),
    tier                    VARCHAR(20) NOT NULL CHECK (tier IN ('Admin', 'Manager', 'Member')),
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_portal_access_tenant ON user_portal_access (tenant_id);

CREATE TABLE IF NOT EXISTS onboarding_state (
    id            SERIAL PRIMARY KEY,
    tenant_id     INT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    current_step  VARCHAR(50) NOT NULL DEFAULT 'portals',
    completed     BOOLEAN NOT NULL DEFAULT false,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Backfill every existing organization so it keeps working unchanged:
-- all portals enabled, users mapped from their role, onboarding complete.
INSERT INTO organization_portals (tenant_id, portal_type_id)
SELECT o.id, pt.id FROM organizations o CROSS JOIN portal_types pt
ON CONFLICT (tenant_id, portal_type_id) DO NOTHING;

INSERT INTO user_portal_access (tenant_id, user_id, organization_portal_id, tier)
SELECT u.tenant_id, u.id, op.id, pt.default_tier
FROM users u
JOIN roles r ON r.id = u.role_id
JOIN portal_types pt ON pt.key = r.name
JOIN organization_portals op ON op.tenant_id = u.tenant_id AND op.portal_type_id = pt.id
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO onboarding_state (tenant_id, current_step, completed)
SELECT id, 'done', true FROM organizations
ON CONFLICT (tenant_id) DO NOTHING;
