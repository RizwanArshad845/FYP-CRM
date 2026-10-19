-- 007_platform_admin: AICRE's own operators (plan Section 4). Not a tenant table:
-- no tenant_id, and platform admins are never rows in users. Accounts are created
-- with `npm run platform:create-admin`, never through a public signup.

CREATE TABLE IF NOT EXISTS platform_admins (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
