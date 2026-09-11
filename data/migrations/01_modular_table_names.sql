-- ============================================================================
-- MIGRACIÓN 01: RENOMBRADO MODULAR DE TABLAS POSTGRESQL (HW-MODULAR-TABLES)
-- ============================================================================

DO $$
BEGIN
  -- 1. Módulo Tenant
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

  -- 2. Módulo Core
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

  -- 3. Módulo Kanban / Scanner
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
-- VISTAS DE COMPATIBILIDAD RETROACTIVA (Para consultas legadas y transitorias)
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
