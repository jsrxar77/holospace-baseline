-- ============================================================================
-- TABLAS DEL MÓDULO 4SEE (MONITOR, CATALOG & MARGINS) CON POSTGRESQL 16 RLS
-- ============================================================================

-- 1. Monitor de Competidores
CREATE TABLE IF NOT EXISTS fourseee_competitor_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  competitor_url TEXT NOT NULL,
  competitor_name VARCHAR(128) NOT NULL DEFAULT 'Competidor',
  my_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  competitor_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  competitor_stock VARCHAR(32) NOT NULL DEFAULT 'IN_STOCK',
  extraction_method VARCHAR(64) DEFAULT 'STRUCTURED_DATA',
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fourseee_monitors_tenant ON fourseee_competitor_monitors(tenant_id);

-- 2. Auditoría y Optimización de Catálogo / Feeds
CREATE TABLE IF NOT EXISTS fourseee_catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku VARCHAR(128) NOT NULL,
  original_title TEXT NOT NULL,
  current_title TEXT NOT NULL,
  gtin VARCHAR(64),
  brand VARCHAR(128),
  category VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'NEEDS_REVIEW',
  diagnostics JSONB DEFAULT '[]'::jsonb,
  suggested_title TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fourseee_catalog_tenant ON fourseee_catalog_items(tenant_id);

-- 3. Guardián de Rentabilidad y Repricing
CREATE TABLE IF NOT EXISTS fourseee_margin_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_sku VARCHAR(128) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  min_margin_pct NUMERIC(5, 2) NOT NULL DEFAULT 20.0,
  platform_fee_pct NUMERIC(5, 2) NOT NULL DEFAULT 13.0,
  tax_pct NUMERIC(5, 2) NOT NULL DEFAULT 21.0,
  shipping_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_profit NUMERIC(12, 2) NOT NULL DEFAULT 0,
  real_margin_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  is_red_zone BOOLEAN NOT NULL DEFAULT false,
  suggested_repricing_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fourseee_margins_tenant ON fourseee_margin_rules(tenant_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE fourseee_competitor_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE fourseee_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fourseee_margin_rules ENABLE ROW LEVEL SECURITY;

-- Políticas de aislamiento multi-tenant
DROP POLICY IF EXISTS rls_fourseee_monitors_tenant_isolation ON fourseee_competitor_monitors;
CREATE POLICY rls_fourseee_monitors_tenant_isolation ON fourseee_competitor_monitors
  FOR ALL
  USING (
    current_setting('app.is_superadmin', true) = 'true'
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_superadmin', true) = 'true'
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

DROP POLICY IF EXISTS rls_fourseee_catalog_tenant_isolation ON fourseee_catalog_items;
CREATE POLICY rls_fourseee_catalog_tenant_isolation ON fourseee_catalog_items
  FOR ALL
  USING (
    current_setting('app.is_superadmin', true) = 'true'
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_superadmin', true) = 'true'
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

DROP POLICY IF EXISTS rls_fourseee_margins_tenant_isolation ON fourseee_margin_rules;
CREATE POLICY rls_fourseee_margins_tenant_isolation ON fourseee_margin_rules
  FOR ALL
  USING (
    current_setting('app.is_superadmin', true) = 'true'
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_superadmin', true) = 'true'
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- Registro en la tabla modules
INSERT INTO modules (key, name, description, category, is_active, activated_by)
VALUES (
  '4see',
  '4see',
  'Torre de control de e-commerce: monitoreo de competencia, auditoría de catálogo y protección de rentabilidad.',
  'operational',
  true,
  'system'
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- Actualizar restricción en tenant_modules si existiera el check
ALTER TABLE tenant_modules DROP CONSTRAINT IF EXISTS tenant_modules_module_code_check;
ALTER TABLE tenant_modules ADD CONSTRAINT tenant_modules_module_code_check 
  CHECK (module_code IN ('landing', 'tenant', 'tenants', 'core', 'kanban', 'scanner', 'scanban-board', 'scanban-scanner', 'scanflow', 'scanban', 'stockflow', 'analytics', '4see'));

-- Habilitar 4see por defecto para los tenants existentes Drink Lovers y Poke
INSERT INTO tenant_modules (tenant_id, module_code, is_enabled)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', '4see', true),
  ('550e8400-e29b-41d4-a716-446655440001', '4see', true),
  ('a0000000-0000-0000-0000-000000000001', '4see', true)
ON CONFLICT (tenant_id, module_code) DO UPDATE SET is_enabled = true;
