# 🏛️ HoloSpace SaaS: Arquitectura Multi-Tenant & Modelo de Datos

> **Documento de Especificación Técnica:** Evolución de HoloSpace Baseline de arquitectura Single-Tenant a Ecosistema SaaS B2B Multi-Tenant escalable, seguro y monetizable por suscripciones.

---

## 1. Visión General & Objetivos Arquitectónicos

La evolución a **HoloSpace Multi-Tenant** permite transformar el software en un producto SaaS B2B donde múltiples empresas u organizaciones clientes (**Tenants**) operan de forma completamente aislada dentro de una misma infraestructura optimizada, compartiendo recursos computacionales con garantías criptográficas y relacionales de no-contaminación de datos (*Data Isolation*).

### Objetivos Clave:
1. **Aislamiento Estricto de Datos:** Ningún Tenant puede bajo ninguna circunstancia acceder, consultar o modificar información de otro Tenant.
2. **Escalabilidad Horizontal & Eficiencia en Costos:** Capacidad para atender a miles de organizaciones sin multiplicar linealmente los costos de infraestructura.
3. **Monetización Modular:** Capacidad de habilitar, cobrar y limitar módulos de forma independiente (`core`, `scanban`, `stockflow`, `analytics`) según la suscripción de cada Tenant.
4. **Resolución Flexible de Tenant:** Soporte para subdominios (`empresa.holospace.app`), dominios personalizados y encabezados HTTP (`X-Tenant-ID`).

---

## 2. Comparativa y Selección del Modelo de Multi-Tenancy

| Criterio | Modelo 1: Base de Datos por Tenant (`db-per-tenant`) | Modelo 2: Esquema por Tenant (`schema-per-tenant`) | **Modelo 3: Base de Datos Compartida con Row-Level Security (RLS)** *(Seleccionado)* |
|---|---|---|---|
| **Aislamiento** | Físico máximo | Lógico por esquema PostgreSQL | Lógico + Criptográfico en motor PostgreSQL con RLS |
| **Costo Operativo** | Muy Alto (pools de conexiones masivos) | Medio (complejidad en migraciones) | **Óptimo y Altamente Eficiente** |
| **Migraciones de Esquema** | Complejas (ejecutar en N bases) | Complejas (ejecutar en N schemas) | **Inmediatas e Instantáneas (1 sola base de datos)** |
| **Escalabilidad** | Limitada por recursos de servidor | Moderada | **Alta (millones de registros particionados)** |
| **Monitoreo & Backup** | Dumps individuales por base | Dumps por schema | **Backups globales + dumps selectivos por Tenant** |

> **Decisión Arquitectónica:** Adoptar **Modelo 3 (PostgreSQL 16 con Row-Level Security - RLS)** como estándar para SaaS en la nube, con particionamiento lógico mediante `tenant_id` obligatorio en todas las entidades transaccionales, y soporte de **SQLite / DB aislada** para despliegues dedicados *On-Premise* o instancias *Edge*.

---

## 3. Modelo Relacional Multi-Tenant (PostgreSQL 16)

```
┌────────────────────────────────┐       1:N       ┌─────────────────────────────────┐
│            tenants             │─────────────────│      tenant_subscriptions       │
│────────────────────────────────│                 │─────────────────────────────────│
│ id (UUID, PK)                  │                 │ id (UUID, PK)                   │
│ slug (VARCHAR, UNIQUE)         │                 │ tenant_id (FK -> tenants)       │
│ name (VARCHAR)                 │                 │ plan_code ('starter','pro',...) │
│ custom_domain (VARCHAR)        │                 │ status ('active','past_due',...)│
│ max_users (INT)                │                 │ current_period_end (TIMESTAMP)  │
│ status ('active','suspended')  │                 └─────────────────────────────────┘
│ created_at (TIMESTAMP)         │
└───────────────┬────────────────┘
                │ 1:N
     ┌──────────┴──────────────┬────────────────────────┬─────────────────────────┐
     ▼                         ▼                        ▼                         ▼
┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
│      users       │  │  tenant_modules  │  │        orders         │  │     audit_logs        │
│──────────────────│  │──────────────────│  │───────────────────────│  │───────────────────────│
│ id (UUID, PK)    │  │ id (UUID, PK)    │  │ id (UUID, PK)         │  │ id (UUID, PK)         │
│ tenant_id (FK)   │  │ tenant_id (FK)   │  │ tenant_id (FK)        │  │ tenant_id (FK)        │
│ email (VARCHAR)  │  │ module_code (FK) │  │ order_number (VARCHAR)│  │ user_id (FK)          │
│ password_hash    │  │ is_enabled (BOOL)│  │ status ('backlog',...)│  │ action (VARCHAR)      │
│ role ('ADMIN'..) │  │ quota_limit (INT)│  │ client_name (VARCHAR) │  │ details (JSONB)       │
└──────────────────┘  └──────────────────┘  └───────────┬───────────┘  └───────────────────────┘
                                                        │ 1:N
                                                        ▼
                                            ┌───────────────────────┐
                                            │      order_items      │
                                            │───────────────────────│
                                            │ id (UUID, PK)         │
                                            │ tenant_id (FK)        │
                                            │ order_id (FK)         │
                                            │ code (EAN / SKU)      │
                                            │ quantity_required     │
                                            │ quantity_scanned      │
                                            └───────────────────────┘
```

---

## 4. Implementación de Row-Level Security (RLS) en PostgreSQL

PostgreSQL ofrece **Row-Level Security (RLS)** nativo, asegurando que ninguna consulta SQL (ni siquiera un `SELECT * FROM orders`) pueda devolver datos de otro tenant a nivel de motor de base de datos.

### Ejemplo de Política RLS:

```sql
-- 1. Habilitar RLS en la tabla orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 2. Crear la política que filtra por el tenant activo en la sesión
CREATE POLICY tenant_isolation_policy ON orders
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
```

### Middleware de Sesión en Node.js:
Antes de ejecutar cualquier query en la transacción, el middleware establece la variable de sesión:
```javascript
await db.query(`SET LOCAL app.current_tenant_id = '${req.tenantId}';`);
```

---

## 5. Estrategia de Resolución de Tenant (Tenant Resolution)

HoloSpace resolverá el Tenant dinámicamente mediante 3 mecanismos jerárquicos:

1. **Subdominio DNS (Recomendado para Web):**
   * Petición a `drinklovers.holospace.app` ➔ Extrae el slug `drinklovers`.
2. **Encabezado HTTP `X-Tenant-ID` (Recomendado para Mobile App / Escáner):**
   * La app móvil envía `X-Tenant-ID: drinklovers` o `X-Tenant-ID: <UUID>` en cada llamada a la API.
3. **Token JWT:**
   * Una vez autenticado, el token JWT firmado contiene el claim inmutable `tenantId`.

---

## 6. Jerarquía de Roles Global vs Tenant (RBAC Multinivel)

```
┌──────────────────────────────────────────────────────────────┐
│                    PLATFORM_SUPERADMIN                       │
│  - Crea y suspende Tenants (Organizaciones)                  │
│  - Administra planes de suscripción y facturación global     │
│  - Acceso a logs globales de auditoría de plataforma         │
└──────────────────────────────┬───────────────────────────────┘
                               │ Administra N Tenants
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                        TENANT_ADMIN                          │
│  - Administra usuarios dentro de su propio Tenant            │
│  - Activa/configura módulos contratados en su suscripción    │
│  - Visualiza auditoría y métricas de su propia empresa       │
└──────────────────────────────┬───────────────────────────────┘
                               │ Administra operadores de su empresa
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                      TENANT_OPERATOR                         │
│  - Acceso operativo móvil (ScanBan Scanner)                  │
│  - Restringido estrictamente a los módulos contratados       │
└──────────────────────────────────────────────────────────────┘
```
