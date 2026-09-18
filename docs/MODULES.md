# Especificación Canónica de Módulos y Guía de Creación — HoloSpace Baseline

> Documento maestro que detalla la arquitectura de los 5 módulos oficiales de HoloSpace Baseline (`core`, `tenant`, `kanban`, `scanner`, `4see`), el motor de licenciamiento modular y la guía oficial para desarrolladores sobre cómo crear nuevos módulos.

---

## 1. Los 5 Módulos Oficiales de la Plataforma

```text
modules/
├── core/                   ← Plataforma Base, Auth JWT, Motor de Temas y RLS
├── tenant/                 ← Gobierno SaaS (SuperAdmin), Planes y Organizaciones
├── kanban/                 ← Tablero Kanban Web y Procesador de PDF
├── scanner/                ← App Móvil Expo / React Native y Lector EAN-13
└── 4see/                   ← Inteligencia E-Commerce: Monitor, Catálogo Diff & Márgenes
```

---

### Módulo 1: Core (`modules/core/`)
- **Clave:** `core` | **Categoría:** `system` | **Estado:** Siempre activo (Obligatorio).
- **Roles Canónicos:** `core_admin` (Gobierno de usuarios y roles) y `superadmin`.
- Provee autenticación JWT nativa y federada (Google Workspace OAuth2 / OpenID Connect), perfil de usuario, administración dinámica de roles y catálogo de permisos granulares (`/api/roles`, `/api/permissions`), motor de temas HW-DS, navegación SPA, control de cuotas por rol y auditoría.

### Módulo 2: Tenant (`modules/tenant/`)
- **Clave:** `tenant` | **Categoría:** `admin` | **Acceso:** `superadmin` y `tenant_admin`.
- Directorio de Organizaciones, gestión de planes verticales especializados por producto (**Kanban** y **4see**) con soporte nativo de multi-suscripción concurrente por empresa, asignación de cuotas granulares por rol (`role_quotas`), auto-onboarding B2B y licenciamiento en vivo.

### Módulo 3: Kanban (`modules/kanban/`)
- **Clave:** `kanban` | **Categoría:** `operational` | **Acceso:** `kanban_admin` y `kanban_operator` (Tenant con módulo contratado).
- Tablero Kanban 4 columnas (Backlog, Listo, En Proceso, Completado), parser PDF y asignaciones.
- Sincroniza estados de pedidos actualizando `operator_email` y `assigned_operator_email`.

### Módulo 4: Scanner (`modules/scanner/`)
- **Clave:** `scanner` | **Categoría:** `operational` | **Acceso:** `scanner_operator` (App Móvil Expo / PWA).
- Lector de códigos EAN-13, sincronización offline SQLite local (`holospace.db`) y respuesta háptica.
- Interfaz de escaneo asistido con tarjeta superior de producto pendiente, retículo con línea central láser y panel comparativo de código esperado vs. escaneado para control de calidad y captura de pantalla.
- Flujo interactivo dual: salida automática inmediata ante lectura exitosa (zero-clicks) y retención con pausa de cámara, visualización de discrepancia EAN, botón de reintento y salida manual ante errores.
- Selección enfocada de ítems: permite al operario tocar un ítem puntual del resumen para escanearlo específicamente o usar el botón general para escaneo secuencial.

### Módulo 5: 4see (`modules/4see/`)
- **Clave:** `4see` | **Categoría:** `operational` | **Acceso:** `4see_admin` y `4see_user` (Planes 4see: `fourseee_simple`, `fourseee_business`, `fourseee_enterprise`).
- **Propósito:** Torre de control unificada para e-commerce: vigilancia de competencia, auditoría de catálogo y protección de rentabilidad.
- **Sub-herramientas integradas:**
  - **4see Monitor:** Rastreo automático de URLs de competidores, variaciones de precio y quiebres de stock mediante motor en cascada de 3 capas (Capa 1: JSON-LD y OpenGraph; Capa 2: Heurística DOM; Capa 3: API Mercado Libre directa).
  - **4see Catalog:** Auditoría de catálogo multicanal (detección de ausencias de GTIN/EAN o marca), optimización de títulos comerciales y visualización de dos columnas *Diff View* con aprobación granular. Incorpora capa ontológica universal en memoria (`StoreListing`), conectores desacoplados para Tiendanube (API v1) y WooCommerce (REST API v3), motor de reglas OQL sin persistencia forzada ("on the fly"), capacidad de write-back selectivo hacia las tiendas, asistente interactivo de atributos con inferencia de marca, generador de códigos EAN-13 internos GS1 (prefijo 200 con checksum módulo 10) y edición libre por parte del usuario con re-auditoría reactiva en memoria, y gestión multi-tienda persistente (`fourseee_connected_stores`) con almacenamiento seguro y encriptado por tenant para evitar reingreso de credenciales.
  - **4see Margins:** Guardián de rentabilidad neta en economías con alta inflación o comisiones (cálculo de costos de reposición, comisiones de pasarela, impuestos IVA/IIBB y fletes), alerta temprana de Zona Roja y repricing táctico (+8%) ante quiebre de competidores.
  - **4see SmartPrice (Dynamic Pricing 1:N):** Motor de monitoreo de competidores con vinculación 1 a N de productos propios hacia URLs rivales, historial inmutable de precios (`fourseee_price_logs`), blindaje inquebrantable de margen de ganancia mediante columna autogenerada en PostgreSQL (`min_price_floor = cost_price * (1 + margin) + op_costs`), detección automática de quiebres ajenos (*out-of-stock*) para captura de sobremargen, resolución determinista de reglas condicionales IF/THEN por prioridad, worker asíncrono en background no bloqueante y cola de despacho con aprobación manual en 1 clic o push automático hacia Tiendanube y WooCommerce.
- **Rutas API:** `/api/4see/monitors`, `/api/4see/catalog`, `/api/4see/stores`, `/api/4see/store/audit-live`, `/api/4see/store/write-back`, `/api/4see/margins`, `/api/4see/products`, `/api/4see/competitors`, `/api/4see/mappings`, `/api/4see/rules`, `/api/4see/queue`, `/api/4see/worker/run-cycle`. Protected by `requireModule('4see')`.

---

## 2. Motor de Licenciamiento y Entitlements (`lib/entitlement.js`)

Middleware `requireModule` protege los endpoints según el plan contratado:
```javascript
const { requireModule } = require('./lib/entitlement');
if (req.url.startsWith('/api/kanban/')) {
  const allowed = await requireModule('kanban')(req, res, currentUser);
  if (!allowed) return;
}
```

---

## 3. Guía Oficial para Desarrolladores: Cómo Crear un Nuevo Módulo

Para crear un nuevo módulo en la plataforma de forma desacoplada y estandarizada, seguir la skill `holospace-module-creator` (.agents/skills/holospace-module-creator/SKILL.md). Los pasos mandatorios son:
1. Crear la carpeta en `modules/<nombre-modulo>/` con su frontend estático en `public/` y su lógica de negocio en `lib/` y `routes/`.
2. Registrar el módulo en la base de datos dentro de `data/init-schema.sql` (insertar en `tenant_modules_catalog` y habilitar en los tenants semilla).
3. Definir y registrar los permisos granulares del módulo en `core_permissions` y asignarlos a los roles correspondientes en `core_role_permissions`.
4. Vincular al catálogo de planes en `lib/billing.js` y `data/init-schema.sql`.
5. Nombrar las tablas con el prefijo oficial del módulo (ej: `<modulo>_<tabla>`) y configurar políticas RLS.
6. Toda interfaz web de administración o gestión de datos (ABM/CRUD) debe implementar estrictamente el Estándar Canónico ABM (ver `docs/ARCHITECTURE.md` Sección 10 y skill `.agents/skills/holospace-crud-template/SKILL.md`), incluyendo barra de búsqueda reactiva en tiempo real y envoltura en `.table-responsive-container` con protección tipográfica anti-truncado.

---

## 4. Catálogo de Tablas de Base de Datos por Módulo (PostgreSQL 16)

| Módulo Oficial | Tablas de Base de Datos | Responsabilidad |
| :--- | :--- | :--- |
| **Tenant** | `tenant_tenants`, `tenant_subscriptions`, `tenant_modules`, `tenant_modules_catalog`, `tenant_plans` | Gobierno SaaS, facturación, planes y cuotas |
| **Core** | `core_users`, `core_roles`, `core_permissions`, `core_role_permissions`, `core_audit_logs`, `core_platform_audit_logs`, `core_app_settings` | Identidad, autenticación, RBAC dinámico y configuración |
| **Kanban & Scanner** | `kanban_orders`, `kanban_order_items` | Pedidos, comprobantes, trazabilidad y picking de depósito |
| **4see** | `fourseee_competitor_monitors`, `fourseee_catalog_items`, `fourseee_margin_rules`, `fourseee_connected_stores`, `fourseee_products`, `fourseee_competitors`, `fourseee_product_competitor_mappings`, `fourseee_price_logs`, `fourseee_pricing_rules`, `fourseee_price_update_queue` | Monitores 1:N, catálogo propio con piso inquebrantable, reglas SmartPrice, cola de repricing, histórico de precios y conexiones de tiendas |
