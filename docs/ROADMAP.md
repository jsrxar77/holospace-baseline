# Roadmap de Evolución Técnica y SaaS Multi-Tenant — HoloSpace Baseline

> Documento maestro que consolida la evolución del proyecto, las convenciones técnicas de nombres, el checklist detallado de las 8 fases del Roadmap SaaS Multi-Tenant y las próximas fases planificadas.

---

## 1. Convenciones Oficiales de Nombres y Prefijos

| Capa / Alcance | Prefijo | Ejemplo de Uso |
| :--- | :---: | :--- |
| **Core Platform (LocalStorage)** | `hs_` | `hs_token`, `hs_user`, `hs_tenant`, `hs_saved_email` |
| **Módulo Kanban (LocalStorage)** | `hs_kb_` | `hs_kb_active_filter`, `hs_kb_column_view` |
| **Módulo Scanner (LocalStorage)** | `hs_sc_` | `hs_sc_active_order`, `hs_sc_sound_enabled` |
| **Variables de Entorno (ENV)** | `HS_` | `HS_PORT`, `HS_THEME`, `HS_DATABASE_URL` |
| **Variables de Módulos (ENV)** | `HS_MOD_` | `HS_MOD_KANBAN_MAX_ORDERS` |

---

## 2. Estado del Roadmap SaaS Multi-Tenant (Fases 1 a 8 Completadas)

### 🟢 FASE 1: Modelo de Datos Relacional PostgreSQL 16
- [x] **1.1** Diseñar esquema DDL con soporte multi-tenant (`tenants`, `subscriptions`, `modules`, `plans`, `users`, `orders`, `order_items`, `audit_logs`).
- [x] **1.2** Implementar aislamiento de datos mediante políticas PostgreSQL 16 Row-Level Security (RLS).
- [x] **1.3** Crear adaptador relacional en `lib/db.js` con soporte de transacciones seguras y RLS context injection.

### 🟢 FASE 2: Capa de Seguridad, Autenticación JWT y RBAC
- [x] **2.1** Migrar hashing de contraseñas a algoritmo `scrypt` (`lib/auth.js`).
- [x] **2.2** Implementar motor de firma y verificación de JSON Web Tokens (JWT).
- [x] **2.3** Crear middleware de resolución de Tenant (`subdominio`, header `X-Tenant-ID` o claim JWT).
- [x] **2.4** Implementar middleware de RBAC estricto validando `SUPERADMIN`, `ADMIN`, `OPERATOR`.

### 🟢 FASE 3: Motor de Licenciamiento Modular (Entitlements)
- [x] **3.1** Crear middleware `requireModule(moduleCode)` que bloquea accesos no contratados (`lib/entitlement.js`).
- [x] **3.2** Endpoints de gestión de suscripciones y cuotas (`/api/subscription`, `/api/tenants/modules`).
- [x] **3.3** Control de cuotas de usuarios y órdenes mensuales.

### 🟢 FASE 4: Infraestructura Docker y Red de Producción
- [x] **4.1** Multi-stage Dockerfile para servidor Node.js 22.
- [x] **4.2** Orquestación con `docker-compose.yml` (`holospace_app`, `holospace_postgres`, `holospace_redis`, `holospace_proxy`, `holospace_mobile`, `holospace_backups`).
- [x] **4.3** Configurar proxy reverso Nginx (`nginx/default.conf`) y backups automatizados (`bin/devops-db-backup.sh`).

### 🟢 FASE 5: Gobierno SaaS y Gestión de Tenants (SuperAdmin)
- [x] **5.1** Directorio interactivo de organizaciones en frontend web.
- [x] **5.2** Modal de creación y edición de empresas con asignación de plan y cuotas.
- [x] **5.3** Acciones de suspensión y reactivación inmediata en base de datos.
- [x] **5.4** Asignación de licencias modulares en caliente.

### 🟢 FASE 6: Motor de Facturación, Checkout y Auto-Onboarding B2B
- [x] **6.1** Catálogo comercial de planes (Starter $49/mes, Pro $149/mes, Enterprise $499/mes).
- [x] **6.2** Flujo de Auto-Registro de empresas (`registerNewTenant`).
- [x] **6.3** Generación de sesiones de Checkout mock (`createCheckoutSession`).
- [x] **6.4** Procesador de Webhooks de pasarela (`handlePaymentWebhook`).

### 🟢 FASE 7: Enrutamiento Modular y Saneamiento de Endpoints
- [x] **7.1** Saneamiento de rutas legadas y estandarización a 4 módulos canónicos.
- [x] **7.2** Cero alerts y confirmaciones nativas del navegador (modales HTML/CSS dialog custom).
- [x] **7.3** Auditoría de integridad de base de datos (`tests/verify-db-integrity.js`).

### 🟢 FASE 8: Motor de Temas Jerárquico (Tenant vs Usuario)
- [x] **8.1** Soporte de persistencia en base de datos para Tema Base de Organización y Preferencia Personal de Usuario.
- [x] **8.2** Endpoints `GET /api/theme` y `POST /api/theme` con soporte de scopes.
- [x] **8.3** Suite de pruebas jerárquicas (`tests/test-theme-hierarchy.js`).
- [x] **8.4** Sincronización atómica y consistencia en asignación/toma de pedidos entre ScanBan y Scanner Mobile (`operator_email` + `assigned_operator_email`).
- [x] **8.5** Escaneo asistido con tarjeta de producto pendiente, retículo con línea central láser y diagnóstico comparativo esperado vs. escaneado en Mobile Scanner.

---

## 3. Próximas Fases Planificadas

- [ ] **FASE 9:** Integración con Pasarela de Pagos Real (Stripe / Mercado Pago).
- [ ] **FASE 10:** Soporte de Dominios Personalizados (Custom Domains con SSL automatizado Let's Encrypt vía Nginx).
- [ ] **FASE 11:** Panel de Analíticas Avanzadas (Módulo `analytics`) con gráficos de tiempo de preparación y métricas de operarios.
