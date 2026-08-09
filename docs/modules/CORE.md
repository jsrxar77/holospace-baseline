# Módulo Core — Plataforma HoloWare Baseline

> **Tipo:** Módulo Base Principal (Siempre Activo)  
> **Ubicación en el código:** `modules/core/`

---

## 1. Descripción General

El módulo **Core** constituye el motor base de la plataforma HoloWare Baseline. Provee la infraestructura compartida sobre la cual operan los módulos funcionales de negocio (como ScanBan o StockFlow).

---

## 2. Componentes Principales

### 2.1 Autenticación & Control de Sesión
- **Validación JWT:** Credenciales validadas contra SQLite (`users`).
- **Persistencia Local:** Almacenamiento seguro en `localStorage` usando el prefijo de plataforma `hw_` (`hw_token`, `hw_user`, `hw_saved_email`).
- **Control RBAC:** Roles `SUPERADMIN`, `ADMIN`, `OPERATOR` verificados server-side en cada endpoint.

### 2.2 Gestión de Usuarios (ABM + Borrado Lógico)
- Alta de usuarios con rol y estado de activación.
- Edición de credenciales y roles.
- **Borrado Lógico:** Desactivación (`active = 0`) para preservar la integridad del historial de auditoría.

### 2.3 Panel de Gestión de Plataforma (Super Admin)
- **Ruta Backend:** `GET/POST /api/modules`.
- **Vista Web:** Pestaña `🏛️ Plataforma` exclusiva para usuarios con rol `SUPERADMIN`.
- **Funcionalidades:**
  - Visualización del catálogo de módulos instalados.
  - Switches interactivos para activar/desactivar módulos en tiempo real.
  - Registro inmutable de eventos en la tabla `platform_audit_logs`.

### 2.4 Motor de Temas Visuales Persistente
- **7 Paletas Curadas:** `original`, `catppuccin_mocha`, `cyberpunk_neon`, `nordic_frost`, `dracula_pro`, `emerald_light`, `monochrome_minimal`.
- **Persistencia en DB:** El tema elegido por un administrador se almacena en la tabla `app_settings` (clave `active_theme`).
- **Prioridad:** El tema guardado en SQLite invalida y reemplaza la configuración por defecto de la variable de entorno `HW_THEME`.

### 2.5 Sistema Centralizado de Errores y Diagnóstico
- **Ruta Backend:** `POST /api/log-client-error` / `GET /api/error-logs`.
- **Persistencia en Archivo:** `./data/errors.log`.

---

## 3. Tablas de Base de Datos SQLite (`./data/holoware.db`)

| Tabla | Descripción |
|---|---|
| `users` | Usuarios del sistema, roles (`SUPERADMIN`, `ADMIN`, `OPERATOR`) y estado activo. |
| `app_settings` | Configuración global key-value (tema activo `active_theme`, etc.). |
| `platform_audit_logs` | Auditoría de eventos de plataforma (activación de módulos, cambios de tema). |
| `modules` | Registro de módulos instalados, su estado (`active`), quien lo activó y fecha. |

---

## 4. Rutas API Core

| Ruta | Método | Rol Mínimo | Descripción |
|---|---|---|---|
| `/api/login` | POST | Público | Autenticación y emisión de token JWT. |
| `/api/users` | GET / POST / PUT / DELETE | ADMIN | ABM y consulta de usuarios. |
| `/api/theme` | GET / POST | GET: Público / POST: ADMIN | Consulta y actualización de tema activo. |
| `/api/modules` | GET / POST | GET: Público / POST: SUPERADMIN | Lista y activación/desactivación de módulos. |
| `/api/platform-audit` | GET | SUPERADMIN | Consulta del log de auditoría de plataforma. |
| `/api/log-client-error` | POST | Público | Recepción de errores del cliente web/móvil. |
| `/api/error-logs` | GET | ADMIN | Consulta de errores de diagnóstico. |
