# Core — Módulo Base de HoloSpace Baseline

> **Estado:** ✅ Siempre activo (no se puede desactivar)

El módulo Core es la base de la plataforma HoloSpace Baseline. Provee todos los servicios compartidos que los demás módulos consumen: autenticación, gestión de usuarios, motor de temas, registro de módulos y auditoría de plataforma.

---

## Componentes

### Core Web Shell
UI base del panel de administración. Incluye login, navegación, gestión de usuarios y selector de temas.

- **Archivos:** `modules/core/public/`
- **Entry point:** servido desde `public/index.html`

### Core API Routes
Endpoints de plataforma disponibles para todos los módulos.

| Ruta | Método | Descripción |
|---|---|---|
| `/api/login` | POST | Autenticación JWT |
| `/api/users` | GET/POST/PUT/DELETE | ABM de usuarios |
| `/api/theme` | GET/POST | Consulta y cambio de tema activo |
| `/api/modules` | GET/POST | Registro y gestión de módulos |
| `/api/log-client-error` | POST | Recepción de logs de error cliente |
| `/api/error-logs` | GET | Consulta de logs de error |

---

## Tablas de Base de Datos

| Tabla | Descripción |
|---|---|
| `users` | Usuarios del sistema. Roles: SUPERADMIN, ADMIN, OPERATOR. |
| `app_settings` | Configuración global (tema activo, etc.). |
| `platform_audit_logs` | Eventos de plataforma (cambios de tema, módulos, accesos). |
| `modules` | Catálogo de módulos disponibles y su estado activo/inactivo. |

---

## Roles

| Rol | Descripción |
|---|---|
| `SUPERADMIN` | Acceso total. Activa/desactiva módulos. Gestiona todos los usuarios. |
| `ADMIN` | Acceso a módulos activos asignados. Gestión dentro de su ámbito. |
| `OPERATOR` | Acceso operativo al módulo asignado. Sin gestión. |
