-- ============================================================================
-- HOLOSPACE SAAS MULTI-TENANT: POSTGRESQL 16 PRODUCTION DDL SCHEMA (WITH RLS)
-- ESQUEMA CON TABLAS MODULARES DESACOPLADAS (HW-MODULAR-TABLES)
-- ============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1.1 MIGRACIÓN AUTOMÁTICA DE TABLAS EXISTENTES A PREFIJOS MODULARES
-- ============================================================================
DO $$
BEGIN
  -- Módulo Tenant
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenants') AND
     NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenant_tenants') THEN
    ALTER TABLE tenants RENAME TO tenant_tenants;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'modules') AND
     NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenant_modules_catalog') THEN
    ALTER TABLE modules RENAME TO tenant_modules_catalog;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'plans') AND
     NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenant_plans') THEN
    ALTER TABLE plans RENAME TO tenant_plans;
  END IF;

  -- Módulo Core
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'permissions') AND
     NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'core_permissions') THEN
    ALTER TABLE permissions RENAME TO core_permissions;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'roles') AND
     NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'core_roles') THEN
    ALTER TABLE roles RENAME TO core_roles;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'role_permissions') AND
     NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'core_role_permissions') THEN
    ALTER TABLE role_permissions RENAME TO core_role_permissions;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') AND
     NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'core_users') THEN
    ALTER TABLE users RENAME TO core_users;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') AND
     NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'core_audit_logs') THEN
    ALTER TABLE audit_logs RENAME TO core_audit_logs;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'platform_audit_logs') AND
     NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'core_platform_audit_logs') THEN
    ALTER TABLE platform_audit_logs RENAME TO core_platform_audit_logs;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'app_settings') AND
     NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'core_app_settings') THEN
    ALTER TABLE app_settings RENAME TO core_app_settings;
  END IF;

  -- Módulo Kanban / Scanner
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') AND
     NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'kanban_orders') THEN
    ALTER TABLE orders RENAME TO kanban_orders;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'order_items') AND
     NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'kanban_order_items') THEN
    ALTER TABLE order_items RENAME TO kanban_order_items;
  END IF;
END $$;

-- ============================================================================
-- 2. TABLAS MAESTRAS DE PLATAFORMA (MÓDULO TENANT & FACTURACIÓN)
-- ============================================================================

-- Tabla de Organizaciones / Empresas (Tenant)
CREATE TABLE IF NOT EXISTS tenant_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  custom_domain VARCHAR(255) UNIQUE DEFAULT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial', 'canceled')),
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_tenants_slug ON tenant_tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenant_tenants_status ON tenant_tenants(status);

-- Tabla de Suscripciones & Planes por Tenant
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_tenants(id) ON DELETE CASCADE,
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
  tenant_id UUID NOT NULL REFERENCES tenant_tenants(id) ON DELETE CASCADE,
  module_code VARCHAR(64) NOT NULL CHECK (module_code IN ('landing', 'tenant', 'tenants', 'core', 'kanban', 'scanner', 'scanban-board', 'scanban-scanner', 'scanflow', 'scanban', 'stockflow', 'analytics', '4see')),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  quota_limit INT DEFAULT NULL,
  quota_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, module_code)
);

CREATE INDEX IF NOT EXISTS idx_tenant_modules_lookup ON tenant_modules(tenant_id, module_code);

-- Catálogo Oficial de Módulos de la Plataforma
CREATE TABLE IF NOT EXISTS tenant_modules_catalog (
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

CREATE INDEX IF NOT EXISTS idx_modules_catalog_key ON tenant_modules_catalog(key);

-- Catálogo Oficial de Planes SaaS
CREATE TABLE IF NOT EXISTS tenant_plans (
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

CREATE INDEX IF NOT EXISTS idx_tenant_plans_code ON tenant_plans(code);

-- ============================================================================
-- 3. MÓDULO CORE: ROLES, PERMISOS, USUARIOS Y AUDITORÍA
-- ============================================================================

-- Catálogo Universal de Permisos Granulares
CREATE TABLE IF NOT EXISTS core_permissions (
  key VARCHAR(64) PRIMARY KEY,
  module_code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'operation',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_core_permissions_module ON core_permissions(module_code);

-- Definición Dinámica de Roles (Soporta roles de sistema y roles por tenant)
CREATE TABLE IF NOT EXISTS core_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenant_tenants(id) ON DELETE CASCADE,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_core_roles_tenant ON core_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_core_roles_code ON core_roles(code);

-- Matriz Rol - Permisos (N a M)
CREATE TABLE IF NOT EXISTS core_role_permissions (
  role_id UUID NOT NULL REFERENCES core_roles(id) ON DELETE CASCADE,
  permission_key VARCHAR(64) NOT NULL REFERENCES core_permissions(key) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_core_role_permissions_role ON core_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_core_role_permissions_key ON core_role_permissions(permission_key);

-- Tabla de Usuarios por Tenant
CREATE TABLE IF NOT EXISTS core_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_tenants(id) ON DELETE CASCADE,
  role_id UUID REFERENCES core_roles(id) ON DELETE SET NULL,
  username VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(64) NOT NULL DEFAULT 'OPERATOR',
  is_active BOOLEAN NOT NULL DEFAULT true,
  theme_preference VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, email),
  UNIQUE(tenant_id, username)
);

CREATE INDEX IF NOT EXISTS idx_core_users_tenant_email ON core_users(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_core_users_tenant_username ON core_users(tenant_id, username);
CREATE INDEX IF NOT EXISTS idx_core_users_role ON core_users(role);
CREATE INDEX IF NOT EXISTS idx_core_users_role_id ON core_users(role_id);

-- Tabla de Auditoría & Logs de Plataforma
CREATE TABLE IF NOT EXISTS core_platform_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenant_tenants(id) ON DELETE CASCADE,
  user_email VARCHAR(255) DEFAULT NULL,
  action VARCHAR(128) NOT NULL,
  module_code VARCHAR(64) DEFAULT 'core',
  details JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_core_audit_tenant_date ON core_platform_audit_logs(tenant_id, created_at DESC);

-- Tabla de Configuraciones Globales de Tenant (Temas, UI)
CREATE TABLE IF NOT EXISTS core_app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_tenants(id) ON DELETE CASCADE,
  key VARCHAR(128) NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_core_settings_tenant_key ON core_app_settings(tenant_id, key);

-- ============================================================================
-- 4. MÓDULO KANBAN / SCANNER: PEDIDOS, ÍTEMS Y TRAZABILIDAD
-- ============================================================================

-- Tabla de Pedidos / Comprobantes (Kanban)
CREATE TABLE IF NOT EXISTS kanban_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_tenants(id) ON DELETE CASCADE,
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kanban_orders_tenant_status ON kanban_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_kanban_orders_tenant_number ON kanban_orders(tenant_id, order_number);

-- Tabla de Ítems / EANs de Pedido (Kanban & Scanner)
CREATE TABLE IF NOT EXISTS kanban_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES kanban_orders(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_kanban_items_tenant_order ON kanban_order_items(tenant_id, order_id);
CREATE INDEX IF NOT EXISTS idx_kanban_items_code ON kanban_order_items(code);

-- Tabla de Trazabilidad y Logs Operativos de Pedidos
CREATE TABLE IF NOT EXISTS core_audit_logs (
  id SERIAL PRIMARY KEY,
  order_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenant_tenants(id) ON DELETE CASCADE,
  timestamp VARCHAR(64) NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  action VARCHAR(64) NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_core_audit_logs_order ON core_audit_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_core_audit_logs_tenant ON core_audit_logs(tenant_id, created_at DESC);

-- ============================================================================
-- 5. MÓDULO 4SEE: MONITORES, AUDITORÍA Y MARGENES
-- ============================================================================

-- Tabla de Monitores de Competidores
CREATE TABLE IF NOT EXISTS fourseee_competitor_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_tenants(id) ON DELETE CASCADE,
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

-- Tabla de Auditoría de Catálogo / Feeds
CREATE TABLE IF NOT EXISTS fourseee_catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_tenants(id) ON DELETE CASCADE,
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

-- Tabla de Reglas de Margen y Repricing
CREATE TABLE IF NOT EXISTS fourseee_margin_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_tenants(id) ON DELETE CASCADE,
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

-- ============================================================================
-- 6. POLÍTICAS DE ROW-LEVEL SECURITY (RLS) - AISLAMIENTO MULTI-TENANT
-- ============================================================================

ALTER TABLE core_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_platform_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fourseee_competitor_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE fourseee_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fourseee_margin_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_roles ENABLE ROW LEVEL SECURITY;

-- Política RLS para core_roles
DROP POLICY IF EXISTS rls_roles_tenant_isolation ON core_roles;
CREATE POLICY rls_roles_tenant_isolation ON core_roles
  FOR ALL
  USING (
    current_setting('app.is_superadmin', true) = 'true'
    OR tenant_id IS NULL
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_superadmin', true) = 'true'
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- Políticas RLS para módulo 4see
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

-- Política RLS para core_users
DROP POLICY IF EXISTS rls_users_tenant_isolation ON core_users;
CREATE POLICY rls_users_tenant_isolation ON core_users
  FOR ALL
  USING (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- Política RLS para kanban_orders
DROP POLICY IF EXISTS rls_orders_tenant_isolation ON kanban_orders;
CREATE POLICY rls_orders_tenant_isolation ON kanban_orders
  FOR ALL
  USING (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- Política RLS para kanban_order_items
DROP POLICY IF EXISTS rls_order_items_tenant_isolation ON kanban_order_items;
CREATE POLICY rls_order_items_tenant_isolation ON kanban_order_items
  FOR ALL
  USING (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- Política RLS para core_audit_logs
DROP POLICY IF EXISTS rls_audit_logs_tenant_isolation ON core_audit_logs;
CREATE POLICY rls_audit_logs_tenant_isolation ON core_audit_logs
  FOR ALL
  USING (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- Política RLS para tenant_modules
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

-- Política RLS para core_app_settings
DROP POLICY IF EXISTS rls_app_settings_isolation ON core_app_settings;
CREATE POLICY rls_app_settings_isolation ON core_app_settings
  FOR ALL
  USING (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- Política RLS para core_platform_audit_logs
DROP POLICY IF EXISTS rls_audit_logs_isolation ON core_platform_audit_logs;
CREATE POLICY rls_audit_logs_isolation ON core_platform_audit_logs
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
-- 7. SEED INICIAL MULTI-TENANT POR DEFECTO
-- ============================================================================

-- Tenant 0: HoloSpace Cloud Platform (Tenant Proveedor Global)
INSERT INTO tenant_tenants (id, slug, name, status)
VALUES ('a0000000-0000-0000-0000-000000000001', 'holospace', 'HoloSpace', 'active')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tenant_subscriptions (tenant_id, plan_code, status, max_users, max_orders_monthly)
VALUES ('a0000000-0000-0000-0000-000000000001', 'enterprise', 'active', 999, 999999)
ON CONFLICT (tenant_id) DO NOTHING;

-- Catálogo de Módulos Oficiales de la Plataforma HoloSpace
INSERT INTO tenant_modules_catalog (key, name, description, category, is_active, activated_by)
VALUES
  ('landing', 'Landing', 'Portal comercial público y catálogo SaaS con precios en ARS y vitrina interactiva.', 'marketing', true, 'system'),
  ('tenant', 'Tenant', 'Panel exclusivo SUPERADMIN para administración de organizaciones, cuotas y licencias.', 'admin', true, 'system'),
  ('core', 'Core', 'Plataforma base: autenticación centralizada, motor de temas y auditoría.', 'system', true, 'system'),
  ('kanban', 'Kanban', 'Módulo Web de logística: Tablero Kanban 4 columnas y explorador de pedidos.', 'operational', true, 'system'),
  ('scanner', 'Scanner', 'Módulo Móvil Expo: Escáner de códigos de barra EAN-13 y validación de depósito.', 'operational', true, 'system'),
  ('4see', '4see', 'Torre de control de e-commerce: monitoreo de competencia, auditoría de catálogo y protección de rentabilidad.', 'operational', true, 'system')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- Catálogo de Planes Oficiales SaaS
INSERT INTO tenant_plans (code, name, description, max_users, max_orders_monthly, included_modules, is_active)
VALUES
  ('starter', 'Plan Starter Inicial', 'Plan esencial para pequeños depósitos y operaciones ágiles.', 5, 500, '["core", "kanban", "scanner"]'::jsonb, true),
  ('pro', 'Plan Pro Profesional', 'Plan integral para empresas medianas con gestión de tablero y escáner.', 15, 3000, '["core", "kanban", "scanner", "4see"]'::jsonb, true),
  ('enterprise', 'Plan Enterprise Ilimitado', 'Acceso total a todas las herramientas y módulos de la plataforma.', 999, 999999, '["core", "tenant", "kanban", "scanner", "4see"]'::jsonb, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  max_users = EXCLUDED.max_users,
  max_orders_monthly = EXCLUDED.max_orders_monthly,
  included_modules = EXCLUDED.included_modules,
  is_active = EXCLUDED.is_active;

-- Catálogo Universal de Permisos Granulares de la Plataforma
INSERT INTO core_permissions (key, module_code, name, description, category)
VALUES
  -- Comodín universal de plataforma
  ('*', 'platform', 'Acceso Total Irrestricto', 'Superadministración completa de la plataforma y todas sus organizaciones.', 'admin'),
  
  -- Módulo Core
  ('core:users:read', 'core', 'Visualizar Usuarios', 'Permite consultar el listado de usuarios de la organización.', 'read'),
  ('core:users:manage', 'core', 'Gestionar Usuarios', 'Permite crear, editar, suspender y reasignar roles a usuarios.', 'write'),
  ('core:roles:read', 'core', 'Visualizar Roles y Permisos', 'Permite consultar el directorio de roles y matriz de permisos.', 'read'),
  ('core:roles:manage', 'core', 'Gestionar Roles y Permisos', 'Permite crear, editar y eliminar roles personalizados.', 'write'),
  ('core:audit:read', 'core', 'Consultar Auditoría', 'Permite visualizar los registros y logs de auditoría.', 'read'),
  ('core:theme:manage', 'core', 'Configurar Tema Corporativo', 'Permite cambiar el tema visual predeterminado del tenant.', 'write'),

  -- Módulo Tenant (Gobierno SaaS)
  ('tenant:tenants:read', 'tenant', 'Visualizar Organizaciones', 'Permite consultar el directorio de tenants registrados.', 'read'),
  ('tenant:tenants:manage', 'tenant', 'Gestionar Organizaciones', 'Permite dar de alta, editar y suspender organizaciones.', 'write'),
  ('tenant:quotas:manage', 'tenant', 'Gestionar Cuotas y Planes', 'Permite modificar límites y asignaciones de planes SaaS.', 'write'),
  ('tenant:modules:manage', 'tenant', 'Gestionar Entitlements', 'Permite habilitar o deshabilitar módulos a organizaciones.', 'write'),

  -- Módulo Kanban (Logística)
  ('kanban:orders:read', 'kanban', 'Visualizar Tablero y Pedidos', 'Permite consultar el tablero Kanban y el explorador de comprobantes.', 'read'),
  ('kanban:orders:ingest', 'kanban', 'Ingesta y Parseo de PDF', 'Permite subir remitos y comprobantes para su procesamiento.', 'write'),
  ('kanban:orders:assign', 'kanban', 'Asignación de Operarios', 'Permite asignar pedidos a operarios de depósito.', 'write'),
  ('kanban:orders:dispatch', 'kanban', 'Despacho y Cierre de Pedidos', 'Permite despachar órdenes y cerrar pedidos completados.', 'write'),

  -- Módulo Scanner (Móvil Depósito)
  ('scanner:items:scan', 'scanner', 'Escanear Código EAN-13', 'Permite registrar lecturas de códigos de barra en depósito.', 'write'),
  ('scanner:items:verify', 'scanner', 'Verificar Discrepancias', 'Permite auditar diferencias entre leído y esperado en picking.', 'write'),
  ('scanner:orders:view_assigned', 'scanner', 'Ver Órdenes Asignadas', 'Permite acceder a los pedidos asignados para escaneo.', 'read'),

  -- Módulo 4see (Inteligencia E-Commerce)
  ('4see:catalog:read', '4see', 'Consultar Catálogo y Monitores', 'Permite ver productos y competidores monitoreados.', 'read'),
  ('4see:catalog:audit', '4see', 'Auditoría de Catálogo', 'Permite analizar diferencias y cambios de atributos en productos.', 'read'),
  ('4see:pricing:write', '4see', 'Gestión de Precios y Repricing', 'Permite ajustar reglas de precios sugeridos y alertas.', 'write'),
  ('4see:margins:manage', '4see', 'Gestión de Márgenes Mínimos', 'Permite configurar umbrales de rentabilidad y alertas de quiebre.', 'write')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Roles Nativos del Sistema (Globales Basados en Módulos)
INSERT INTO core_roles (id, tenant_id, code, name, description, is_system)
VALUES
  ('c0000000-0000-0000-0000-000000000001', NULL, 'superadmin', 'Super Administrador', 'Control total e irrestricto sobre la plataforma y todas las organizaciones.', true),
  ('c0000000-0000-0000-0000-000000000002', NULL, 'core_admin', 'Core Administrador', 'Gestión integral de usuarios, roles de la empresa, auditoría y temas visuales.', true),
  ('c0000000-0000-0000-0000-000000000003', NULL, 'scanner_operator', 'Scanner Operario', 'Operación de escaneo móvil EAN-13 y verificación física de pedidos asignados.', true),
  ('c0000000-0000-0000-0000-000000000004', NULL, 'tenant_admin', 'Tenant Administrador', 'Gestión de organizaciones, asignación de cuotas, planes y licencias modulares.', true),
  ('c0000000-0000-0000-0000-000000000005', NULL, 'kanban_admin', 'Kanban Administrador', 'Gestión integral del tablero logístico, ingesta de PDF y asignación de pedidos.', true),
  ('c0000000-0000-0000-0000-000000000006', NULL, 'kanban_operator', 'Kanban Operador', 'Consulta del tablero logístico, seguimiento y despacho de pedidos.', true),
  ('c0000000-0000-0000-0000-000000000007', NULL, '4see_admin', '4see Administrador', 'Monitoreo de precios, auditoría de catálogo, repricing táctico y márgenes.', true),
  ('c0000000-0000-0000-0000-000000000008', NULL, '4see_user', '4see Usuario / Analista', 'Consulta de catálogo y análisis de discrepancias de precios en solo lectura.', true)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system;

-- Permisos para Rol: SUPERADMIN (Wildcard total)
INSERT INTO core_role_permissions (role_id, permission_key)
VALUES ('c0000000-0000-0000-0000-000000000001', '*')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Permisos para Rol: CORE_ADMIN
INSERT INTO core_role_permissions (role_id, permission_key)
VALUES
  ('c0000000-0000-0000-0000-000000000002', 'core:users:read'),
  ('c0000000-0000-0000-0000-000000000002', 'core:users:manage'),
  ('c0000000-0000-0000-0000-000000000002', 'core:roles:read'),
  ('c0000000-0000-0000-0000-000000000002', 'core:roles:manage'),
  ('c0000000-0000-0000-0000-000000000002', 'core:audit:read'),
  ('c0000000-0000-0000-0000-000000000002', 'core:theme:manage')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Permisos para Rol: SCANNER_OPERATOR
INSERT INTO core_role_permissions (role_id, permission_key)
VALUES
  ('c0000000-0000-0000-0000-000000000003', 'scanner:orders:view_assigned'),
  ('c0000000-0000-0000-0000-000000000003', 'scanner:items:scan'),
  ('c0000000-0000-0000-0000-000000000003', 'scanner:items:verify')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Permisos para Rol: TENANT_ADMIN
INSERT INTO core_role_permissions (role_id, permission_key)
VALUES
  ('c0000000-0000-0000-0000-000000000004', 'tenant:tenants:read'),
  ('c0000000-0000-0000-0000-000000000004', 'tenant:tenants:manage'),
  ('c0000000-0000-0000-0000-000000000004', 'tenant:quotas:manage'),
  ('c0000000-0000-0000-0000-000000000004', 'tenant:modules:manage'),
  ('c0000000-0000-0000-0000-000000000004', 'core:audit:read')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Permisos para Rol: KANBAN_ADMIN
INSERT INTO core_role_permissions (role_id, permission_key)
VALUES
  ('c0000000-0000-0000-0000-000000000005', 'kanban:orders:read'),
  ('c0000000-0000-0000-0000-000000000005', 'kanban:orders:ingest'),
  ('c0000000-0000-0000-0000-000000000005', 'kanban:orders:assign'),
  ('c0000000-0000-0000-0000-000000000005', 'kanban:orders:dispatch')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Permisos para Rol: KANBAN_OPERATOR
INSERT INTO core_role_permissions (role_id, permission_key)
VALUES
  ('c0000000-0000-0000-0000-000000000006', 'kanban:orders:read'),
  ('c0000000-0000-0000-0000-000000000006', 'kanban:orders:dispatch')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Permisos para Rol: 4SEE_ADMIN
INSERT INTO core_role_permissions (role_id, permission_key)
VALUES
  ('c0000000-0000-0000-0000-000000000007', '4see:catalog:read'),
  ('c0000000-0000-0000-0000-000000000007', '4see:catalog:audit'),
  ('c0000000-0000-0000-0000-000000000007', '4see:pricing:write'),
  ('c0000000-0000-0000-0000-000000000007', '4see:margins:manage')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Permisos para Rol: 4SEE_USER
INSERT INTO core_role_permissions (role_id, permission_key)
VALUES
  ('c0000000-0000-0000-0000-000000000008', '4see:catalog:read'),
  ('c0000000-0000-0000-0000-000000000008', '4see:catalog:audit')
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO tenant_modules (tenant_id, module_code, is_enabled)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'tenant', true),
  ('a0000000-0000-0000-0000-000000000001', 'tenants', true),
  ('a0000000-0000-0000-0000-000000000001', 'core', true),
  ('a0000000-0000-0000-0000-000000000001', 'kanban', true),
  ('a0000000-0000-0000-0000-000000000001', 'scanner', true),
  ('a0000000-0000-0000-0000-000000000001', 'scanban-board', true),
  ('a0000000-0000-0000-0000-000000000001', 'scanban-scanner', true),
  ('a0000000-0000-0000-0000-000000000001', 'scanban', true),
  ('a0000000-0000-0000-0000-000000000001', '4see', true)
ON CONFLICT (tenant_id, module_code) DO UPDATE SET is_enabled = true;

-- ÚNICO SuperAdmin Global de la Plataforma
INSERT INTO core_users (tenant_id, username, email, password_hash, name, role)
VALUES ('a0000000-0000-0000-0000-000000000001', 'superadmin', 'superadmin@holospace.com.ar', 'scrypt:BrunaSeRelambe22!', 'Super Administrador Global', 'SUPERADMIN')
ON CONFLICT (tenant_id, email) DO NOTHING;

INSERT INTO core_app_settings (tenant_id, key, value)
VALUES ('a0000000-0000-0000-0000-000000000001', 'active_theme', 'omarchy_tiling')
ON CONFLICT (tenant_id, key) DO NOTHING;

-- Tenant 1: Drink Lovers Argentina
INSERT INTO tenant_tenants (id, slug, name, status)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'drinklovers', 'Drink Lovers', 'active')
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
  ('550e8400-e29b-41d4-a716-446655440000', 'scanban', true),
  ('550e8400-e29b-41d4-a716-446655440000', '4see', true)
ON CONFLICT (tenant_id, module_code) DO UPDATE SET is_enabled = true;

INSERT INTO core_app_settings (tenant_id, key, value)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'active_theme', 'omarchy_tiling')
ON CONFLICT (tenant_id, key) DO NOTHING;

-- Usuarios Drink Lovers
INSERT INTO core_users (tenant_id, username, email, password_hash, name, role)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'admin', 'admin@drinklovers.com.ar', 'scrypt:drinklovers2026', 'Admin DrinkLovers', 'CORE_ADMIN'),
  ('550e8400-e29b-41d4-a716-446655440000', 'juan', 'juan@drinklovers.com.ar', 'scrypt:juan2026', 'Juan (Operario DrinkLovers)', 'SCANNER_OPERATOR'),
  ('550e8400-e29b-41d4-a716-446655440000', 'vanesa', 'vanesa@drinklovers.com.ar', 'scrypt:vanesa2026', 'Vanesa (Operaria DrinkLovers)', 'SCANNER_OPERATOR')
ON CONFLICT (tenant_id, email) DO NOTHING;

-- Tenant 2: Poke Argentina
INSERT INTO tenant_tenants (id, slug, name, status)
VALUES ('550e8400-e29b-41d4-a716-446655440001', 'poke', 'Poke', 'active')
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
  ('550e8400-e29b-41d4-a716-446655440001', 'scanban', true),
  ('550e8400-e29b-41d4-a716-446655440001', '4see', true)
ON CONFLICT (tenant_id, module_code) DO UPDATE SET is_enabled = true;

INSERT INTO core_app_settings (tenant_id, key, value)
VALUES ('550e8400-e29b-41d4-a716-446655440001', 'active_theme', 'omarchy_tiling')
ON CONFLICT (tenant_id, key) DO NOTHING;

-- Usuarios Poke Argentina
INSERT INTO core_users (tenant_id, username, email, password_hash, name, role)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'admin', 'admin@poke.com.ar', 'scrypt:poke2026', 'Admin Poke', 'CORE_ADMIN'),
  ('550e8400-e29b-41d4-a716-446655440001', 'juan', 'juan@poke.com.ar', 'scrypt:juan2026', 'Juan (Operario Poke)', 'SCANNER_OPERATOR'),
  ('550e8400-e29b-41d4-a716-446655440001', 'vanesa', 'vanesa@poke.com.ar', 'scrypt:vanesa2026', 'Vanesa (Operaria Poke)', 'SCANNER_OPERATOR')
ON CONFLICT (tenant_id, email) DO NOTHING;

-- Sincronización automática de role_id en core_users
UPDATE core_users SET role_id = 'c0000000-0000-0000-0000-000000000001', role = 'SUPERADMIN' WHERE UPPER(role) IN ('SUPERADMIN');
UPDATE core_users SET role_id = 'c0000000-0000-0000-0000-000000000002', role = 'CORE_ADMIN' WHERE UPPER(role) IN ('ADMIN', 'CORE_ADMIN');
UPDATE core_users SET role_id = 'c0000000-0000-0000-0000-000000000003', role = 'SCANNER_OPERATOR' WHERE UPPER(role) IN ('OPERATOR', 'SCANNER_OPERATOR');

-- ============================================================================
-- 8. VISTAS DE COMPATIBILIDAD RETROACTIVA
-- ============================================================================
CREATE OR REPLACE VIEW tenants AS SELECT * FROM tenant_tenants;
CREATE OR REPLACE VIEW modules AS SELECT * FROM tenant_modules_catalog;
CREATE OR REPLACE VIEW plans AS SELECT * FROM tenant_plans;
CREATE OR REPLACE VIEW permissions AS SELECT * FROM core_permissions;
CREATE OR REPLACE VIEW roles AS SELECT * FROM core_roles;
CREATE OR REPLACE VIEW role_permissions AS SELECT * FROM core_role_permissions;
CREATE OR REPLACE VIEW users AS SELECT * FROM core_users;
CREATE OR REPLACE VIEW orders AS SELECT * FROM kanban_orders;
CREATE OR REPLACE VIEW order_items AS SELECT * FROM kanban_order_items;
CREATE OR REPLACE VIEW audit_logs AS SELECT * FROM core_audit_logs;
CREATE OR REPLACE VIEW platform_audit_logs AS SELECT * FROM core_platform_audit_logs;
CREATE OR REPLACE VIEW app_settings AS SELECT * FROM core_app_settings;
