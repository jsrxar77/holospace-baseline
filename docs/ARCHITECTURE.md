# Arquitectura Técnica — HoloSpace SaaS Baseline

> Arquitectura técnica modular de la plataforma contenedora SaaS Multi-Tenant HoloSpace Baseline.

---

## 1. Visión General de la Arquitectura

```
+----------------------------------------------------------------------------------------+
|                              HoloSpace Baseline SaaS Container                          |
|                                                                                        |
|  +----------------+  +-----------------+  +-------------------+  +------------------+  |
|  | 🏛️ Tenant      |  | ⚙️ Core         |  | 📋 Kanban         |  | 📱 Scanner       |  |
|  | /tenant        |  | /core           |  | /kanban           |  | /scanner (8081)  |  |
|  +----------------+  +-----------------+  +-------------------+  +------------------+  |
|          |                   |                      |                      |           |
|   /api/tenants/*       /api/theme, /users      /api/scanban/*         /api/scanner/*   |
+----------------------------------------------------------------------------------------+
                                       |
        +------------------------------+------------------------------+
        |                                                             |
        v                                                             v
+-----------------------------+                         +-------------------------------+
|  📱 Scanner Mobile (Expo)   |                         |  🐘 PostgreSQL 16 (RLS)       |
|  EAN-13 / Validación Sonora |                         |  Aislamiento por `tenant_id`  |
+-----------------------------+                         +-------------------------------+
```

---

## 2. Estructura de Carpetas

```
holospace-baseline/
├── docs/                          ← Documentación viva del proyecto
│   ├── HOLOSPACE_PLATFORM.md       ← Visión de plataforma y los 4 módulos
│   ├── ARCHITECTURE.md            ← Este archivo
│   ├── MODULE_CREATION.md         ← Guía de desarrollo de módulos
│   ├── ROADMAP.md                 ← Seguimiento de tareas y fases SaaS
│   └── modules/                   ← Especificación por módulo
│       ├── TENANTS.md             ← Especificación Módulo Tenant (SuperAdmin)
│       ├── CORE.md                ← Especificación HoloSpace Core (Web)
│       ├── SCANBAN_BOARD.md       ← Especificación Módulo Kanban (Web)
│       └── SCANBAN_SCANNER.md     ← Especificación Módulo Scanner (Mobile/Web)
│
├── modules/                       ← Código fuente modularizado
│   ├── core/                      ← HoloSpace Core (Web: public/, routes/, theme/)
│   └── scanban/                   ← Kanban & Scanner (public/, routes/, src/)
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
│   ├── verify-db-integrity.js     ← Auditoría de salud de la base de datos
│   ├── test-auth-jwt.js           ← Test Suite: JWT & RBAC
│   ├── test-entitlement.js        ← Test Suite: Licenciamiento modular
│   └── test-billing-onboarding.js ← Test Suite: Facturación y Onboarding
│
├── docker-compose.yml             ← Orquestación de App, PostgreSQL 16, Redis 7 y Expo
├── Dockerfile                     ← Multi-stage build Node 22 con hot-reload
├── server.js                      ← Servidor Node.js nativo PostgreSQL 16 y SPA Routing
├── package.json
└── .env                           ← Variables de entorno de conexión
```

---

## 3. Catálogo de Módulos y Documentos

- **Tenant (SuperAdmin SaaS):** Ver [docs/modules/TENANTS.md](./modules/TENANTS.md).
- **Core (Web Base & Auditoría):** Ver [docs/modules/CORE.md](./modules/CORE.md).
- **Kanban (Logística y Pedidos):** Ver [docs/modules/SCANBAN_BOARD.md](./modules/SCANBAN_BOARD.md).
- **Scanner (App Depósito Mobile/Web):** Ver [docs/modules/SCANBAN_SCANNER.md](./modules/SCANBAN_SCANNER.md).
- **Guía de Creación de Módulos:** Ver [MODULE_CREATION.md](./MODULE_CREATION.md).

---

## 4. Convenciones de Identificación y Row-Level Security (RLS)

1. **Aislamiento Estricto por Tenant (Zero Data Leakage):** Todas las consultas a la base de datos se ejecutan en el contexto de sesión PostgreSQL `app.current_tenant_id = $tenantId`. Las políticas RLS garantizan a nivel de motor SQL que ningún usuario pueda leer o escribir registros de otra organización.
2. **Control de Acceso RBAC y Respuestas 403:** Se valida server-side el rol del usuario (`SUPERADMIN`, `ADMIN`, `OPERATOR`). Acceso no autorizado a módulos de plataforma renderiza la pantalla 403 explicativa.
3. **Claves Primarias Nativas UUID:** Todas las tablas de PostgreSQL utilizan UUIDs para garantizar unicidad global sin colisiones entre empresas.
4. **SuperAdmin Global:** Solo el SuperAdmin autenticado (`superadmin@holospace.app`) tiene bypass de RLS (`app.is_superadmin = true`) para labores de auditoría y gobierno multiplataforma.


