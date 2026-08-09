# Arquitectura Técnica — HoloWare Baseline

> Arquitectura técnica modular de la plataforma contenedora HoloWare Baseline.

---

## 1. Visión General de la Arquitectura

```
+-----------------------------------------------------------------------+
|                       HoloWare Baseline Container                     |
|                                                                       |
|  +---------------------+  +-------------------------+  +-----------+  |
|  |    HoloWare Core    |  | HoloWare ScanBan Board  |  | StockFlow |  |
|  |     (Web Core)      |  |       (Web Board)       |  | (Futuro)  |  |
|  +---------------------+  +-------------------------+  +-----------+  |
|             |                         |                     |         |
|     Rutas: /api/*             Rutas: /api/scanban/*       /api/...    |
+-----------------------------------------------------------------------+
                                    |
      +-----------------------------+-----------------------------+
      |                                                           |
      v                                                           v
+-------------------------+                         +----------------------------+
|  HoloWare ScanBan       |                         | SQLite Unificado           |
|  Scanner (Mobile Expo)  |                         | holoware.db                |
+-------------------------+                         +----------------------------+
```

---

## 2. Estructura de Carpetas

```
holoware-baseline/
├── docs/                          ← Documentación del proyecto
│   ├── HOLOWARE_PLATFORM.md       ← Visión de plataforma y los 3 módulos
│   ├── ARCHITECTURE.md            ← Este archivo
│   ├── MODULE_CREATION.md         ← Guía de desarrollo de módulos
│   ├── ROADMAP.md                 ← Seguimiento de tareas
│   └── modules/                   ← Especificación por módulo
│       ├── CORE.md                ← Especificación HoloWare Core (Web)
│       ├── SCANBAN_BOARD.md       ← Especificación HoloWare ScanBan Board (Web)
│       ├── SCANBAN_SCANNER.md     ← Especificación HoloWare ScanBan Scanner (Mobile)
│       └── STOCKFLOW.md           ← Plantilla HoloWare StockFlow
│
├── modules/                       ← Código fuente modularizado
│   ├── core/                      ← HoloWare Core (Web: public/, routes/, theme/)
│   ├── scanban/                   ← HoloWare ScanBan Board & Scanner (public/, routes/, src/)
│   └── stockflow/                 ← Plantilla Módulo Futuro
│
├── public/                        ← Entry point web estático (app.js + index.html)
├── data/
│   └── holoware.db                ← Base de datos SQLite única
├── server.js                      ← Servidor Node.js principal
├── package.json
└── .env                           ← Variables de entorno (HW_PORT=3001, SUPERADMIN_EMAIL)
```

---

## 3. Catálogo de Módulos y Documentos

- **HoloWare Core (Web):** Ver [docs/modules/CORE.md](./modules/CORE.md).
- **HoloWare ScanBan Board (Web):** Ver [docs/modules/SCANBAN_BOARD.md](./modules/SCANBAN_BOARD.md).
- **HoloWare ScanBan Scanner (Mobile):** Ver [docs/modules/SCANBAN_SCANNER.md](./modules/SCANBAN_SCANNER.md).
- **HoloWare StockFlow (Plantilla):** Ver [docs/modules/STOCKFLOW.md](./modules/STOCKFLOW.md).
- **Guía de Creación de Módulos:** Ver [MODULE_CREATION.md](./MODULE_CREATION.md).
