# HoloSpace SaaS Baseline (v1.2.1)

> **Plataforma Contenedora Multi-Tenant B2B Enterprise para Gestión Operativa, Logística y Monetización por Suscripción.**

HoloSpace es una infraestructura modular y multi-empresa (SaaS Multi-Tenant) de alto rendimiento. Permite ejecutar múltiples aplicaciones de negocio sobre una arquitectura desacoplada, con autenticación segura JWT, control de acceso basado en roles (RBAC), licenciamiento modular dinámico por plan de suscripción, base de datos relacional con **Row-Level Security (RLS)** y soporte completo para despliegue en **Docker**.

---

## Módulos Oficiales del Sistema

| Módulo | Entorno / URL Directa | Rol Acceso | Entitlement / Código | Descripción |
|---|---|---|---|---|
| **Tenant** | `http://localhost:3001/tenant` | `SUPERADMIN` (Exclusivo) | Mandatorio (`tenant`) | **Gobierno SaaS Multi-Tenant:** Alta de empresas, gestión de planes, cuotas, asignación de usuarios y licenciamiento. |
| **Core** | `http://localhost:3001/core` | `SUPERADMIN` / `ADMIN` | Mandatorio (`core`) | Plataforma base: autenticación centralizada, gestión de usuarios, administración dinámica de roles y permisos granulares (RBAC Nivel 2), motor de temas y auditoría. |
| **Kanban** | `http://localhost:3001/kanban` | `ADMIN` / `OPERATOR` | Planes Kanban (`kanban_simple`, `kanban_business`, `kanban_enterprise`) | Tablero Kanban interactivo 4 columnas, ingesta/parseo automático de remitos PDF y explorador de pedidos. |
| **Scanner** | `http://localhost:8081/scanner` (App Expo) | `OPERATOR` / `ADMIN` | Planes Kanban (`kanban_simple`, `kanban_business`, `kanban_enterprise`) | App móvil/web de escaneo de códigos de barra EAN-13, validación sonora en depósito y despacho con estampa digital. |
| **4see** | `http://localhost:3001/4see` | `ADMIN` / `OPERATOR` | Planes 4see (`fourseee_simple`, `fourseee_business`, `fourseee_enterprise`) | Inteligencia comercial e-commerce: vigilancia de precios de competidores, auditoría de catálogo y protección de margen neto. |

---

## Cuentas y Acceso

Este documento no contiene credenciales. La regla del proyecto es cero secretos en el repositorio.

* **SUPERADMIN de plataforma:** su email y contraseña se definen en `.env` (`SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`). Copiar `.env.example` a `.env` y completar.
* **Usuarios de demostracion (tenants `poke` y `drinklovers`):** los crea el seed de `data/init-schema.sql` solo en entornos de desarrollo. Sus claves se consultan con el responsable del proyecto. Ver deuda D-003 en [DEBT.md](./DEBT.md).
* **Jerarquia de roles:** Nivel 1 `SUPERADMIN` (gobierno global: tenants, licencias, auditoria). Nivel 2 roles por organizacion (`CORE_ADMIN`, `SCANNER_OPERATOR` y roles personalizados RBAC), siempre aislados por `tenant_id`.
* **Organizaciones demo:** `poke` (plan `kanban_simple`, sin 4see) y `drinklovers` (`kanban_enterprise` + `fourseee_business`).

---

## Ejecución del Proyecto (100% Dockerizado con Hot-Reload)

El proyecto está completamente dockerizado. **Con un solo comando se levanta todo el ecosistema** en contenedores con sincronización de código en vivo (*Hot-Reload*):

```bash
docker compose up -d --build
```

> **Hot-Reload en Desarrollo:** Cualquier cambio en el frontend (`public/`, `modules/*/public/`) o backend (`server.js`, `lib/`) se sincroniza instantáneamente sin necesidad de reiniciar los contenedores.

---

### Comandos para Ver Logs de Docker en Tiempo Real

Para monitorear la actividad de los contenedores, depurar peticiones y ver eventos en vivo:

| Objetivo | Comando |
|---|---|
| **Ver logs de TODOS los servicios en tiempo real** | `docker compose logs -f` |
| **Ver logs únicamente del Servidor de Aplicación (Node.js)** | `docker compose logs -f app` |
| **Ver logs de la Base de Datos PostgreSQL 16** | `docker compose logs -f postgres` |
| **Ver logs del Servidor de Caché Redis** | `docker compose logs -f redis` |
| **Ver las últimas 100 líneas y seguir en vivo** | `docker compose logs --tail=100 -f` |

---

### Comandos de Control de Contenedores:
* **Detener todos los servicios:** `docker compose down`
* **Reiniciar el servidor de aplicación:** `docker compose restart app`
* **Limpiar y resetear la base de datos PostgreSQL:** `bash bin/devops-db-refresh.sh`

---

## ¿Cómo Acceder a Cada Módulo y Aplicación?

Una vez levantado Docker (`docker compose up -d --build`), accede a cada módulo por su URL directa según el rol y propósito:

---

### 1. Módulo Tenant (`SUPERADMIN`)
* **URL Directa:** [`http://localhost:3001/tenant`](http://localhost:3001/tenant)
* **Acceso:** usuario SUPERADMIN definido en `.env`.
* **Funcionalidades:**
  * **Directorio de Organizaciones:** Gestión integral de Tenants (Nombre, Slug, Plan, Límites de Usuarios y Órdenes/Mes).
  * **Licenciamiento Dinámico:** Activación/desactivación de módulos **Kanban** y **Scanner** por empresa.
  * **Tema Base por Defecto:** Asignación del tema visual corporativo (`Holo Night` o `Holo Day`).

---

### 2. Módulo Core (`SUPERADMIN`)
* **URL Directa:** [`http://localhost:3001/core`](http://localhost:3001/core)
* **Acceso:** usuario SUPERADMIN definido en `.env`.
* **Funcionalidades:**
  * **Usuarios Globales:** Alta, edición y desactivación de usuarios en toda la plataforma.
  * **Plataforma y Módulos:** Estado de base de datos PostgreSQL, servidor Node.js y catálogo oficial.
  * **Auditoría Inmutable:** Registro de auditoría de eventos de seguridad y cambios de configuración.

---

### 3. Módulo Kanban (`ADMIN` / `OPERATOR`)
* **URL Directa:** [`http://localhost:3001/kanban`](http://localhost:3001/kanban)
* **Acceso:** usuarios de la organizacion con permisos `kanban:*` (ver Cuentas y Acceso).
* **Funcionalidades:**
  * **Tablero Kanban 4 Columnas:** `BACKLOG` (Subida de remito PDF), `READY` (Listos para tomar), `DOING` (En preparación por operario), `DONE` (Completados y estampados).
  * **Explorador de Pedidos:** Búsqueda rápida por comprobante, cliente y filtros por operario.
  * **Acceso Rápido a Conexión QR:** Botón **`QR`** en la barra superior para vincular dispositivos móviles.

---

### 4. Módulo Scanner (`OPERATOR` / `ADMIN`)
* **URL Web Directa:** [`http://localhost:8081/scanner`](http://localhost:8081/scanner) (o [`http://localhost:8081`](http://localhost:8081))
* **Celular Físico (Expo Go):** Escanear el código QR del botón **`QR`** en `http://localhost:3001/kanban`.
* **Acceso:** operarios de la organizacion con el rol `SCANNER_OPERATOR`.
* **Funcionalidades:**
  * **Toma 1 a 1 de Pedidos:** Escaneo enfocado con prioridad del pedido activo en primer lugar.
  * **Validación Sonora y Visual:** Lector de código de barras EAN-13, progreso en tiempo real y despacho con estampa digital.

---

### 5. Módulo 4see (`CORE_ADMIN` / `4SEE_ADMIN`)
* **URL Web Directa:** [`http://localhost:3001/4see`](http://localhost:3001/4see) (o sección 4see en la barra de navegación)
* **Funcionalidades Principales:**
  * **SmartPrice 1:N:** Mapeo de un único producto propio contra múltiples URLs de competidores directos y marketplaces.
  * **Piso Inquebrantable de Margen:** Blindaje matemático contra pérdidas: $\text{Piso} = \text{Costo} \times (1 + \text{Margen}) + \text{Costos Operativos}$.
  * **Captura de Sobremargen:** Ajuste automático hacia el PVP máximo permitido ante quiebre de stock ajeno (*out-of-stock*).
  * **Worker Asíncrono en Background:** Tareas de scraping no bloqueantes y cola de sugerencias con aprobación manual o despacho push automático hacia Tiendanube y WooCommerce.
  * **Auditoría Ontológica:** Detección de ausencias de GTIN/EAN, normalización y generador de EAN-13 internos GS1 (prefijo 200).

---

## Batería de Pruebas y Validación Automatizada

El proyecto incluye un runner unificado que ejecuta secuencialmente todas las suites de prueba para cada uno de los módulos de la plataforma dentro del contenedor Docker de aplicación:

```bash
# Ejecutar la suite completa consolidada (15 suites, todos los módulos)
docker compose exec app node tests/run-all-tests.js

# O ejecutar suites individuales por módulo:
docker compose exec app node tests/verify-db-integrity.js      # Integridad PostgreSQL 16 y RLS
docker compose exec app node tests/test-auth-jwt.js            # Core: Autenticación JWT y scrypt
docker compose exec app node tests/test-rbac-granular.js       # Core: Permisos granulares y roles
docker compose exec app node tests/test-theme-hierarchy.js     # Core: Jerarquía de temas HW-DS
docker compose exec app node tests/test-tenants-module.js      # Tenant: Gobierno y aislamiento
docker compose exec app node tests/test-entitlement.js         # Tenant: Entitlements y cuotas
docker compose exec app node tests/test-billing-onboarding.js  # Tenant: Facturación y onboarding
docker compose exec app node tests/test-modules-toggle.js      # Tenant: Activación dinámica de módulos
docker compose exec app node tests/test-kanban-module.js       # Kanban: Ciclo de vida y logística
docker compose exec app node tests/test-scanner-module.js      # Scanner: Picking móvil y EAN-13
docker compose exec app node bin/test-4see.js                 # 4see: Rentabilidad, extractor y repricing
docker compose exec app node tests/test-4see-ontology.js       # 4see: Ontología universal y auditoría on-the-fly
docker compose exec app node tests/test-4see-stores.js         # 4see: Gestión multi-tienda persistente y RLS
docker compose exec app node tests/test-4see-smartprice.js     # 4see: SmartPrice 1:N y piso inquebrantable
docker compose exec app node tests/test-oauth-and-role-quotas.js # Core: Google OAuth2 y cuotas por rol
```

O ejecutar el orquestador unificado de las 15 suites completas:
```bash
docker compose exec app node tests/run-all-tests.js
```

---

## Respaldos y Exportación Aislada de Tenants

HoloSpace cuenta con herramientas de backup seguras y trazables:

```bash
# Generar un respaldo instantáneo completo de la base de datos
bash bin/devops-db-backup.sh

# Exportar de forma aislada y sanitizada todos los datos de un Tenant específico
node bin/tenant-dump.sh drinklovers
```
*Los snapshots se almacenan en el directorio `./backups/`.*

---

## Estructura del Repositorio

```
holospace-baseline/
├── .claude/                        ← Skills, hooks y reglas del agente (Claude Code)
├── bin/                            ← Herramientas DevOps, migradores y test suites
│   ├── devops-db-backup.sh          ← Script universal de backups
│   ├── migrate-sqlite-to-postgres.js ← Migrador SQLite a Postgres RLS
│   ├── tenant-dump.sh              ← Exportador aislado de datos por Tenant
│   ├── test-auth-jwt.js            ← Test suite de autenticación JWT
│   ├── test-billing-onboarding.js  ← Test suite de pasarela de pagos y onboarding
│   ├── test-entitlement.js         ← Test suite de licenciamiento modular
│   └── verify-db-integrity.js      ← Auditor de integridad relacional
├── data/                           ← DDLs y esquemas de base de datos
│   ├── init-schema.sql             ← DDL PostgreSQL 16 con políticas RLS
│   ├── schema-sqlite.sql           ← DDL SQLite Multi-Tenant
│   └── holospace.db                 ← Base de datos SQLite local
├── docs/                           ← Los 7 Documentos Canónicos del Sistema
│   ├── README.md                   ← Guía de inicio rápido, cuentas y comandos Docker
│   ├── ARCHITECTURE.md             ← Arquitectura desacoplada, PostgreSQL 16 RLS y OAuth2
│   ├── MODULES.md                  ← Especificación de los módulos oficiales y creación
│   ├── FEATURES.md                 ← Matriz de permisos RBAC, catálogo de planes y cuotas
│   ├── CONTENT.md                  ← Estrategia de contenidos, sprites pixel art y copy
│   ├── ROADMAP.md                  ← Trazabilidad de hitos y fases planificadas
│   └── DEBT.md                     ← Deuda tecnica priorizada
├── lib/                            ← Capas y motores desacoplados
│   ├── auth.js                     ← Hashing scrypt, firma JWT y RBAC
│   ├── billing.js                  ← Planes comerciales, checkout y webhooks
│   ├── db.js                       ← Capa Postgres RLS exclusiva
│   ├── oauth.js                    ← Capa modular de federación OAuth2 / OpenID Connect
│   ├── rbac.js                     ← Motor dinámico de permisos granulares
│   └── entitlement.js              ← Feature flags, módulos y cuotas
├── modules/                        ← Módulos de aplicación
│   ├── core/                       ← Módulo Core (Usuarios, Roles, Temas y Auditoría)
│   ├── tenant/                     ← Módulo Tenant (Directorio de Organizaciones)
│   ├── kanban/                     ← Módulo Kanban (Tablero logístico y explorador)
│   ├── scanner/                    ← Módulo Scanner (Picking móvil Expo / Web)
│   └── 4see/                       ← Módulo 4see (Inteligencia E-Commerce & Repricing)
├── nginx/                          ← Configuración de proxy reverso
│   └── default.conf                ← Configuración Nginx para SaaS
├── public/                         ← Portal web y recursos estáticos
├── server.js                       ← Servidor HTTP principal y dispatch de APIs
├── Dockerfile                      ← Dockerfile multi-stage de producción
├── docker-compose.yml              ← Orquestador Docker Compose para producción
└── README.md                       ← Documentación oficial
```

---

## Variables de Entorno del Sistema (.env)

| Variable | Descripción | Valor por Defecto / Ejemplo |
| :--- | :--- | :--- |
| `PORT` | Puerto HTTP del servidor Express | `3001` |
| `DATABASE_URL` | String de conexión a PostgreSQL 16 RLS | `postgresql://holospace_admin:****@postgres:5432/holospace_saas` |
| `JWT_SECRET` | Clave secreta para firma de tokens. Obligatoria (compose no arranca sin ella), minimo 32 caracteres aleatorios (`openssl rand -hex 32`) | definir en `.env` |
| `NODE_ENV` | `production` activa HSTS, exige `JWT_SECRET` fuerte y limita CORS a `CORS_ORIGINS` | `development` |
| `CORS_ORIGINS` | Origenes permitidos para la API, separados por coma (en produccion) | `https://app.tudominio.com` |
| `LOGIN_RATE_MAX` | Intentos fallidos de login por IP y email cada 15 minutos | `10` |
| `GOOGLE_CLIENT_ID` | Client ID de Google OAuth2 / Workspace | Configurable en Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Secreto de cliente Google OAuth2 | Configurable en Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | URL de redirección del callback OAuth2 | `https://holospace.com.ar/api/auth/google/callback` |

---

## Documentación Canónica del Sistema (/docs)
* [Arquitectura Técnica y Seguridad RLS](./ARCHITECTURE.md)
* [Especificación de Módulos Oficiales](./MODULES.md)
* [Matriz de Permisos RBAC y Catálogo de Planes](./FEATURES.md)
* [Estrategia de Contenidos y Diseño](./CONTENT.md)
* [Trazabilidad de Hitos y Roadmap](./ROADMAP.md)
* [Deuda Tecnica](./DEBT.md)
