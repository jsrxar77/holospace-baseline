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
| C-03 | Migración a PostgreSQL 16 con RLS | Tablas `tenants`, `users`, `orders`, `order_items`, `tenant_modules` |
| C-04 | Actualizar `README.md` con credenciales y URLs directas | Actualizado con los 4 módulos y Smart Auth Guard |
| C-05 | Script DevOps de refresco y siembra de BD | `bin/devops-db-refresh.sh` |
| C-06 | Catálogo Oficial de 4 Módulos | **`Tenant`**, **`Core`**, **`Kanban`**, **`Scanner`** |
| C-07 | Enrutamiento Directo por URL SPA | `/tenant`, `/core`, `/kanban`, `/scanner` servidos limpiamente |
| C-08 | Smart Auth Guard & RBAC 403 Screen | Redirección automática inteligente por rol y pantalla de acceso restringido |
| C-09 | Tema Omarchy Aetheria & Bordes 4px Tiling WM | Paleta OLED Deep Violet + Teal con regla 4px square tiling |
| C-10 | Dropdown Flotante de Usuario | Botón superior compacto con username y menú desplegable |
| C-11 | Versionado dinámico en Footer | Lectura en tiempo real desde `package.json` vía `/api/config` |
| C-12 | Suite de Pruebas Automatizadas | `verify-db-integrity.js`, `test-auth-jwt.js`, `test-entitlement.js` |

---

### 🔴 PENDIENTE — Alta Prioridad

*(¡Todos los ítems de alta prioridad han sido completados!)*

---

### 🟡 PENDIENTE — Media Prioridad

*(¡Todos los ítems de media prioridad han sido completados!)*

---

### 🟢 PENDIENTE — Baja Prioridad / Futuro

| # | Ítem | Dónde | Descripción |
|---|---|---|---|
| L-02 | Git push a `holoware-baseline` en GitHub | GitHub + terminal | **Requiere rename manual del repo en GitHub primero** |
| L-05 | Monorepo con `package.json` propio | `modules/scanban/package.json` | Dar a ScanBan su propio `package.json` + `node_modules` en el futuro |

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
| 2026-08-14 | 1.1.0 | Sistema de Diseño Centralizado (HW-DS), Motor 4 Temas y Reglas de Seguridad Cero Mocks |

