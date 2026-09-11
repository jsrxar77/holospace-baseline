-- ============================================================================
-- MIGRACIÓN 02: ELIMINACIÓN DEFINITIVA DE VISTAS DE COMPATIBILIDAD RETROACTIVA
-- Modo desarrollo Alpha: Todo el stack accede directamente a tablas modulares
-- ============================================================================

DROP VIEW IF EXISTS users CASCADE;
DROP VIEW IF EXISTS orders CASCADE;
DROP VIEW IF EXISTS order_items CASCADE;
DROP VIEW IF EXISTS tenants CASCADE;
DROP VIEW IF EXISTS roles CASCADE;
DROP VIEW IF EXISTS permissions CASCADE;
DROP VIEW IF EXISTS role_permissions CASCADE;
DROP VIEW IF EXISTS modules CASCADE;
DROP VIEW IF EXISTS plans CASCADE;
DROP VIEW IF EXISTS app_settings CASCADE;
DROP VIEW IF EXISTS audit_logs CASCADE;
DROP VIEW IF EXISTS platform_audit_logs CASCADE;
