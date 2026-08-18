# HoloSpace SaaS Baseline (v1.2.1)

> **Plataforma Contenedora Multi-Tenant B2B Enterprise para Gestión Operativa, Logística y Monetización por Suscripción.**

HoloSpace es una infraestructura modular y multi-empresa (SaaS Multi-Tenant) de alto rendimiento. Permite ejecutar múltiples aplicaciones de negocio sobre una arquitectura desacoplada, con autenticación segura JWT, control de acceso basado en roles (RBAC), licenciamiento modular dinámico por plan de suscripción, base de datos relacional con **Row-Level Security (RLS)** y soporte completo para despliegue en **Docker**.

---

## Módulos Oficiales del Sistema

| Módulo | Entorno / URL Directa | Rol Acceso | Entitlement / Código | Descripción |
|---|---|---|---|---|
| **Tenant** | `http://localhost:3001/tenant` | `SUPERADMIN` (Exclusivo) | Mandatorio (`tenant`) | **Gobierno SaaS Multi-Tenant:** Alta de empresas, gestión de planes, cuotas, asignación de usuarios y licenciamiento. |
| **Core** | `http://localhost:3001/core` | `SUPERADMIN` | Mandatorio (`core`) | Plataforma base: autenticación centralizada, control de usuarios/roles, motor de temas y auditoría. |
| **Kanban** | `http://localhost:3001/kanban` | `ADMIN` / `OPERATOR` | Plan Starter/Pro/Enterprise (`kanban`) | Tablero Kanban interactivo 4 columnas, ingesta/parseo automático de remitos PDF y explorador de pedidos. |
| **Scanner** | `http://localhost:8081/scanner` (App Expo) | `OPERATOR` / `ADMIN` | Plan Starter/Pro/Enterprise (`scanner`) | App móvil/web de escaneo de códigos de barra EAN-13, validación sonora en depósito y despacho con estampa digital. |

---

## Cuentas y Credenciales Oficiales (Entorno Multi-Tenant)

Todos los formularios de autenticación inician limpios por seguridad. La jerarquía de roles se organiza estrictamente en dos niveles:

### Nivel 1: Gobierno Global de la Plataforma (Proveedor SaaS)
El **único** usuario facultado para crear/administrar tenants, otorgar licencias y cambiar la configuración global de la infraestructura:

| Rol | Organización / Tenant | Email | Contraseña | Acceso / Propósito |
|---|---|---|---|---|
| **SUPERADMIN** | `holospace` | `superadmin@holospace.app` | `BrunaSeRelambe22!` | **Módulos Tenant & Core (Web):** Gestión total de Tenants, activación de módulos y auditoría global. |

---

### Nivel 2: Organizaciones Clientes (Tenants Aislados)
Cada empresa solo administra a sus propios usuarios y opera exclusivamente dentro de su tenant:

#### Organizacion: `poke` (Poke Argentina — `poke.com.ar`)
| Rol | Email | Contrasena | Acceso / Entorno |
|---|---|---|---|
| **ADMIN** | `admin@poke.com.ar` | `poke2026!` | **Kanban (Web `3001`):** Tablero Kanban operativo y explorador de pedidos de Poke. |
| **OPERATOR** | `juan@poke.com.ar` | `juan2026` | **Scanner (Web/Mobile `8081`):** Escaneo y preparación en depósito. |
| **OPERATOR** | `vanesa@poke.com.ar` | `vanesa2026` | **Scanner (Web/Mobile `8081`):** Escaneo y preparación en depósito. |

#### Organizacion: `drinklovers` (Drink Lovers Argentina — `drinklovers.com.ar`)
| Rol | Email | Contrasena | Acceso / Entorno |
|---|---|---|---|
| **ADMIN** | `admin@drinklovers.com.ar` | `drinklovers2026!` | **Kanban (Web `3001`):** Tablero Kanban operativo y explorador de pedidos de DrinkLovers. |
| **OPERATOR** | `juan@drinklovers.com.ar` | `juan2026` | **Scanner (Web/Mobile `8081`):** Escaneo y preparación en depósito. |
| **OPERATOR** | `vanesa@drinklovers.com.ar` | `vanesa2026` | **Scanner (Web/Mobile `8081`):** Escaneo y preparación en depósito. |

---

## 🚀 Ejecución del Proyecto (100% Dockerizado con Hot-Reload)

El proyecto está completamente dockerizado. **Con un solo comando se levanta todo el ecosistema** en contenedores con sincronización de código en vivo (*Hot-Reload*):

```bash
docker compose up -d --build
```

> ⚡ **Hot-Reload en Desarrollo:** Cualquier cambio en el frontend (`public/`, `modules/*/public/`) o backend (`server.js`, `lib/`) se sincroniza instantáneamente sin necesidad de reiniciar los contenedores.

---

### 📊 Comandos para Ver Logs de Docker en Tiempo Real

Para monitorear la actividad de los contenedores, depurar peticiones y ver eventos en vivo:

| Objetivo | Comando |
|---|---|
| 🌐 **Ver logs de TODOS los servicios en tiempo real** | `docker compose logs -f` |
| 🚀 **Ver logs únicamente del Servidor de Aplicación (Node.js)** | `docker compose logs -f app` |
| 🐘 **Ver logs de la Base de Datos PostgreSQL 16** | `docker compose logs -f postgres` |
| ⚡ **Ver logs del Servidor de Caché Redis** | `docker compose logs -f redis` |
| 📜 **Ver las últimas 100 líneas y seguir en vivo** | `docker compose logs --tail=100 -f` |

---

### 🛑 Comandos de Control de Contenedores:
* **Detener todos los servicios:** `docker compose down`
* **Reiniciar el servidor de aplicación:** `docker compose restart app`
* **Limpiar y resetear la base de datos PostgreSQL:** `bash bin/devops-db-refresh.sh`

---

## 🖥️ ¿Cómo Acceder a Cada Módulo y Aplicación?

Una vez levantado Docker (`docker compose up -d --build`), accede a cada módulo por su URL directa según el rol y propósito:

---

### 1. 🏛️ Módulo Tenant (`SUPERADMIN`)
* **URL Directa:** [`http://localhost:3001/tenant`](http://localhost:3001/tenant)
* **Credenciales de Acceso:**
  * **Email:** `superadmin@holospace.app`
  * **Contraseña:** `BrunaSeRelambe22!`
* **Funcionalidades:**
  * **Directorio de Organizaciones:** Gestión integral de Tenants (Nombre, Slug, Plan, Límites de Usuarios y Órdenes/Mes).
  * **Licenciamiento Dinámico:** Activación/desactivación de módulos **Kanban** y **Scanner** por empresa.
  * **Tema Base por Defecto:** Asignación del tema visual corporativo (`Omarchy Tiling WM`, `Omarchy Aetheria`, `Dark Glassmorphism`, etc.).

---

### 2. ⚙️ Módulo Core (`SUPERADMIN`)
* **URL Directa:** [`http://localhost:3001/core`](http://localhost:3001/core)
* **Credenciales de Acceso:**
  * **Email:** `superadmin@holospace.app`
  * **Contraseña:** `BrunaSeRelambe22!`
* **Funcionalidades:**
  * **Usuarios Globales:** Alta, edición y desactivación de usuarios en toda la plataforma.
  * **Plataforma y Módulos:** Estado de base de datos PostgreSQL, servidor Node.js y catálogo oficial.
  * **Auditoría Inmutable:** Registro de auditoría de eventos de seguridad y cambios de configuración.

---

### 3. 📋 Módulo Kanban (`ADMIN` / `OPERATOR`)
* **URL Directa:** [`http://localhost:3001/kanban`](http://localhost:3001/kanban)
* **Credenciales de Acceso por Empresa:**
  * **Poke Argentina:**
    * Admin: `admin@poke.com.ar` / `poke2026!`
    * Operarios: `juan@poke.com.ar` / `juan2026` · `vanesa@poke.com.ar` / `vanesa2026`
  * **Drink Lovers Argentina:**
    * Admin: `admin@drinklovers.com.ar` / `drinklovers2026!`
    * Operarios: `juan@drinklovers.com.ar` / `juan2026` · `vanesa@drinklovers.com.ar` / `vanesa2026`
* **Funcionalidades:**
  * **Tablero Kanban 4 Columnas:** `BACKLOG` (Subida de remito PDF), `READY` (Listos para tomar), `DOING` (En preparación por operario), `DONE` (Completados y estampados).
  * **Explorador de Pedidos:** Búsqueda rápida por comprobante, cliente y filtros por operario.
  * **Acceso Rápido a Conexión QR:** Botón **`QR`** en la barra superior para vincular dispositivos móviles.

---

### 4. 📱 Módulo Scanner (`OPERATOR` / `ADMIN`)
* **URL Web Directa:** [`http://localhost:8081/scanner`](http://localhost:8081/scanner) (o [`http://localhost:8081`](http://localhost:8081))
* **Celular Físico (Expo Go):** Escanear el código QR del botón **`QR`** en `http://localhost:3001/kanban`.
* **Credenciales de Operarios de Depósito:**
  * **Poke Argentina:** `juan@poke.com.ar` / `juan2026` (o `vanesa@poke.com.ar` / `vanesa2026`)
  * **Drink Lovers:** `juan@drinklovers.com.ar` / `juan2026` (o `vanesa@drinklovers.com.ar` / `vanesa2026`)
* **Funcionalidades:**
  * **Toma 1 a 1 de Pedidos:** Escaneo enfocado con prioridad del pedido activo en primer lugar.
  * **Validación Sonora y Visual:** Lector de código de barras EAN-13, progreso en tiempo real y despacho con estampa digital.

---

## 🧪 Batería de Pruebas y Validación Automatizada

El proyecto incluye suites de testing automatizadas para verificar la integridad de todos los subsistemas:

```bash
# 1. Auditoría de integridad de base de datos multi-tenant
node bin/verify-db-integrity.js

# 2. Pruebas de autenticación JWT, criptografía scrypt y RBAC
node bin/test-auth-jwt.js

# 3. Pruebas de motor de licenciamiento modular (Entitlements) y cuotas
node bin/test-entitlement.js

# 4. Pruebas de pasarela de pagos, webhooks y auto-onboarding B2B
node bin/test-billing-onboarding.js
```

O ejecutar toda la batería en un solo comando:
```bash
node bin/verify-db-integrity.js && node bin/test-auth-jwt.js && node bin/test-entitlement.js && node bin/test-billing-onboarding.js
```

---

## 🛡️ Respaldos y Exportación Aislada de Tenants

HoloSpace cuenta con herramientas de backup seguras y trazables:

```bash
# Generar un respaldo instantáneo completo de la base de datos
bash bin/backup-database.sh

# Exportar de forma aislada y sanitizada todos los datos de un Tenant específico
node bin/tenant-dump.sh drinklovers
```
*Los snapshots se almacenan en el directorio `./backups/`.*

---

## 📂 Estructura del Repositorio

```
holospace-baseline/
├── .agents/                        ← Directivas y reglas de gobernanza del Agente
├── bin/                            ← Herramientas DevOps, migradores y test suites
│   ├── backup-database.sh          ← Script universal de backups
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
├── docs/                           ← Especificaciones arquitectónicas vivas
│   ├── ARCHITECTURE.md             ← Estructura técnica y capas
│   ├── DOCKER_AND_INFRASTRUCTURE.md ← Guía completa de Docker y Nginx
│   ├── MULTITENANT_SAAS_ARCHITECTURE.md ← Arquitectura Multi-Tenant y RLS
│   ├── SECURITY_AUTH_AND_BACKUP_STRATEGY.md ← Seguridad, JWT y Backups
│   └── SUBSCRIPTION_AND_MODULE_ENTITLEMENT.md ← Licenciamiento y Planes
├── lib/                            ← Capas y motores desacoplados
│   ├── auth.js                     ← Hashing scrypt, firma JWT y RBAC
│   ├── billing.js                  ← Planes comerciales, checkout y webhooks
│   ├── db.js                       ← Capa dual Postgres RLS / SQLite
│   └── entitlement.js              ← Feature flags, módulos y cuotas
├── modules/                        ← Módulos de aplicación
│   ├── core/                       ← Módulo Core (Web y Temas)
│   ├── scanban/                    ← Módulo ScanBan (Tablero Web + Scanner Móvil)
│   └── stockflow/                  ← Módulo StockFlow (Plantilla)
├── nginx/                          ← Configuración de proxy reverso
│   └── default.conf                ← Configuración Nginx para SaaS
├── public/                         ← Portal web y recursos estáticos
├── roadmap/                        ← Roadmap maestro del SaaS
│   └── SAAS_MULTITENANT_ROADMAP.md ← Registro de fases y tareas completadas
├── server.js                       ← Servidor HTTP principal y dispatch de APIs
├── Dockerfile                      ← Dockerfile multi-stage de producción
├── docker-compose.yml              ← Orquestador Docker Compose para producción
└── README.md                       ← Esta documentación
```

---

## 📚 Documentación Técnica Detallada

* [Arquitectura SaaS Multi-Tenant & RLS](./docs/MULTITENANT_SAAS_ARCHITECTURE.md)
* [Licenciamiento Modular y Planes](./docs/SUBSCRIPTION_AND_MODULE_ENTITLEMENT.md)
* [Seguridad, JWT y Estrategia de Backups](./docs/SECURITY_AUTH_AND_BACKUP_STRATEGY.md)
* [Infraestructura Docker y Nginx](./docs/DOCKER_AND_INFRASTRUCTURE.md)
* [Design System y Motor de Temas](./modules/core/theme/DESIGN_SYSTEM.md)
* [Roadmap de Transformación SaaS](./roadmap/SAAS_MULTITENANT_ROADMAP.md)
