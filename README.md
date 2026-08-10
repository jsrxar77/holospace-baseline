# HoloWare

> **Plataforma Contenedora Multi-Módulo Enterprise para Gestión Operativa y Logística.**

HoloWare es una infraestructura modular que permite ejecutar múltiples aplicaciones de negocio compartiendo autenticación unificada, esquema relacional de usuarios en SQLite, motor de temas dinámicos y un panel de gestión para el **Super Administrador**.

---

## Módulos Oficiales del Sistema

| Módulo | Entorno | Rol Acceso | Descripción |
|---|---|---|---|
| **HoloWare Core** | Web | `SUPERADMIN` | Gobierno de plataforma, administración de módulos instalados, ABM de usuarios y motor de temas. |
| **ScanBan Board** | Web | `ADMIN` | Tablero Kanban interactivo 4 columnas, ingesta/parser PDF y explorador de pedidos. |
| **ScanBan Scanner** | Mobile (Expo) | `OPERATOR` | App móvil para operarios de depósito con escáner de código de barras EAN-13 y estampa digital. |

---

## Credenciales por Defecto (Entorno de Desarrollo)

| Rol | Email | Contraseña | Permisos / Acceso |
|---|---|---|---|
| **SUPERADMIN** | `superadmin@hologrowth.com.ar` | `BrunaSeRelambe22!` | Bootstrap desde `.env`: Acceso a **HoloWare Core (Web)**. |
| **ADMIN** | `admin@drinklovers.com.ar` | `drinklovers2026!` | Semilla de desarrollo: Acceso a **ScanBan Board (Web)**. |
| **OPERATOR** | `jsrxar@gmail.com` | `Asadito21!` | Semilla de desarrollo: Acceso a **ScanBan Scanner (Mobile)**. |

---

## Inicio Rápido

### Levantar Todo el Entorno (Backend Server + Web Shell + App Móvil Expo)

```bash
npm run dev
```

Un solo comando ejecuta en paralelo:
- **Servidor Backend + Web Shell (`node --watch server.js`):** `http://localhost:3001`
- **App Móvil Expo (`npx expo start -c`):** Servidor Metro para la app móvil **HoloWare ScanBan Scanner**.

---

## 🔒 Aislamiento Absoluto de Dominios por Rol

- **Si inicias sesión como `SUPERADMIN` (`superadmin@hologrowth.com.ar`):**
  - Entras directamente a **`HoloWare Core`** (`🏛️ Plataforma` y `👥 Usuarios Core`).
  - Tienes acceso exclusivo al selector de `🎨 Tema`.
  - **No ves ni accedes a `HoloWare ScanBan Board`**.

- **Si inicias sesión como `ADMIN` (`admin@drinklovers.com.ar`):**
  - Entras directamente a **`HoloWare ScanBan Board`** (`📋 Tablero Kanban` y `🔍 Explorador de Pedidos`).
  - **No ves ni accedes a `HoloWare Core`**.

- **Si inicias sesión como `OPERATOR` (`jsrxar@gmail.com`):**
  - Operas desde la app móvil **`HoloWare ScanBan Scanner`** en Expo.

---

## 📂 Estructura del Proyecto

```
holoware-baseline/
├── docs/                          ← Documentación del proyecto
│   ├── HOLOWARE_PLATFORM.md       ← Visión de plataforma y los 3 módulos
│   ├── ARCHITECTURE.md            ← Arquitectura técnica general
│   ├── MODULE_CREATION.md         ← Guía de desarrollo de módulos
│   ├── ROADMAP.md                 ← Estado de desarrollo y roadmap
│   └── modules/                   ← Especificación por módulo (CORE, SCANBAN_BOARD, SCANBAN_SCANNER)
│
├── modules/                       ← Código fuente modularizado
│   ├── core/                      ← HoloWare Core (Web: public/, routes/, theme/)
│   ├── scanban/                   ← HoloWare ScanBan Board & Scanner (public/, routes/, src/)
│   └── stockflow/                 ← Plantilla HoloWare StockFlow
│
├── public/                        ← Entry point web estático (app.js + index.html)
├── data/
│   └── holoware.db                ← Base de datos SQLite única
├── server.js                      ← Servidor Node.js principal
├── .env                           ← Variables de entorno (HW_PORT=3001, SUPERADMIN_EMAIL)
└── README.md                      ← Este documento
```

---

## Documentación Detallada

- [Visión de la Plataforma](./docs/HOLOWARE_PLATFORM.md)
- [Arquitectura Técnica](./docs/ARCHITECTURE.md)
- [Guía para Crear un Nuevo Módulo](./docs/MODULE_CREATION.md)
- [Roadmap de la Plataforma](./docs/ROADMAP.md)
- [Especificación HoloWare Core (Web)](./docs/modules/CORE.md)
- [Especificación ScanBan Board (Web)](./docs/modules/SCANBAN_BOARD.md)
- [Especificación ScanBan Scanner (Mobile)](./docs/modules/SCANBAN_SCANNER.md)
- [Especificación StockFlow (Plantilla)](./docs/modules/STOCKFLOW.md)
