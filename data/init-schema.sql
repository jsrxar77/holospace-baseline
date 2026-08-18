-- ============================================================================
-- HOLOSPACE SAAS MULTI-TENANT: POSTGRESQL 16 PRODUCTION DDL SCHEMA (WITH RLS)
-- ============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. TABLAS MAESTRAS DE PLATAFORMA (TENANTS & FACTURACIÓN)
-- ============================================================================

-- Tabla de Organizaciones / Empresas (Tenants)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  custom_domain VARCHAR(255) UNIQUE DEFAULT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial', 'canceled')),
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Tabla de Suscripciones & Planes por Tenant
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_code VARCHAR(64) NOT NULL DEFAULT 'starter' CHECK (plan_code IN ('starter', 'pro', 'enterprise')),
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  max_users INT NOT NULL DEFAULT 5,
  max_orders_monthly INT NOT NULL DEFAULT 500,
  current_period_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  current_period_end TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON tenant_subscriptions(tenant_id);

-- Tabla de Entitlement / Módulos Habilitados por Tenant
CREATE TABLE IF NOT EXISTS tenant_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_code VARCHAR(64) NOT NULL CHECK (module_code IN ('tenant', 'tenants', 'core', 'kanban', 'scanner', 'scanban-board', 'scanban-scanner', 'scanflow', 'scanban', 'stockflow', 'analytics')),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  quota_limit INT DEFAULT NULL,
  quota_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, module_code)
);

CREATE INDEX IF NOT EXISTS idx_tenant_modules_lookup ON tenant_modules(tenant_id, module_code);

-- Catálogo Oficial de Módulos de la Plataforma
CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(64) NOT NULL DEFAULT 'operational',
  is_active BOOLEAN NOT NULL DEFAULT true,
  activated_by VARCHAR(255) DEFAULT 'system',
  activated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_modules_key ON modules(key);

-- Catálogo Oficial de Planes SaaS
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  max_users INT NOT NULL DEFAULT 5,
  max_orders_monthly INT NOT NULL DEFAULT 500,
  included_modules JSONB NOT NULL DEFAULT '["core"]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plans_code ON plans(code);

-- ============================================================================
-- 3. TABLAS TRANSACCIONALES CON AISLAMIENTO MULTI-TENANT (RLS)
-- ============================================================================

-- Tabla de Usuarios por Tenant
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  username VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'OPERATOR' CHECK (role IN ('SUPERADMIN', 'ADMIN', 'OPERATOR')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  theme_preference VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, email),
  UNIQUE(tenant_id, username)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_username ON users(tenant_id, username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Tabla de Pedidos / Comprobantes (ScanBan)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  uuid VARCHAR(64) DEFAULT NULL,
  order_number VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'BACKLOG' CHECK (status IN ('BACKLOG', 'READY', 'DOING', 'DONE', 'CLOSED', 'PARTIAL_DISPATCH')),
  client_name VARCHAR(255) NOT NULL,
  issue_date VARCHAR(64) DEFAULT NULL,
  pdf_file_name VARCHAR(255) DEFAULT NULL,
  total_items INT NOT NULL DEFAULT 0,
  total_items_required INT NOT NULL DEFAULT 0,
  total_items_scanned INT NOT NULL DEFAULT 0,
  assigned_operator_email VARCHAR(255) DEFAULT NULL,
  operator_email VARCHAR(255) DEFAULT NULL,
  verified_by VARCHAR(255) DEFAULT NULL,
  verified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  dispatch_status VARCHAR(64) DEFAULT 'NO_DESPACHADO',
  dispatch_tracking VARCHAR(255) DEFAULT NULL,
  audit_stamp VARCHAR(255) DEFAULT NULL,
  pdf_blob BYTEA DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_number ON orders(tenant_id, order_number);

-- Tabla de Ítems / EANs de Pedido (ScanBan)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  code VARCHAR(64) NOT NULL,
  description TEXT NOT NULL,
  unit_price NUMERIC(12,2) DEFAULT 0,
  quantity_required INT NOT NULL DEFAULT 1,
  quantity_scanned INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_items_tenant_order ON order_items(tenant_id, order_id);
CREATE INDEX IF NOT EXISTS idx_items_code ON order_items(code);

-- Tabla de Trazabilidad y Logs Operativos de Pedidos (ScanBan)
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  order_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  timestamp VARCHAR(64) NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  action VARCHAR(64) NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_order ON audit_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);

-- Tabla de Auditoría & Logs de Plataforma
CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_email VARCHAR(255) DEFAULT NULL,
  action VARCHAR(128) NOT NULL,
  module_code VARCHAR(64) DEFAULT 'core',
  details JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_date ON platform_audit_logs(tenant_id, created_at DESC);

-- Tabla de Configuraciones Globales de Tenant (Temas, UI)
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key VARCHAR(128) NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_settings_tenant_key ON app_settings(tenant_id, key);

-- ============================================================================
-- 4. POLÍTICAS DE ROW-LEVEL SECURITY (RLS) - AISLAMIENTO CRIPTOGRÁFICO
-- ============================================================================

-- Habilitar RLS en todas las tablas con datos de clientes
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Política RLS para users
DROP POLICY IF EXISTS rls_users_tenant_isolation ON users;
CREATE POLICY rls_users_tenant_isolation ON users
  FOR ALL
  USING (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- 2. Política RLS para orders
DROP POLICY IF EXISTS rls_orders_tenant_isolation ON orders;
CREATE POLICY rls_orders_tenant_isolation ON orders
  FOR ALL
  USING (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- 3. Política RLS para order_items
DROP POLICY IF EXISTS rls_order_items_tenant_isolation ON order_items;
CREATE POLICY rls_order_items_tenant_isolation ON order_items
  FOR ALL
  USING (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- 4. Política RLS para audit_logs
DROP POLICY IF EXISTS rls_audit_logs_tenant_isolation ON audit_logs;
CREATE POLICY rls_audit_logs_tenant_isolation ON audit_logs
  FOR ALL
  USING (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- 5. Política RLS para tenant_modules
DROP POLICY IF EXISTS rls_tenant_modules_isolation ON tenant_modules;
CREATE POLICY rls_tenant_modules_isolation ON tenant_modules
  FOR ALL
  USING (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- 6. Política RLS para app_settings
DROP POLICY IF EXISTS rls_app_settings_isolation ON app_settings;
CREATE POLICY rls_app_settings_isolation ON app_settings
  FOR ALL
  USING (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- 7. Política RLS para platform_audit_logs
DROP POLICY IF EXISTS rls_audit_logs_isolation ON platform_audit_logs;
CREATE POLICY rls_audit_logs_isolation ON platform_audit_logs
  FOR ALL
  USING (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- ============================================================================
-- 5. SEED INICIAL MULTI-TENANT POR DEFECTO
-- ============================================================================

-- Tenant 0: HoloSpace Cloud Platform (Tenant Proveedor Global)
INSERT INTO tenants (id, slug, name, status)
VALUES ('a0000000-0000-0000-0000-000000000001', 'holospace', 'HoloSpace Cloud Platform', 'active')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tenant_subscriptions (tenant_id, plan_code, status, max_users, max_orders_monthly)
VALUES ('a0000000-0000-0000-0000-000000000001', 'enterprise', 'active', 999, 999999)
ON CONFLICT (tenant_id) DO NOTHING;

-- Catálogo de Módulos Oficiales de la Plataforma HoloSpace
INSERT INTO modules (key, name, description, category, is_active, activated_by)
VALUES
  ('tenant', 'Tenant', 'Panel exclusivo SUPERADMIN para administración de organizaciones, cuotas y licencias.', 'admin', true, 'system'),
  ('core', 'Core', 'Plataforma base: autenticación centralizada, motor de temas y auditoría.', 'system', true, 'system'),
  ('kanban', 'Kanban', 'Módulo Web de logística: Tablero Kanban 4 columnas y explorador de pedidos.', 'operational', true, 'system'),
  ('scanner', 'Scanner', 'Módulo Móvil Expo: Escáner de códigos de barra EAN-13 y validación de depósito.', 'operational', true, 'system')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- Catálogo de Planes Oficiales SaaS
INSERT INTO plans (code, name, description, max_users, max_orders_monthly, included_modules, is_active)
VALUES
  ('starter', 'Plan Starter Inicial', 'Plan esencial para pequeños depósitos y operaciones ágiles.', 5, 500, '["core", "kanban", "scanner"]'::jsonb, true),
  ('pro', 'Plan Pro Profesional', 'Plan integral para empresas medianas con gestión de tablero y escáner.', 15, 3000, '["core", "kanban", "scanner"]'::jsonb, true),
  ('enterprise', 'Plan Enterprise Ilimitado', 'Acceso total a todas las herramientas y módulos de la plataforma.', 999, 999999, '["core", "tenant", "kanban", "scanner"]'::jsonb, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  max_users = EXCLUDED.max_users,
  max_orders_monthly = EXCLUDED.max_orders_monthly,
  included_modules = EXCLUDED.included_modules,
  is_active = EXCLUDED.is_active;

INSERT INTO tenant_modules (tenant_id, module_code, is_enabled)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'tenant', true),
  ('a0000000-0000-0000-0000-000000000001', 'tenants', true),
  ('a0000000-0000-0000-0000-000000000001', 'core', true),
  ('a0000000-0000-0000-0000-000000000001', 'kanban', true),
  ('a0000000-0000-0000-0000-000000000001', 'scanner', true),
  ('a0000000-0000-0000-0000-000000000001', 'scanban-board', true),
  ('a0000000-0000-0000-0000-000000000001', 'scanban-scanner', true),
  ('a0000000-0000-0000-0000-000000000001', 'scanban', true)
ON CONFLICT (tenant_id, module_code) DO UPDATE SET is_enabled = true;

-- ÚNICO SuperAdmin Global de la Plataforma
INSERT INTO users (tenant_id, username, email, password_hash, name, role)
VALUES ('a0000000-0000-0000-0000-000000000001', 'superadmin', 'superadmin@holospace.com.ar', 'scrypt:BrunaSeRelambe22!', 'Super Administrador Global', 'SUPERADMIN')
ON CONFLICT (tenant_id, email) DO NOTHING;

INSERT INTO app_settings (tenant_id, key, value)
VALUES ('a0000000-0000-0000-0000-000000000001', 'active_theme', 'omarchy_tiling')
ON CONFLICT (tenant_id, key) DO NOTHING;

-- Tenant 1: Drink Lovers Argentina
INSERT INTO tenants (id, slug, name, status)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'drinklovers', 'Drink Lovers Argentina', 'active')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tenant_subscriptions (tenant_id, plan_code, status, max_users, max_orders_monthly)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'pro', 'active', 15, 3000)
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO tenant_modules (tenant_id, module_code, is_enabled)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'core', true),
  ('550e8400-e29b-41d4-a716-446655440000', 'kanban', true),
  ('550e8400-e29b-41d4-a716-446655440000', 'scanner', true),
  ('550e8400-e29b-41d4-a716-446655440000', 'scanban-board', true),
  ('550e8400-e29b-41d4-a716-446655440000', 'scanban-scanner', true),
  ('550e8400-e29b-41d4-a716-446655440000', 'scanban', true)
ON CONFLICT (tenant_id, module_code) DO UPDATE SET is_enabled = true;

INSERT INTO app_settings (tenant_id, key, value)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'active_theme', 'omarchy_tiling')
ON CONFLICT (tenant_id, key) DO NOTHING;

-- Usuarios Drink Lovers
INSERT INTO users (tenant_id, username, email, password_hash, name, role)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'admin', 'admin@drinklovers.com.ar', 'scrypt:drinklovers2026', 'Admin DrinkLovers', 'ADMIN'),
  ('550e8400-e29b-41d4-a716-446655440000', 'juan', 'juan@drinklovers.com.ar', 'scrypt:juan2026', 'Juan (Operario DrinkLovers)', 'OPERATOR'),
  ('550e8400-e29b-41d4-a716-446655440000', 'vanesa', 'vanesa@drinklovers.com.ar', 'scrypt:vanesa2026', 'Vanesa (Operaria DrinkLovers)', 'OPERATOR')
ON CONFLICT (tenant_id, email) DO NOTHING;

-- Tenant 2: Poke Argentina
INSERT INTO tenants (id, slug, name, status)
VALUES ('550e8400-e29b-41d4-a716-446655440001', 'poke', 'Poke Argentina', 'active')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tenant_subscriptions (tenant_id, plan_code, status, max_users, max_orders_monthly)
VALUES ('550e8400-e29b-41d4-a716-446655440001', 'pro', 'active', 15, 3000)
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO tenant_modules (tenant_id, module_code, is_enabled)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'core', true),
  ('550e8400-e29b-41d4-a716-446655440001', 'kanban', true),
  ('550e8400-e29b-41d4-a716-446655440001', 'scanner', true),
  ('550e8400-e29b-41d4-a716-446655440001', 'scanban-board', true),
  ('550e8400-e29b-41d4-a716-446655440001', 'scanban-scanner', true),
  ('550e8400-e29b-41d4-a716-446655440001', 'scanban', true)
ON CONFLICT (tenant_id, module_code) DO UPDATE SET is_enabled = true;

INSERT INTO app_settings (tenant_id, key, value)
VALUES ('550e8400-e29b-41d4-a716-446655440001', 'active_theme', 'omarchy_tiling')
ON CONFLICT (tenant_id, key) DO NOTHING;

-- Usuarios Poke Argentina
INSERT INTO users (tenant_id, username, email, password_hash, name, role)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'admin', 'admin@poke.com.ar', 'scrypt:poke2026', 'Admin Poke', 'ADMIN'),
  ('550e8400-e29b-41d4-a716-446655440001', 'juan', 'juan@poke.com.ar', 'scrypt:juan2026', 'Juan (Operario Poke)', 'OPERATOR'),
  ('550e8400-e29b-41d4-a716-446655440001', 'vanesa', 'vanesa@poke.com.ar', 'scrypt:vanesa2026', 'Vanesa (Operaria Poke)', 'OPERATOR')
ON CONFLICT (tenant_id, email) DO NOTHING;
