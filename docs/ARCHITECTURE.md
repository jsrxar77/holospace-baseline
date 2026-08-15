# Arquitectura Técnica — HoloWare SaaS Baseline

> Arquitectura técnica modular de la plataforma contenedora SaaS Multi-Tenant HoloWare Baseline.

---

## 1. Visión General de la Arquitectura

```
+----------------------------------------------------------------------------------------+
|                              HoloWare Baseline SaaS Container                          |
|                                                                                        |
|  +----------------+  +-----------------+  +-------------------+  +------------------+  |
|  | 🏢 Tenants     |  | 🏛️ Core         |  | 📋 ScanBan Board  |  | 📦 ScanFlow      |  |
|  | (SaaS Control) |  | (Web Platform)  |  | (Web Logistics)   |  | (Web Inventory)  |  |
|  +----------------+  +-----------------+  +-------------------+  +------------------+  |
|          |                   |                      |                      |           |
|   /api/tenants/*       /api/theme, /users      /api/scanban/*         /api/scanflow/*  |
+----------------------------------------------------------------------------------------+
                                       |
        +------------------------------+------------------------------+
        |                                                             |
        v                                                             v
+-----------------------------+                         +-------------------------------+
|  📱 ScanBan Scanner         |                         |  🐘 PostgreSQL 16 (RLS)       |
|  (Mobile Expo EAN-13)       |                         |  Aislamiento por `tenant_id`  |
+-----------------------------+                         +-------------------------------+
```

---

## 2. Estructura de Carpetas

```
holoware-baseline/
├── docs/                          ← Documentación viva del proyecto
│   ├── HOLOWARE_PLATFORM.md       ← Visión de plataforma y los 5 módulos
│   ├── ARCHITECTURE.md            ← Este archivo
│   ├── MODULE_CREATION.md         ← Guía de desarrollo de módulos
│   ├── ROADMAP.md                 ← Seguimiento de tareas y fases SaaS
│   └── modules/                   ← Especificación por módulo
│       ├── TENANTS.md             ← Especificación Módulo Tenants (SuperAdmin)
│       ├── CORE.md                ← Especificación HoloWare Core (Web)
│       ├── SCANBAN_BOARD.md       ← Especificación HoloWare ScanBan Board (Web)
│       ├── SCANBAN_SCANNER.md     ← Especificación HoloWare ScanBan Scanner (Mobile)
│       └── STOCKFLOW.md           ← Especificación Módulo ScanFlow
│
├── modules/                       ← Código fuente modularizado
│   ├── core/                      ← HoloWare Core (Web: public/, routes/, theme/)
│   └── scanban/                   ← HoloWare ScanBan Board & Scanner (public/, routes/, src/)
│
├── lib/                           ← Capa de lógica y servicios de infraestructura
│   ├── db.js                      ← Cliente PostgreSQL 16 con Pool y RLS automático
│   ├── auth.js                    ← JWT Multi-Tenant, RBAC y Hashing scrypt
│   ├── entitlement.js             ← Middleware y validación de módulos licenciados
│   └── billing.js                 ← Motor de suscripciones, planes y webhooks
│
├── public/                        ← Entry point web estático (app.js + index.html)
├── bin/                           ← Suites de pruebas y herramientas DevOps
│   ├── devops-db-refresh.sh       ← Reseteo y siembra en vivo de PostgreSQL 16
│   ├── test-tenants-module.js     ← Test Suite: Módulo Tenants (SUPERADMIN)
│   ├── verify-db-integrity.js     ← Auditoría de salud de la base de datos
│   ├── test-auth-jwt.js           ← Test Suite: JWT & RBAC
│   ├── test-entitlement.js        ← Test Suite: Licenciamiento modular
│   └── test-billing-onboarding.js ← Test Suite: Facturación y Onboarding
│
├── docker-compose.yml             ← Orquestación de App, PostgreSQL 16, Redis 7 y Nginx
├── Dockerfile                     ← Multi-stage build Node 22 con hot-reload
├── server.js                      ← Servidor Node.js nativo PostgreSQL 16
├── package.json
└── .env                           ← Variables de entorno de conexión
```

---

## 3. Catálogo de Módulos y Documentos

- **Tenants (SuperAdmin SaaS):** Ver [docs/modules/TENANTS.md](./modules/TENANTS.md).
- **HoloWare Core (Web):** Ver [docs/modules/CORE.md](./modules/CORE.md).
- **ScanBan Board (Web):** Ver [docs/modules/SCANBAN_BOARD.md](./modules/SCANBAN_BOARD.md).
- **ScanBan Scanner (Mobile):** Ver [docs/modules/SCANBAN_SCANNER.md](./modules/SCANBAN_SCANNER.md).
- **ScanFlow (Inventario):** Ver [docs/modules/STOCKFLOW.md](./modules/STOCKFLOW.md).
- **Guía de Creación de Módulos:** Ver [MODULE_CREATION.md](./MODULE_CREATION.md).

---

## 4. Convenciones de Identificación y Row-Level Security (RLS)

1. **Aislamiento Estricto por Tenant:** Todas las consultas a la base de datos se ejecutan en el contexto de sesión PostgreSQL `app.current_tenant_id = $tenantId`. Las políticas RLS garantizan a nivel de motor SQL que ningún usuario pueda leer o escribir registros de otra organización.
2. **Claves Primarias Nativas UUID:** Todas las tablas de PostgreSQL utilizan UUIDs para garantizar unicidad global sin colisiones entre empresas.
3. **SuperAdmin Global:** Solo el SuperAdmin autenticado (`superadmin@hologrowth.com.ar`) tiene bypass de RLS (`app.is_superadmin = true`) para labores de auditoría y gobierno multiplataforma.


