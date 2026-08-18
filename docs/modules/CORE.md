# Módulo: Core — Plataforma HoloSpace Baseline

> **Tipo:** Módulo Base Principal (Siempre Activo / Inmutable)  
> **URL Directa:** `http://localhost:3001/core`  
> **Entitlement:** Mandatorio (`core`)  
> **Ubicación en el código:** `modules/core/`  
> **Rol Autorizado:** `SUPERADMIN` (Acceso exclusivo a configuración y auditoría)

---

## 1. Descripción General

El módulo **Core** constituye el motor base de la plataforma HoloSpace Baseline. Provee la infraestructura compartida sobre la cual operan los módulos funcionales de negocio (como Kanban o Scanner).

---

## 2. Componentes Principales

### 2.1 Autenticación & Control de Sesión Multi-Tenant
- **Validación JWT:** Credenciales validadas contra PostgreSQL 16 (`users`) con hashing criptográfico seguro `scrypt`.
- **Persistencia Local:** Almacenamiento seguro en `localStorage` usando el prefijo de plataforma `hw_` (`hs_token`, `hs_user`, `hs_tenant_id`, `hs_saved_email`).
- **Control RBAC y Aislamiento 403:** Roles `SUPERADMIN`, `ADMIN`, `OPERATOR` verificados server-side en cada endpoint. Acceso no autorizado genera pantalla 403 y log de seguridad.

### 2.2 Gestión de Usuarios Globales (ABM + Nick/Username)
- Alta y edición de usuarios con nombre, nick (@username), email, rol y organización asociada (`tenant_id`).
- **Borrado Lógico:** Desactivación (`is_active = false`) para preservar la integridad del historial de auditoría y pedidos.

### 2.3 Panel de Gestión de Plataforma (Super Admin)
- **Ruta Backend:** `GET/POST /api/modules`.
- **Vista Web:** Pestaña `Plataforma y Módulos` exclusiva para usuarios con rol `SUPERADMIN`.
- **Funcionalidades:**
  - Visualización del catálogo oficial de módulos instalados (`tenant`, `core`, `kanban`, `scanner`).
  - Switches interactivos para activar/desactivar módulos en tiempo real.
  - Registro inmutable de eventos en la tabla `platform_audit_logs`.

### 2.4 Motor de Temas Visuales Global y Corporativo
- **Herencia Jerárquica de Temas:** Usuario ➔ Organización (Tenant Default) ➔ Plataforma Base.
- **Paletas Oficiales:**
  - `omarchy_tiling`: Omarchy Tiling WM (Dracula & Emerald - 4px square tiling).
  - `omarchy_aetheria`: Omarchy Aetheria (Teal & Deep Violet OLED - 4px square tiling).
  - `dark_glassmorphism`: Dark Glassmorphism.
  - `cyberpunk_glassmorphism`: Cyberpunk Glassmorphism.
  - `soft_minimal_pastel`: Soft Minimal Pastel.

---

## 3. Tablas de Base de Datos PostgreSQL 16 (RLS)

| Tabla | Descripción |
|---|---|
| `users` | Usuarios del sistema, roles (`SUPERADMIN`, `ADMIN`, `OPERATOR`), `tenant_id`, username y hashes scrypt. |
| `app_settings` | Configuración global y por tenant (tema activo `active_theme`, etc.). |
| `platform_audit_logs` | Auditoría inmutable de plataforma (activación de módulos, altas de tenants, seguridad). |
| `modules` | Catálogo oficial de módulos (`tenant`, `core`, `kanban`, `scanner`). |
| `plans` | Catálogo de planes SaaS comerciales (`starter`, `pro`, `enterprise`). |

---

## 4. Rutas API Core

| Ruta | Método | Rol Mínimo | Descripción |
|---|---|---|---|
| `/api/login` | POST | Público | Autenticación JWT Multi-Tenant. |
| `/api/users` | GET / POST / PUT / DELETE | SUPERADMIN / ADMIN | ABM y consulta de usuarios con aislamiento por organización. |
| `/api/theme` | GET / POST | Público / Autenticado | Consulta y actualización de tema activo. |
| `/api/modules` | GET / POST | SUPERADMIN | Catálogo y activación/desactivación de módulos. |
| `/api/platform-audit` | GET | SUPERADMIN | Consulta del log de auditoría inmutable de plataforma. |
| `/api/config` | GET | Público | Consulta de IP dinámica LAN y versión de la aplicación. |
