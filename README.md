# HoloWare SaaS Baseline

> **Plataforma Contenedora Multi-Tenant B2B Enterprise para Gestión Operativa, Logística y Monetización por Suscripción.**

HoloWare es una infraestructura modular y multi-empresa (SaaS Multi-Tenant) de alto rendimiento. Permite ejecutar múltiples aplicaciones de negocio sobre una arquitectura desacoplada, con autenticación segura JWT, control de acceso basado en roles (RBAC), licenciamiento modular dinámico por plan de suscripción, base de datos relacional con **Row-Level Security (RLS)** y soporte completo para despliegue en **Docker**.

---

## Módulos Oficiales del Sistema

| Módulo | Entorno | Rol Acceso | Entitlement / Código | Descripción |
|---|---|---|---|---|
| **Tenants** | Web | `SUPERADMIN` (Exclusivo) | Mandatorio (`tenants`) | **Gobierno SaaS Multi-Tenant:** Alta de empresas, gestión de suscripciones, asignación de usuarios y licenciamiento dinámico de módulos. |
| **HoloWare Core** | Web | `SUPERADMIN` | Mandatorio (`core`) | Plataforma base transversal: autenticación centralizada, motor de temas y logs de auditoría global. |
| **ScanBan Board** | Web | `ADMIN` / `OPERATOR` | Plan Pro/Enterprise (`scanban-board`) | Tablero Kanban interactivo 4 columnas, ingesta y parseo automático de remitos PDF y explorador de pedidos. |
| **ScanBan Scanner** | Mobile (Expo) / Web | `OPERATOR` / `ADMIN` | Plan Pro/Enterprise (`scanban-scanner`) | App móvil de escaneo de códigos de barra EAN-13, validación sonora en depósito y despacho con estampa digital. |
| **ScanFlow** | Web / Mobile | `ADMIN` / `OPERATOR` | Plan Enterprise (`scanflow`) | Módulo de control de inventario, stock por ubicación en depósito, trazabilidad de SKU/EAN y balance de existencias. |

---

## Cuentas y Credenciales Oficiales (Entorno Multi-Tenant)

Todos los formularios de autenticación inician limpios por seguridad. La jerarquía de roles se organiza estrictamente en dos niveles:

### Nivel 1: Gobierno Global de la Plataforma (Proveedor SaaS)
El **único** usuario facultado para crear/administrar tenants, otorgar licencias y cambiar la configuración global de la infraestructura:

| Rol | Organización / Tenant | Email | Contraseña | Acceso / Propósito |
|---|---|---|---|---|
| **SUPERADMIN** | `holoware` | `superadmin@hologrowth.com.ar` | `BrunaSeRelambe22!` | **HoloWare Core (Web):** Gestión total de Tenants, activación de módulos y auditoría global. |

---

### Nivel 2: Organizaciones Clientes (Tenants Aislados)
Cada empresa solo administra a sus propios usuarios y opera exclusivamente dentro de su tenant:

#### Organización: `poke` (Poke Argentina — `poke.com.ar`)
| Rol | Email | Contraseña | Acceso / Entorno |
|---|---|---|---|
| **ADMIN** | `admin@poke.com.ar` | `poke2026!` | **ScanBan Board (Web):** Tablero Kanban operativo y explorador de pedidos de Poke. |
| **OPERATOR** | `juan@poke.com.ar` | `juan2026!` | **ScanBan Scanner (Mobile / Web):** Escaneo y preparación en depósito. |
| **OPERATOR** | `vanesa@poke.com.ar` | `vanesa2026!` | **ScanBan Scanner (Mobile / Web):** Escaneo y preparación en depósito. |

#### Organización: `drinklovers` (Drink Lovers Argentina — `drinklovers.com.ar`)
| Rol | Email | Contraseña | Acceso / Entorno |
|---|---|---|---|
| **ADMIN** | `admin@drinklovers.com.ar` | `drinklovers2026!` | **ScanBan Board (Web):** Tablero Kanban operativo y explorador de pedidos de DrinkLovers. |
| **OPERATOR** | `juan@drinklovers.com.ar` | `juan2026!` | **ScanBan Scanner (Mobile / Web):** Escaneo y preparación en depósito. |
| **OPERATOR** | `vanesa@drinklovers.com.ar` | `vanesa2026!` | **ScanBan Scanner (Mobile / Web):** Escaneo y preparación en depósito. |

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

---

## 🖥️ ¿Cómo Acceder a Cada Módulo y Aplicación?

Una vez levantado Docker, accede a cada aplicación según tu rol y entorno:

### 1. 🏛️ HoloWare Core (Web — Gobierno de Plataforma)
* **URL en Navegador:** [`http://localhost:3001`](http://localhost:3001) (o [`http://localhost`](http://localhost))
* **Datos de Login:**
  * **Organización:** `holoware`
  * **Email:** `superadmin@hologrowth.com.ar`
  * **Contraseña:** `BrunaSeRelambe22!`
* **Funcionalidades:** Panel `🏛️ Plataforma` (gestión y licenciamiento de módulos por Tenant, estado del servidor y base de datos, logs de auditoría global), `👥 Usuarios Core` y selector central de `🎨 Tema`.

---

### 2. 📋 ScanBan Board (Web — Gestión Operativa & Kanban)
* **URL en Navegador:** [`http://localhost:3001`](http://localhost:3001) (o [`http://localhost`](http://localhost))
* **Datos de Login:**
  * **Empresa Drink Lovers:** Organización: `drinklovers` | Email: `admin@drinklovers.com.ar` | Contraseña: `drinklovers2026!`
  * **Empresa Poke Argentina:** Organización: `poke` | Email: `admin@poke.com.ar` | Contraseña: `poke2026!`
* **Funcionalidades:** `📋 Tablero Kanban` interactivo en 4 columnas (`TODO`, `DOING`, `DONE`, `HISTORIC`), subida y parseo automático de remitos PDF, `🔍 Explorador de Pedidos` e información del Tenant activo.

---

### 3. 📱 ScanBan Scanner (Mobile / Web — Operativa de Depósito)
* **Opción A (Navegador Web / PC):** Abre [`http://localhost:8081`](http://localhost:8081) directamente en Chrome o Safari.
* **Opción B (Celular Físico Android / iOS):** Abre la aplicación **Expo Go** en tu celular y escanea el código QR que se muestra en [`http://localhost:8081`](http://localhost:8081).
* **Datos de Login:**
  * **Operario de Drink Lovers:** Organización: `drinklovers` | Email: `juan@drinklovers.com.ar` (o `vanesa@drinklovers.com.ar`) | Contraseña: `juan2026!` (o `vanesa2026!`)
  * **Operario de Poke Argentina:** Organización: `poke` | Email: `juan@poke.com.ar` (o `vanesa@poke.com.ar`) | Contraseña: `juan2026!` (o `vanesa2026!`)
* **Funcionalidades:** Interfaz móvil táctil para depósito, lector de código de barras EAN-13 vía cámara, confirmación sonora de escaneo, asignación de pedidos e impresión/estampa digital.

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

HoloWare cuenta con herramientas de backup seguras y trazables:

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
holoware-baseline/
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
│   └── holoware.db                 ← Base de datos SQLite local
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
