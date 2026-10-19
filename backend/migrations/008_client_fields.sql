-- 008_client_fields: one per-organization layout of the client record (plan 6.1).
-- Standard fields stay real columns of `clients`; an organization only overrides
-- their label, order, required flag, picklist options, or switches them off.
-- A switched-off field keeps its data and comes back when switched on again.

CREATE TABLE IF NOT EXISTS client_field_settings (
  tenant_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  field_key VARCHAR(50) NOT NULL,
  label VARCHAR(100),
  hidden BOOLEAN NOT NULL DEFAULT false,
  required BOOLEAN,
  display_order INT,
  options JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, field_key)
);
ALTER TABLE client_field_settings ENABLE ROW LEVEL SECURITY;

-- Custom fields get the same switches as standard fields
ALTER TABLE field_definitions ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE field_definitions ADD COLUMN IF NOT EXISTS required BOOLEAN NOT NULL DEFAULT false;
