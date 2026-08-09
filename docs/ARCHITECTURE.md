# Arquitectura Técnica — HoloWare Baseline

> Documentación de arquitectura de la plataforma contenedora HoloWare Baseline.

---

## 1. Visión General de la Arquitectura

HoloWare Baseline es una plataforma web y móvil modular construida sobre un servidor HTTP ligero en Node.js, SQLite persistente (`better-sqlite3`) y un sistema de enrutamiento prefijado por módulos.

```
+-----------------------------------------------------------------------+
|                      HoloWare Baseline Container                      |
|                                                                       |
|  +--------------------+   +-------------------+   +----------------+  |
|  |  Módulo Core       |   |  Módulo ScanBan   |   | Módulo Futuro  |  |
|  |  (Plataforma Base) |   |  (Logística/PDF)  |   |  (StockFlow)   |  |
|  +--------------------+   +-------------------+   +----------------+  |
|                                                                       |
|  Rutas Core: /api/*       Rutas: /api/scanban/*   Rutas: /api/... |
+-----------------------------------------------------------------------+
                                   |
                         +-------------------+
                         | SQLite Unificado  |
                         | holoware.db       |
                         +-------------------+
```

---

## 2. Estructura de Carpetas

```
holoware-baseline/
├── docs/                          ← Documentación del proyecto
│   ├── HOLOWARE_PLATFORM.md       ← Visión de plataforma
│   ├── ARCHITECTURE.md            ← Este archivo
│   ├── MODULE_CREATION.md         ← Guía de desarrollo de módulos
│   ├── ROADMAP.md                 ← Seguimiento de tareas
│   └── modules/                   ← Especificación por módulo
│       ├── CORE.md                ← Documentación del Core
│       ├── SCANBAN.md             ← Documentación de ScanBan
│       └── STOCKFLOW.md           ← Documentación de StockFlow
│
├── modules/                       ← Código fuente modularizado
│   ├── core/                      ← Módulo Core (Autenticación, Usuarios, Temas, SuperAdmin)
│   │   ├── public/                ← HTML, CSS y JS de plataforma
│   │   ├── routes/                ← Enrutador core.routes.js
│   │   └── theme/                 ← Documentación y especificación de paletas
│   ├── scanban/                   ← Módulo ScanBan (Kanban, PDF, App Expo)
│   │   ├── public/                ← JS de ScanBan
│   │   ├── routes/                ← Enrutador scanban.routes.js
│   │   └── src/                   ← App Móvil Expo / React Native
│   └── stockflow/                 ← Plantilla de 2º módulo
│
├── public/                        ← Entry point público estático (app.js + index.html)
├── data/
│   └── holoware.db                ← Base de datos SQLite única
├── server.js                      ← Servidor Node.js principal
├── package.json
└── .env                           ← Variables de entorno (HW_PORT, HW_THEME)
```

---

## 3. Modelo de Datos Unificado (SQLite)

Todas las tablas residen en `./data/holoware.db`:

- **Tablas de Plataforma (Core):**
  - `users`: Identidades, contraseñas y roles (`SUPERADMIN`, `ADMIN`, `OPERATOR`).
  - `app_settings`: Claves globales (tema activo `active_theme`).
  - `platform_audit_logs`: Eventos de plataforma (activación de módulos, cambios de tema).
  - `modules`: Catálogo y estado (`active`) de módulos instalados.

- **Tablas del Módulo ScanBan:**
  - `orders`: Encabezados de comprobantes y PDF Blob Base64.
  - `order_items`: Artículos EAN-13 requeridos y escaneados.
  - `audit_logs`: Logs de escaneo por pedido.

---

## 4. Referencias por Módulo

- **Plataforma Core:** Ver [docs/modules/CORE.md](./modules/CORE.md).
- **Módulo ScanBan:** Ver [docs/modules/SCANBAN.md](./modules/SCANBAN.md).
- **Módulo StockFlow:** Ver [docs/modules/STOCKFLOW.md](./modules/STOCKFLOW.md).
- **Guía de Creación de Módulos:** Ver [MODULE_CREATION.md](./MODULE_CREATION.md).
