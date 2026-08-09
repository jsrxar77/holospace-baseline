# HoloWare Baseline — Roadmap de Arquitectura y Desarrollo

> Documento vivo de seguimiento. Actualizado a medida que se ejecutan los ítems.
> Última actualización: 2026-08-10

---

## Estructura de Carpetas Objetivo

```
holoware-baseline/
├── docs/                          ← Documentación general de plataforma
│   ├── HOLOWARE_PLATFORM.md
│   ├── ARCHITECTURE.md
│   ├── FEATURES.md
│   └── ROADMAP.md                 ← Este archivo
│
├── modules/
│   ├── core/                      ← Módulo Core (plataforma base)
│   │   ├── public/                ← UI web del core (login, nav, users, theme)
│   │   │   ├── core.js            ← Lógica JS del core
│   │   │   └── index.html         ← Shell HTML principal
│   │   ├── routes/                ← Rutas API del core (login, users, theme, logs)
│   │   │   └── core.routes.js
│   │   └── README.md
│   │
│   └── scanban/                   ← Módulo ScanBan (logística + escaneo)
│       ├── public/                ← UI web de ScanBan (kanban, pdf, explorer)
│       │   └── scanban.js         ← Lógica JS de ScanBan
│       ├── routes/                ← Rutas API de ScanBan (/api/scanban/...)
│       │   └── scanban.routes.js
│       ├── src/                   ← App móvil React Native / Expo
│       ├── orders/                ← PDFs de órdenes
│       └── README.md
│
├── public/                        ← Entry point estático (orquesta módulos)
│   ├── index.html                 ← Incluye core + módulo activo
│   └── app.js                     ← Bootstrap (carga core.js + scanban.js)
│
├── theme/                         ← Paleta de colores y definición de temas
├── bin/                           ← Scripts DevOps
├── data/
│   └── holoware.db                ← SQLite unificado
├── server.js                      ← Servidor Express (importa routes de módulos)
├── App.tsx                        ← Shim Expo → modules/scanban/App.tsx
├── app.json
└── .env
```

---

## Estado de Ejecución

### ✅ COMPLETADO

| # | Ítem | Detalle |
|---|---|---|
| C-01 | Rename filesystem `phone-ware` → `holoware-baseline` | Directorio movido |
| C-02 | Rename git remote → `jsrxar77/holoware-baseline` | URL actualizada |
| C-03 | Rename DB `phoneware.db` → `holoware.db` | Archivo + referencia en server.js |
| C-04 | Actualizar `README.md` con branding HoloWare | Reescrito |
| C-05 | Actualizar `bin/devops-db-refresh.sh` | Referencia DB corregida |
| C-06 | Crear `modules/scanban/` | src/, orders/, App.tsx, README.md |
| C-07 | Root `App.tsx` shim para Expo | Re-exporta desde modules/scanban/App |
| C-08 | Crear `docs/HOLOWARE_PLATFORM.md` | Visión de plataforma documentada |
| C-09 | Actualizar `docs/ARCHITECTURE.md` | Rebrandeado a ScanBan/HoloWare |
| C-10 | Actualizar `docs/FEATURES.md` | Sección §0 Core + ScanBan rebrandeado |
| C-11 | Git commit consolidado | 33 files, historial de renombres preservado |
| C-12 | Crear `modules/core/` (carpeta + README) | `modules/core/public/`, `routes/`, `README.md` |
| C-13 | Tabla `modules` en DB + seed ScanBan | `server.js` — `initModules()` |
| C-14 | Tabla `platform_audit_logs` en DB | `server.js` — core platform event auditing |
| C-15 | Soporte rol `SUPERADMIN` + seed user | `server.js` — `superadmin@holoware.io` / `HoloWare2026!` |
| C-16 | Crear `docs/ROADMAP.md` | Este archivo |
| C-17 | P-05: Prefijar rutas ScanBan → `/api/scanban/...` | `server.js` — 21 rutas migradas |
| C-18 | P-06: Actualizar `public/app.js` | Rutas `/api/scanban/...` + localStorage `pw_` → `hw_` |
| C-19 | P-07: Actualizar app móvil `modules/scanban/src/` | `HomeScreen.tsx`, `fileWorkflowService.ts` |
| C-20 | P-08: Endpoint `GET/POST /api/modules` | SUPERADMIN toggle + log en `platform_audit_logs` |
| C-21 | P-09: Panel Super Admin (UI) | Pestaña `🏛️ Plataforma` (SUPERADMIN only) + gestión de módulos + logs |
| C-22 | P-10: Modulos public JS (`core.js`, `scanban.js`) | `modules/core/public/core.js` y `modules/scanban/public/scanban.js` |

---

### 🔴 PENDIENTE — Alta Prioridad

*(¡Todos los ítems de alta prioridad han sido completados!)*

---

### 🟡 PENDIENTE — Media Prioridad

| # | Ítem | Dónde | Descripción |
|---|---|---|---|
| M-01 | **Renombrar localStorage `pw_` → `hw_`** | `public/app.js` | Consistencia con convención de plataforma |
| M-02 | **Separar `core.routes.js`** | `modules/core/routes/` | Extraer rutas core de server.js a archivo propio |
| M-03 | **Separar `scanban.routes.js`** | `modules/scanban/routes/` | Extraer rutas ScanBan de server.js a archivo propio |
| M-04 | **Mover `index.html` → `modules/core/public/`** | `modules/core/public/` | server.js sirve desde allí |
| M-05 | **Seed de usuario SUPERADMIN** | `server.js` (initUsers) | Crear usuario superadmin por defecto vía .env |

---

### 🟢 PENDIENTE — Baja Prioridad / Futuro

| # | Ítem | Dónde | Descripción |
|---|---|---|---|
| L-01 | Prefijo `HW_` en variables de `.env` | `.env` + `server.js` | Renombrar `THEME` → `HW_THEME`, `PORT` → `HW_PORT` |
| L-05 | Convertir a monorepo real | `modules/scanban/package.json` | Dar a ScanBan su propio `package.json` + `node_modules`. `.expo/` vivirá dentro de `modules/scanban/` naturalmente. |
| L-02 | Git push a `holoware-baseline` en GitHub | GitHub + terminal | **Requiere rename manual del repo en GitHub primero** |
| L-03 | Módulo StockFlow (estructura base) | `modules/stockflow/` | Crear carpeta y README como plantilla de futuro módulo |
| L-04 | Documentar convención de creación de módulos | `docs/MODULE_CREATION.md` | Guía paso a paso para agregar un nuevo módulo |

---

## Convenciones de Rutas

| Tipo | Prefijo | Ejemplo |
|---|---|---|
| Core Platform | `/api/` | `/api/login`, `/api/users`, `/api/theme` |
| Módulo ScanBan | `/api/scanban/` | `/api/scanban/kanban`, `/api/scanban/upload-pdf` |
| Módulo futuro | `/api/<modulo>/` | `/api/stockflow/items` |

## Convenciones de LocalStorage

| Tipo | Prefijo | Ejemplo |
|---|---|---|
| Core Platform | `hw_` | `hw_token`, `hw_user` |
| Módulo ScanBan | `hw_sb_` | `hw_sb_active_order` |

## Convenciones de Variables de Entorno

| Tipo | Prefijo | Ejemplo |
|---|---|---|
| Core Platform | `HW_` | `HW_THEME`, `HW_PORT` |
| Módulo ScanBan | `HW_SB_` | `HW_SB_MAX_ORDERS` |

---

## Registro de Cambios

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-08-09 | 0.1 | Creación inicial del roadmap |
| 2026-08-10 | 0.2 | Rename completo + modules/scanban/ creado |

