# HoloWare Baseline — Visión de Plataforma

> **Versión:** 1.0 · **Última actualización:** 2026-08-10

---

## 1. Visión General

**HoloWare Baseline** es una plataforma modular empresarial de clase mundial diseñada para contener múltiples aplicaciones (módulos), todas compartiendo una base tecnológica común: base de datos, esquema de usuarios, sistema de temas, autenticación y gobernanza de acceso.

La arquitectura está pensada para que un **Super Admin** pueda activar o desactivar módulos según las necesidades del negocio, sin necesidad de redeployar la infraestructura base.

```
┌───────────────────────────────────────────────────────────┐
│                  HOLOWARE BASELINE (Core)                 │
│  Auth · Users · Themes · Module Registry · Audit · Logs  │
├───────────────┬───────────────────────────────────────────┤
│  [M] ScanBan  │  [M] Módulo 2  │  [M] Módulo N  │  ...   │
│  (activo)     │  (inactivo)    │  (futuro)      │        │
└───────────────┴───────────────────────────────────────────┘
```

---

## 2. Estructura del Repositorio

```
holoware-baseline/
├── docs/                         ← Documentación de plataforma y módulos
│   ├── HOLOWARE_PLATFORM.md      ← Este documento
│   ├── ARCHITECTURE.md           ← Arquitectura técnica detallada
│   └── FEATURES.md               ← Especificación de funcionalidades
├── public/                       ← Shell web de HoloWare (login, admin core)
│   ├── index.html
│   └── app.js
├── modules/
│   └── scanban/                  ← Módulo ScanBan (primer módulo)
│       ├── src/                  ← Código fuente mobile (React Native/Expo)
│       ├── orders/               ← Archivos de órdenes de trabajo
│       └── README.md
├── theme/                        ← Paleta de colores y definición de temas
│   └── original.md
├── bin/                          ← Scripts DevOps
├── data/                         ← Base de datos SQLite y logs de error
│   └── holoware.db
├── server.js                     ← Servidor Express unificado
├── app.json                      ← Configuración Expo (mobile)
└── .env                          ← Variables de entorno (tema, puerto, etc.)
```

---

## 3. Responsabilidades: Plataforma vs. Módulos

### 3.1 HoloWare Baseline (Core — Siempre presente)

| Componente | Descripción |
|---|---|
| **Autenticación & Sesiones** | Login JWT, RBAC (Super Admin, Admin, Operator). Compartido por todos los módulos. |
| **Gestión de Usuarios** | ABM de usuarios, borrado lógico, roles globales. |
| **Base de Datos Core** | Tablas `users`, `app_settings`, `platform_audit_logs`. |
| **Motor de Temas** | Definición, persistencia en DB y distribución de temas CSS a web y mobile. |
| **Registro de Módulos** | Catálogo de módulos disponibles, activos/inactivos por Super Admin. |
| **Logs de Errores** | Endpoint centralizado `POST /api/log-client-error`, `GET /api/error-logs`. |
| **Shell Web Admin** | Estructura base del panel (login, navegación, header, sidebar). |
| **DevOps Scripts** | `devops-db-refresh.sh`, `devops-git-push-verify.sh`. |

### 3.2 ScanBan (Módulo 1 — Logística & Escaneo)

| Componente | Descripción |
|---|---|
| **Tablero Kanban** | 4 columnas: BACKLOG → LISTO → EN PROCESO → COMPLETADO. |
| **Parser de PDF** | Extracción por coordenadas Y con `pdfjs-dist`. Sin fallbacks silenciosos. |
| **Gestión de Órdenes** | Tablas `orders` y `order_items` en SQLite. Almacenamiento de Blobs PDF. |
| **Explorador de Pedidos** | Búsqueda universal, filtros de estado, multi-selección de operarios. |
| **App Móvil Scanner** | Expo SDK, escaneo EAN-13, feedback háptico y sonoro. |
| **Auditoría por Orden** | Estampa digital inmutable al completar el 100% de ítems. |
| **Visor de Comprobantes** | Vista formateada del comprobante con descarga del PDF original. |

---

## 4. Esquema de Base de Datos Unificado

### 4.1 Tablas Core (HoloWare Baseline)

```sql
-- Usuarios del sistema (compartido por todos los módulos)
CREATE TABLE IF NOT EXISTS users (
  email    TEXT PRIMARY KEY NOT NULL,
  password TEXT NOT NULL,
  name     TEXT NOT NULL,
  role     TEXT NOT NULL,          -- SUPERADMIN | ADMIN | OPERATOR
  active   INTEGER NOT NULL DEFAULT 1
);

-- Configuración global de la plataforma (tema activo, etc.)
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Log de auditoría de eventos de plataforma
CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  userEmail TEXT NOT NULL,
  action    TEXT NOT NULL,
  details   TEXT NOT NULL
);

-- Registro de módulos disponibles y su estado
CREATE TABLE IF NOT EXISTS modules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  active      INTEGER NOT NULL DEFAULT 0,
  activatedBy TEXT,
  activatedAt TEXT
);
```

### 4.2 Tablas de ScanBan (Módulo)

```sql
CREATE TABLE IF NOT EXISTS orders ( ... );
CREATE TABLE IF NOT EXISTS order_items ( ... );
CREATE TABLE IF NOT EXISTS audit_logs ( ... );
```
*(Ver ARCHITECTURE.md para el DDL completo)*

---

## 5. Roles y Gobernanza

| Rol | Alcance |
|---|---|
| **Super Admin** | Acceso total. Activa/desactiva módulos. Gestión global. |
| **Admin** | Acceso a módulos activos asignados. Gestiona usuarios dentro de su ámbito. |
| **Operator** | Acceso operativo al módulo asignado. Sin acceso a gestión. |

---

## 6. Motor de Temas

Los temas se definen en `theme/original.md` y en el objeto `THEMES` dentro de `server.js`.

**Jerarquía de resolución del tema activo:**
1. ✅ **Base de datos (`app_settings.active_theme`)**: Máxima prioridad. Una vez que un admin elige un tema se persiste aquí, ignorando el `.env`.
2. 🔁 **Variable de entorno (`.env → THEME`)**: Bootstrap inicial.
3. 🎨 **Fallback (`original`)**: Si ninguna de las anteriores está disponible.

Temas disponibles: `original`, `midnight`, `ocean`, `sunset`, `forest`, `neon`, `catppuccin`.

---

## 7. Roadmap de Módulos (Visión Futura)

| Módulo | Estado | Descripción |
|---|---|---|
| **ScanBan** | ✅ Activo | Logística: Kanban + PDF + Scanner móvil. |
| **StockFlow** | 🔜 Planeado | Gestión de inventario en tiempo real. |
| **RouteMap** | 🔜 Planeado | Optimización y seguimiento de rutas de despacho. |
| **ReportHub** | 🔜 Planeado | Generación de reportes y dashboards analíticos. |

---

## 8. Convenciones de Desarrollo

- **Backend**: Node.js + Express + `better-sqlite3`. Rutas prefijadas por módulo (`/api/scanban/...`).
- **Web Frontend**: HTML5 + CSS3 Vanilla (glassmorphism dark).
- **Mobile**: React Native + Expo SDK 51+. TypeScript estricto.
- **Variables de entorno**: Prefijo `HW_` para plataforma (ej: `HW_THEME`, `HW_PORT`).
- **LocalStorage web**: Prefijo `hw_` para claves de plataforma.
- **Módulos**: Cada módulo tiene su carpeta en `modules/<nombre>/` con su `README.md`.
