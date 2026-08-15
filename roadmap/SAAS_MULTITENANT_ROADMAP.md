# 🗺️ HoloWare SaaS Multi-Tenant: Roadmap Maestro de Implementación

> **Documento de Planificación Estratégica:** Roadmap de transformación paso a paso para evolucionar HoloWare Baseline a una plataforma SaaS B2B Multi-Tenant monetizable por suscripciones.
> **Versión Base:** v1.1.0  
> **Fecha de Inicio:** Agosto 2026

---

## 🎯 Resumen Ejecutivo de Fases

```
   ┌─────────────────┐
   │  FASE 1: DATOS  │ ➔ PostgreSQL 16 + RLS + Esquema `tenants` & `subscriptions`
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │  FASE 2: AUTH   │ ➔ JWT Multi-Tenant + Hashing Argon2id + RBAC Multinivel
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ FASE 3: LICENCIA│ ➔ Middleware de Entitlement Modular + Feature Flags
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │  FASE 4: DOCKER │ ➔ Dockerfile Multi-Stage + Compose + Backups Automatizados
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ FASE 5: UI & APP│ ➔ Switcher/Resolución de Tenant en Web y Escáner Móvil
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ FASE 6: BILLING │ ➔ Integración Gateway de Pagos (Stripe/MercadoPago)
   └─────────────────┘
```

---

## 📋 Detalle de Fases & Tareas de Ejecución

### 🧱 FASE 1: Base de Datos Relacional Multi-Tenant & Migraciones (✅ COMPLETADO)
* **Objetivo:** Establecer la infraestructura de base de datos PostgreSQL 16 con aislamiento por fila (RLS).
* **Tareas Ejecutadas:**
  - [x] **1.1** Crear scripts de inicialización DDL (`data/init-schema.sql` y `data/schema-sqlite.sql` con `tenants`, `tenant_subscriptions`, `tenant_modules`, `users`, `orders`, `order_items`, `platform_audit_logs`).
  - [x] **1.2** Habilitar Row-Level Security (RLS) en todas las tablas transaccionales en PostgreSQL (`init-schema.sql`).
  - [x] **1.3** Implementar capa de abstracción de base de datos en Node.js ([`lib/db.js`](file:///Users/javier/Projects/holoware-baseline/lib/db.js) PostgreSQL Pool + SQLite Adapter).
  - [x] **1.4** Crear script de migración de datos desde `data/holoware.db` a PostgreSQL ([`bin/migrate-sqlite-to-postgres.js`](file:///Users/javier/Projects/holoware-baseline/bin/migrate-sqlite-to-postgres.js)).
* **Entregables:** 
  - Schema PostgreSQL 16 con RLS: [`data/init-schema.sql`](file:///Users/javier/Projects/holoware-baseline/data/init-schema.sql)
  - Schema SQLite local: [`data/schema-sqlite.sql`](file:///Users/javier/Projects/holoware-baseline/data/schema-sqlite.sql)
  - Capa de datos Node.js: [`lib/db.js`](file:///Users/javier/Projects/holoware-baseline/lib/db.js)
  - Utilidad de migración probada: [`bin/migrate-sqlite-to-postgres.js`](file:///Users/javier/Projects/holoware-baseline/bin/migrate-sqlite-to-postgres.js) (Exportó `data/migration-export.sql`)

---

### 🔒 FASE 2: Autenticación JWT Multi-Tenant & RBAC Multinivel (✅ COMPLETADO)
* **Objetivo:** Reemplazar el login unitenant por autenticación criptográfica segura con contexto de Tenant.
* **Tareas Ejecutadas:**
  - [x] **2.1** Integrar hashing seguro de contraseñas con `scrypt` / `bcrypt` (cero contraseñas en texto plano, auto-upgrade transparente en login).
  - [x] **2.2** Diseñar endpoint `POST /api/auth/login` y `POST /api/login` con resolución de `tenant_id` y emisión de JWT firmado conteniendo claims de Tenant y Entitlements (`server.js` + [`lib/auth.js`](file:///Users/javier/Projects/holoware-baseline/lib/auth.js)).
  - [x] **2.3** Crear middleware de resolución de Tenant (`subdominio`, header `X-Tenant-ID` o claim JWT) (`resolveTenantContext` en [`lib/auth.js`](file:///Users/javier/Projects/holoware-baseline/lib/auth.js)).
  - [x] **2.4** Implementar middleware de RBAC estricto (`requireRole` en [`lib/auth.js`](file:///Users/javier/Projects/holoware-baseline/lib/auth.js) validando `SUPERADMIN`, `ADMIN`, `OPERATOR`).
* **Entregables:**
  - Motor de seguridad, JWT y Hashing: [`lib/auth.js`](file:///Users/javier/Projects/holoware-baseline/lib/auth.js)
  - Endpoints de autenticación JWT: `POST /api/auth/login` y `POST /api/login` en [`server.js`](file:///Users/javier/Projects/holoware-baseline/server.js)
  - Test Suite automatizado verificado (13/13 tests aprobados): [`bin/test-auth-jwt.js`](file:///Users/javier/Projects/holoware-baseline/bin/test-auth-jwt.js)

---

### 💳 FASE 3: Licenciamiento Modular & Feature Flags (Entitlement) (✅ COMPLETADO)
* **Objetivo:** Permitir la monetización por suscripción habilitando/deshabilitando módulos dinámicamente por Tenant.
* **Tareas Ejecutadas:**
  - [x] **3.1** Crear middleware `requireModule(moduleCode)` que bloquea accesos no contratados ([`lib/entitlement.js`](file:///Users/javier/Projects/holoware-baseline/lib/entitlement.js)).
  - [x] **3.2** Crear endpoints de gestión de suscripciones y módulos (`GET /api/subscription`, `GET /api/tenants`, `POST /api/tenants/modules` en [`server.js`](file:///Users/javier/Projects/holoware-baseline/server.js)).
  - [x] **3.3** Implementar control de cuotas y cálculo de consumo en tiempo real (`getTenantSubscriptionAndUsage` en [`lib/entitlement.js`](file:///Users/javier/Projects/holoware-baseline/lib/entitlement.js)).
  - [x] **3.4** Cachear permisos de módulos con TTL de memoria para ultra-baja latencia (< 0.1ms por request).
* **Entregables:**
  - Motor de Entitlements & Cuotas: [`lib/entitlement.js`](file:///Users/javier/Projects/holoware-baseline/lib/entitlement.js)
  - Endpoints de Suscripción y Cuotas: `/api/subscription`, `/api/tenants`, `/api/tenants/modules` en [`server.js`](file:///Users/javier/Projects/holoware-baseline/server.js)
  - Test Suite automatizado verificado (10/10 tests aprobados): [`bin/test-entitlement.js`](file:///Users/javier/Projects/holoware-baseline/bin/test-entitlement.js)

---

### 🐳 FASE 4: Dockerización Completa & Estrategia de Backups (✅ COMPLETADO)
* **Objetivo:** Empaquetar toda la solución en contenedores listos para producción con backups automatizados.
* **Tareas Ejecutadas:**
  - [x] **4.1** Crear [`Dockerfile`](file:///Users/javier/Projects/holoware-baseline/Dockerfile) multi-stage optimizado para Node.js y Web assets (imagen `node:20-alpine`, non-root, healthchecks).
  - [x] **4.2** Crear [`docker-compose.yml`](file:///Users/javier/Projects/holoware-baseline/docker-compose.yml) orquestando App Server, PostgreSQL 16 con RLS, Redis 7, Nginx Proxy y Contenedor de Backups.
  - [x] **4.3** Configurar configuración Nginx [`nginx/default.conf`](file:///Users/javier/Projects/holoware-baseline/nginx/default.conf) y script de respaldos automatizados [`bin/backup-database.sh`](file:///Users/javier/Projects/holoware-baseline/bin/backup-database.sh).
  - [x] **4.4** Crear script de exportación/dump bajo demanda de un Tenant específico ([`bin/tenant-dump.sh`](file:///Users/javier/Projects/holoware-baseline/bin/tenant-dump.sh)).
* **Entregables:**
  - Dockerfile de producción: [`Dockerfile`](file:///Users/javier/Projects/holoware-baseline/Dockerfile) y [`.dockerignore`](file:///Users/javier/Projects/holoware-baseline/.dockerignore)
  - Stack Docker Compose: [`docker-compose.yml`](file:///Users/javier/Projects/holoware-baseline/docker-compose.yml)
  - Configuración Nginx: [`nginx/default.conf`](file:///Users/javier/Projects/holoware-baseline/nginx/default.conf)
  - Scripts DevOps de Backups: [`bin/backup-database.sh`](file:///Users/javier/Projects/holoware-baseline/bin/backup-database.sh) y [`bin/tenant-dump.sh`](file:///Users/javier/Projects/holoware-baseline/bin/tenant-dump.sh)

---

### 📱 FASE 5: Adaptación de Clientes Web & Móvil (ScanBan Scanner) (✅ COMPLETADO)
* **Objetivo:** Adecuar las interfaces de usuario para operar de forma transparente con el nuevo paradigma Multi-Tenant.
* **Tareas Ejecutadas:**
  - [x] **5.1** Adaptar el portal Web para sincronización automática de Tenant, token JWT y persistencia en `localStorage` ([`public/app.js`](file:///Users/javier/Projects/holoware-baseline/public/app.js) y [`public/index.html`](file:///Users/javier/Projects/holoware-baseline/public/index.html)).
  - [x] **5.2** En la App Móvil (`ScanBan Scanner`), agregar campo de Organización / Tenant Slug en el login y persistencia en Zustand ([`modules/scanban/src/screens/LoginScreen.tsx`](file:///Users/javier/Projects/holoware-baseline/modules/scanban/src/screens/LoginScreen.tsx) y [`modules/scanban/src/store/useAuthStore.ts`](file:///Users/javier/Projects/holoware-baseline/modules/scanban/src/store/useAuthStore.ts)).
  - [x] **5.3** Renderizado condicional en UI según módulos contratados (`entitlements` en JWT).
* **Entregables:**
  - Portal Web Multi-Tenant: [`public/app.js`](file:///Users/javier/Projects/holoware-baseline/public/app.js) y [`public/index.html`](file:///Users/javier/Projects/holoware-baseline/public/index.html)
  - App Móvil Multi-Tenant: [`modules/scanban/src/screens/LoginScreen.tsx`](file:///Users/javier/Projects/holoware-baseline/modules/scanban/src/screens/LoginScreen.tsx) y [`modules/scanban/src/store/useAuthStore.ts`](file:///Users/javier/Projects/holoware-baseline/modules/scanban/src/store/useAuthStore.ts)

---

### 💰 FASE 6: Pasarela de Pagos & Auto-Onboarding (Self-Service SaaS) (✅ COMPLETADO)
* **Objetivo:** Permitir que nuevos clientes se registren y suscriban automáticamente con tarjeta de crédito.
* **Tareas Ejecutadas:**
  - [x] **6.1** Integración de Webhooks y Procesamiento de Pagos en tiempo real (`handlePaymentWebhook` en [`lib/billing.js`](file:///Users/javier/Projects/holoware-baseline/lib/billing.js)).
  - [x] **6.2** Flujo de auto-registro (Sign-Up / Onboarding B2B) con aprovisionamiento instantáneo de Tenant, Suscripción, Módulos y Usuario Admin (`registerNewTenant` en [`lib/billing.js`](file:///Users/javier/Projects/holoware-baseline/lib/billing.js)).
  - [x] **6.3** Endpoints de Facturación, Checkout y Catálogo de Planes (`/api/billing/plans`, `/api/auth/register-tenant`, `/api/billing/create-checkout`, `/api/billing/webhook` en [`server.js`](file:///Users/javier/Projects/holoware-baseline/server.js)).
* **Entregables:**
  - Motor de Facturación y Onboarding: [`lib/billing.js`](file:///Users/javier/Projects/holoware-baseline/lib/billing.js)
  - Endpoints de Billing & Onboarding en [`server.js`](file:///Users/javier/Projects/holoware-baseline/server.js)
  - Test Suite automatizado verificado (13/13 tests aprobados): [`bin/test-billing-onboarding.js`](file:///Users/javier/Projects/holoware-baseline/bin/test-billing-onboarding.js)

---

### FASE 7: Módulo de Gestión Tenants (SuperAdmin) & Ecosistema de 5 Módulos (✅ COMPLETADO)
* **Objetivo:** Panel de control de gobierno SaaS exclusivo para el `SUPERADMIN` con administración total de organizaciones, cuotas, usuarios y licenciamiento en vivo de los 5 módulos oficiales: `Tenants`, `Core`, `ScanBan Board`, `ScanBan Scanner` y `ScanFlow`.
* **Tareas Ejecutadas:**
  - [x] **7.1** Panel visual `Tenants` en Web Shell con tarjetas de organización, KPIs en tiempo real y switches de licenciamiento en vivo ([`public/index.html`](file:///Users/javier/Projects/holoware-baseline/public/index.html) y [`public/app.js`](file:///Users/javier/Projects/holoware-baseline/public/app.js)).
  - [x] **7.2** Modales interactivos para aprovisionar nuevas organizaciones (`+ Nueva Organización`) y asignar usuarios administradores/operarios a cualquier Tenant (`Asignar Usuario`).
  - [x] **7.3** Endpoints dedicados de gestión en PostgreSQL 16 con verificación estricta de rol `SUPERADMIN`: `GET /api/tenants`, `POST /api/tenants`, `POST /api/tenants/users`, `POST /api/tenants/modules` en [`server.js`](file:///Users/javier/Projects/holoware-baseline/server.js).
  - [x] **7.4** Catálogo oficial de 5 módulos en base de datos (`modules` y `tenant_modules` en [`data/init-schema.sql`](file:///Users/javier/Projects/holoware-baseline/data/init-schema.sql)).
  - [x] **7.5** Vista y soporte del módulo `ScanFlow` para gestión de inventario y stock en depósito.
* **Entregables:**
  - Panel de Gobierno SaaS: [`public/index.html`](file:///Users/javier/Projects/holoware-baseline/public/index.html) y [`public/app.js`](file:///Users/javier/Projects/holoware-baseline/public/app.js)
  - API de Gestión de Tenants: [`server.js`](file:///Users/javier/Projects/holoware-baseline/server.js)
  - Test Suite automatizado verificado (12/12 tests aprobados): [`bin/test-tenants-module.js`](file:///Users/javier/Projects/holoware-baseline/bin/test-tenants-module.js)
  - DDL y semillas actualizadas: [`data/init-schema.sql`](file:///Users/javier/Projects/holoware-baseline/data/init-schema.sql)

---

### FASE 8: Motor de Temas Jerárquico en Cascada (Tenant vs. Usuario) (✅ COMPLETADO)
* **Objetivo:** Permitir que cada Organización/Tenant tenga su tema base por defecto (definido en Core por el SuperAdmin o Admin) y que cada Usuario pueda personalizar su tema individual sin afectar a otros usuarios de su empresa.
* **Tareas Ejecutadas:**
  - [x] **8.1** Agregar columna `theme_preference` en tabla `users` para almacenar la personalización del usuario ([`data/init-schema.sql`](file:///Users/javier/Projects/holoware-baseline/data/init-schema.sql)).
  - [x] **8.2** Endpoint `POST /api/theme` con soporte dual de scopes: `{ scope: 'user', themeKey }` para la preferencia del usuario y `{ scope: 'tenant', themeKey, targetTenantId }` para el tema base de la organización ([`server.js`](file:///Users/javier/Projects/holoware-baseline/server.js)).
  - [x] **8.3** Endpoint `GET /api/theme` con resolución en cascada: 1) Preferencia del usuario (`users.theme_preference`), 2) Tema base de la organización (`app_settings.active_theme`), 3) Tema global por defecto (`omarchy_tiling`).
  - [x] **8.4** Selector de tema base por organización en las tarjetas de Tenants del panel SuperAdmin y selector personal en el header de usuario ([`public/app.js`](file:///Users/javier/Projects/holoware-baseline/public/app.js)).
  - [x] **8.5** Suite automatizada de validación de jerarquía y aislamiento entre usuarios del mismo tenant (10/10 tests aprobados): [`bin/test-theme-hierarchy.js`](file:///Users/javier/Projects/holoware-baseline/bin/test-theme-hierarchy.js).
* **Entregables:**
  - Schema con preferencia de tema por usuario: [`data/init-schema.sql`](file:///Users/javier/Projects/holoware-baseline/data/init-schema.sql)
  - Endpoints de tema jerárquico: [`server.js`](file:///Users/javier/Projects/holoware-baseline/server.js)
  - Selector de tema por Tenant y por Usuario: [`public/app.js`](file:///Users/javier/Projects/holoware-baseline/public/app.js)
  - Suite de pruebas de jerarquía: [`bin/test-theme-hierarchy.js`](file:///Users/javier/Projects/holoware-baseline/bin/test-theme-hierarchy.js)

---

### FASE 9: Arquitectura Espacial UX/UI Responsive (2 Líneas + Drawer + Status Bar Footer) (✅ COMPLETADO)
* **Objetivo:** Organizar el encabezado en dos líneas horizontales limpias, preservar la estética original (logo de 24px, píldoras y tokens CSS), añadir soporte táctil con Drawer lateral para tablets y smartphones, e integrar una barra de estado fija (Status Bar) para monitoreo técnico continuo.
* **Tareas Ejecutadas:**
  - [x] **9.1** Documento de estrategia de diseño y organización espacial ([`docs/UX_UI_STRATEGY.md`](file:///Users/javier/Projects/holoware-baseline/docs/UX_UI_STRATEGY.md)).
  - [x] **9.2** Línea 1 (Top Bar - 54px): Logo `HOLOWARE` en tamaño original de 24px, badge de contexto, selector de temas, conexión de celular y sesión de usuario ([`public/index.html`](file:///Users/javier/Projects/holoware-baseline/public/index.html)).
  - [x] **9.3** Línea 2 (Navigation Bar - 44px): Barra exclusiva para pestañas de navegación con holgura y sin compresión horizontal.
  - [x] **9.4** Menú Hamburguesa & Drawer lateral táctil para resoluciones móviles y tablets (< 1024px) ([`public/app.js`](file:///Users/javier/Projects/holoware-baseline/public/app.js)).
  - [x] **9.5** Footer de Estado Operativo (Status Bar - 32px): Monitoreo fijo inferior con indicador de DB PostgreSQL 16 RLS, tenant activo y versión.
* **Entregables:**
  - Layout Web Shell de 2 líneas y Drawer: [`public/index.html`](file:///Users/javier/Projects/holoware-baseline/public/index.html) y [`public/app.js`](file:///Users/javier/Projects/holoware-baseline/public/app.js)
  - Documento de Estrategia UX/UI: [`docs/UX_UI_STRATEGY.md`](file:///Users/javier/Projects/holoware-baseline/docs/UX_UI_STRATEGY.md)
  - Sincronización Core: [`modules/core/public/index.html`](file:///Users/javier/Projects/holoware-baseline/modules/core/public/index.html) y [`modules/core/public/core.js`](file:///Users/javier/Projects/holoware-baseline/modules/core/public/core.js)



### Tareas Completadas (Recientes)
- [x] Corrección de carga y parseo de PDF (loop infinito resuelto).
- [x] Corrección de autodescubrimiento de IP en Expo Mobile (inyección de EXPO_PUBLIC_SERVER_IP).
- [x] Corrección de Modal de Login (Logo HoloWare sin términos Enterprise).
- [x] Reestructuración del Header (Jerarquía Módulos vs Features).
