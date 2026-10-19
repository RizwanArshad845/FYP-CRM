-- 006_customization: per-organization custom client fields and pipeline stages
-- (plan 6.1, 6.2). Stage moves never change clients.status.

CREATE TABLE IF NOT EXISTS field_definitions (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  object_type VARCHAR(30) NOT NULL DEFAULT 'client',
  field_name VARCHAR(100) NOT NULL,
  field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text','number','dropdown','date','checkbox')),
  options JSONB,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, object_type, field_name)
);
CREATE INDEX IF NOT EXISTS idx_field_definitions_tenant ON field_definitions(tenant_id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS custom_fields JSONB;
ALTER TABLE field_definitions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  object_type VARCHAR(30) NOT NULL DEFAULT 'client',
  stage_name VARCHAR(100) NOT NULL,
  stage_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, object_type, stage_name)
);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_tenant ON pipeline_stages(tenant_id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stage_id INT REFERENCES pipeline_stages(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
