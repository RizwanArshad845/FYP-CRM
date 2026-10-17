-- 005_permissions: per-org restriction dials on top of the fixed catalog in
-- backend/policy/catalog.js. Rows are overrides only: no row means the catalog
-- default (allowed / visible). An override can restrict, never grant.

CREATE TABLE IF NOT EXISTS portal_action_permissions (
    id                      SERIAL PRIMARY KEY,
    organization_portal_id  INT NOT NULL REFERENCES organization_portals(id) ON DELETE CASCADE,
    tier                    VARCHAR(20) NOT NULL CHECK (tier IN ('Admin', 'Manager', 'Member')),
    action_key              VARCHAR(100) NOT NULL,
    allowed                 BOOLEAN NOT NULL DEFAULT true,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_portal_id, tier, action_key)
);

CREATE TABLE IF NOT EXISTS portal_field_visibility (
    id                      SERIAL PRIMARY KEY,
    organization_portal_id  INT NOT NULL REFERENCES organization_portals(id) ON DELETE CASCADE,
    tier                    VARCHAR(20) NOT NULL CHECK (tier IN ('Admin', 'Manager', 'Member')),
    field_group             VARCHAR(100) NOT NULL,
    visible                 BOOLEAN NOT NULL DEFAULT true,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_portal_id, tier, field_group)
);

ALTER TABLE portal_action_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_field_visibility ENABLE ROW LEVEL SECURITY;
