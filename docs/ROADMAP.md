# Roadmap de Evolución Técnica y SaaS Multi-Tenant — HoloSpace Baseline

> Documento maestro que consolida la evolución del proyecto, las convenciones técnicas de nombres, el checklist detallado de las 9 fases del Roadmap SaaS Multi-Tenant y las próximas fases planificadas.

---

## 1. Convenciones Oficiales de Nombres y Prefijos

| Capa / Alcance | Prefijo | Ejemplo de Uso |
| :--- | :---: | :--- |
| **Core Platform (LocalStorage)** | `hs_` | `hs_token`, `hs_user`, `hs_tenant`, `hs_saved_email` |
| **Módulo Kanban (LocalStorage)** | `hs_kb_` | `hs_kb_active_filter`, `hs_kb_column_view` |
| **Módulo Scanner (LocalStorage)** | `hs_sc_` | `hs_sc_active_order`, `hs_sc_sound_enabled` |
| **Módulo 4see (LocalStorage)** | `hs_4s_` | `hs_4s_active_tab`, `hs_4s_diff_filter` |
| **Variables de Entorno (ENV)** | `HS_` | `HS_PORT`, `HS_THEME`, `HS_DATABASE_URL` |
| **Variables de Módulos (ENV)** | `HS_MOD_` | `HS_MOD_KANBAN_MAX_ORDERS` |

---

## 2. Estado del Roadmap SaaS Multi-Tenant (Fases 1 a 9 Completadas)

### FASE 1: Modelo de Datos Relacional PostgreSQL 16
- [x] **1.1** Diseñar esquema DDL con soporte multi-tenant (`tenants`, `subscriptions`, `modules`, `plans`, `users`, `orders`, `order_items`, `audit_logs`).
- [x] **1.2** Implementar aislamiento de datos mediante políticas PostgreSQL 16 Row-Level Security (RLS).
- [x] **1.3** Crear adaptador relacional en `lib/db.js` con soporte de transacciones seguras y RLS context injection.

### FASE 2: Capa de Seguridad, Autenticación JWT y RBAC
- [x] **2.1** Migrar hashing de contraseñas a algoritmo `scrypt` (`lib/auth.js`).
- [x] **2.2** Implementar motor de firma y verificación de JSON Web Tokens (JWT).
- [x] **2.3** Crear middleware de resolución de Tenant (`subdominio`, header `X-Tenant-ID` o claim JWT).
- [x] **2.4** Implementar middleware de RBAC estricto validando `SUPERADMIN`, `ADMIN`, `OPERATOR`.

### FASE 3: Motor de Licenciamiento Modular (Entitlements)
- [x] **3.1** Crear middleware `requireModule(moduleCode)` que bloquea accesos no contratados (`lib/entitlement.js`).
- [x] **3.2** Endpoints de gestión de suscripciones y cuotas (`/api/subscription`, `/api/tenants/modules`).
- [x] **3.3** Control de cuotas de usuarios y órdenes mensuales.

### FASE 4: Infraestructura Docker y Red de Producción
- [x] **4.1** Multi-stage Dockerfile para servidor Node.js 22.
- [x] **4.2** Orquestación con `docker-compose.yml` (`holospace_app`, `holospace_postgres`, `holospace_redis`, `holospace_proxy`, `holospace_mobile`, `holospace_backups`).
- [x] **4.3** Configurar proxy reverso Nginx (`nginx/default.conf`) y backups automatizados (`bin/devops-db-backup.sh`).

### FASE 5: Gobierno SaaS y Gestión de Tenants (SuperAdmin)
- [x] **5.1** Directorio interactivo de organizaciones en frontend web.
- [x] **5.2** Modal de creación y edición de empresas con asignación de plan y cuotas.
- [x] **5.3** Acciones de suspensión y reactivación inmediata en base de datos.
- [x] **5.4** Asignación de licencias modulares en caliente.

### FASE 6: Motor de Facturación, Checkout y Auto-Onboarding B2B
- [x] **6.1** Catálogo comercial de planes (Starter $49/mes, Pro $149/mes, Enterprise $499/mes).
- [x] **6.2** Flujo de Auto-Registro de empresas (`registerNewTenant`).
- [x] **6.3** Generación de sesiones de Checkout mock (`createCheckoutSession`).
- [x] **6.4** Procesador de Webhooks de pasarela (`handlePaymentWebhook`).

### FASE 7: Enrutamiento Modular y Saneamiento de Endpoints
- [x] **7.1** Saneamiento de rutas legadas y estandarización a 4 módulos canónicos.
- [x] **7.2** Cero alerts y confirmaciones nativas del navegador (modales HTML/CSS dialog custom).
- [x] **7.3** Auditoría de integridad de base de datos (`tests/verify-db-integrity.js`).

### FASE 8: Motor de Temas Jerárquico (Tenant vs Usuario)
- [x] **8.1** Soporte de persistencia en base de datos para Tema Base de Organización y Preferencia Personal de Usuario.
- [x] **8.2** Endpoints `GET /api/theme` y `POST /api/theme` con soporte de scopes.
- [x] **8.3** Suite de pruebas jerárquicas (`tests/test-theme-hierarchy.js`).
- [x] **8.4** Sincronización atómica y consistencia en asignación/toma de pedidos entre ScanBan y Scanner Mobile (`operator_email` + `assigned_operator_email`).
- [x] **8.5** Escaneo asistido con tarjeta de producto pendiente, retículo láser, diagnóstico comparativo esperado vs. escaneado y modo de reintento/pausa interactivo en Mobile Scanner.
- [x] **8.6** Modo de escaneo enfocado selectivo al tocar cualquier tarjeta de ítem en la pantalla de resumen del pedido.
- [x] **8.7** Aislamiento Multi-Tenant exhaustivo en consultas y mutaciones de pedidos (`getFullOrderFromDb`, `claim-order`, `release-order`, `pdf-raw`) con obligatoriedad de `AND tenant_id = ?`.
- [x] **8.8** Endpoint transaccional `POST /api/scanban/update-scan-progress` para persistencia en tiempo real de ítems escaneados y audio feedback PCM WAV de 1200Hz con soporte de iOS Silent Mode.
- [x] **8.9** Eliminación estricta de restricción UNIQUE(tenant_id, order_number) y consagración del UUID (`orders.id`) como único identificador técnico inmutable.
- [x] **8.10** Mutación transaccional inmediata a DONE al presionar Despachar, ocultamiento contextual de botón de escaneo al 100% verificado y centrado visual de pantalla de confirmación.
- [x] **8.11** Estabilización del ciclo de vida de órdenes despachadas: protección contra borrado en memoria por sincronización periódica en segundo plano.

### FASE 9: Módulo 4see (Inteligencia E-Commerce & Repricing en Piloto Automático)
- [x] **9.1** Arquitectura desacoplada de módulo en `modules/4see/` (extractor multi-tier Mercado Libre / JSON-LD / HTML, motor de rentabilidad neta y repricing táctico).
- [x] **9.2** Modelo relacional PostgreSQL 16 con políticas RLS (`fourseee_competitor_monitors`, `fourseee_catalog_items`, `fourseee_margin_rules`).
- [x] **9.3** Endpoints API REST `/api/4see/*` y protección con middleware `requireModule('4see')`.
- [x] **9.4** Integración en catálogo de planes comerciales (`lib/billing.js`) para planes Pro y Enterprise.
- [x] **9.5** Interfaz Web SPA en `public/index.html` y `public/app.js` con tabs para Monitores de Competidores, Diff View interactivo de catálogo y Simulador de Márgenes con repricing táctico (+8%).
- [x] **9.6** Suite de pruebas automatizada en `bin/test-4see.js` validando fórmulas de margen, extracción de datos y entitlements.
- [x] **9.7** Documentación canónica sincronizada en los 6 archivos de `/docs`.

### FASE 10: Subsistema Integral de Roles Dinámicos y Permisos Granulares (RBAC Nivel 2)
- [x] **10.1** Desacople de strings fijos de roles y creación de tablas relacionales `permissions`, `roles` y `role_permissions` con RLS.
- [x] **10.2** Catálogo canónico de 22 permisos granulares a nivel de acción (`modulo:recurso:accion`) y roles de sistema base (`superadmin`, `admin`, `operator`).
- [x] **10.3** Motor backend de validación de permisos en `lib/rbac.js` (`hasPermission`, `formatPermissionError`, `getUserPermissions`, etc.).
- [x] **10.4** Contrato centralizado de error HTTP 403 con código `INSUFFICIENT_PERMISSIONS` y campo `required_permission`.
- [x] **10.5** Endpoints de administración de roles y permisos (`GET /api/permissions`, `GET /api/roles`, `POST /api/roles`, `PUT /api/roles/:id`, `DELETE /api/roles/:id`).
- [x] **10.6** Refactorización y blindaje de todos los módulos (`tenant`, `core`, `kanban`, `scanner`, `4see`) con validaciones de permisos granulares.
- [x] **10.7** Interfaz Web SPA en Módulo Core (`/core`) con vista de Roles y Permisos, tabla de roles con contador de usuarios y modal con checkboxes agrupados por módulo.
- [x] **10.8** Selector dinámico de roles en el modal de usuario poblado desde `/api/roles` con asignación de `role_id` UUID.
- [x] **10.9** Interceptor global de fetch en frontend y modal centralizado de error 403 (`showPermissionDeniedModal`).
- [x] **10.10** Actualización de reglas y workflows en `.agents/AGENTS.md` y `.agents/skills/holospace-module-creator/SKILL.md`.
- [x] **10.11** Refactorización de roles predeterminados de sistema a 8 roles modulares desacoplados (`tenant_admin`, `core_admin`, `kanban_admin`, `kanban_operator`, `scanner_operator`, `4see_admin`, `4see_user`, `superadmin`) con migración automática y compatibilidad retroactiva.
- [x] **10.12** Refactorización de nombres de tablas de PostgreSQL con prefijos modulares desacoplados (`core_*`, `kanban_*`, `tenant_*`, `fourseee_*`) y eliminación de vistas legadas (fase Alpha nativa).
- [x] **10.13** Suite integral de pruebas automatizadas con cobertura total de todos los módulos (`kanban`, `scanner`, `core`, `tenant`, `4see`), con creación de `tests/test-kanban-module.js`, `tests/test-scanner-module.js` y el orquestador unificado `tests/run-all-tests.js` (11 suites, 100% PASS).

### FASE 11: Estandarización de Plantilla Canónica ABM/CRUD y Búsqueda Reactiva Universal
- [x] **11.1** Creación de la Skill Canónica `.agents/skills/holospace-crud-template/SKILL.md` y registro obligatorio en `.agents/AGENTS.md`.
- [x] **11.2** Definición de clases maestras (`.table-responsive-container`, `.input-search`, `.search-box-wrapper`, `.actions-controls`) en `public/index.html` y los 5 temas de `public/css/holospace-theme.css`.
- [x] **11.3** Implementación de búsqueda reactiva multi-columna en memoria (`filterUsersTable`) y reglas anti-truncado en Módulo Core (`Usuarios`).
- [x] **11.4** Implementación de búsqueda reactiva (`filterRolesTable`) y eliminación de corte de textos en Módulo Core (`Roles y Permisos`).
- [x] **11.5** Transformación del Directorio de Organizaciones en Módulo Tenant (`/tenant`) a la Tabla Canónica con buscador en vivo (`filterTenantsTable`), preservando KPIs superiores.
- [x] **11.6** Refactorización y estandarización a la plantilla canónica con búsqueda en vivo en las tres vistas del Módulo 4see (`Monitores`, `Catálogo Diff` y `Márgenes`).
- [x] **11.7** Blindaje de anchos y clases de tabla en Módulo Kanban (`Explorador de Pedidos`).
- [x] **11.8** Documentación canónica en `docs/ARCHITECTURE.md` (Sección 10) y `docs/MODULES.md` (Sección 3).
- [x] **11.9** Verificación y paso exitoso de las 11 suites de pruebas automatizadas en Docker (`tests/run-all-tests.js`).

---

## 3. Próximas Fases Planificadas

- [ ] **FASE 11:** Integración con Pasarela de Pagos Real (Stripe / Mercado Pago).
- [ ] **FASE 12:** Soporte de Dominios Personalizados (Custom Domains con SSL automatizado Let's Encrypt vía Nginx).
- [ ] **FASE 13:** Panel de Analíticas Avanzadas (Módulo `analytics`) con gráficos de tiempo de preparación y métricas de operarios.
