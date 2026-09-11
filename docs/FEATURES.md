# Funcionalidades, Experiencia de Usuario y Planes — HoloSpace Baseline

> Documento maestro que detalla todas las capacidades funcionales de la plataforma, el catálogo de planes comerciales, el motor de facturación B2B, el sistema de diseño UX/UI y la jerarquía de temas visuales.

---

## 1. Matriz de Control de Acceso y Permisos Granulares (RBAC)

HoloSpace implementa un modelo de roles dinámicos con granularidad a nivel de acción (`modulo:recurso:accion`):

### 1.1 Catálogo Canónico de Permisos Granulares y Roles Modulares

| Módulo | Clave de Permiso | Acción | Descripción | Rol Sistema Predeterminado |
| :--- | :--- | :--- | :--- | :--- |
| **Platform** | `*` | all | Acceso irrestricto de SuperAdmin | superadmin |
| **Core** | `core:users:read` | read | Ver usuarios de la organización | superadmin, core_admin |
| **Core** | `core:users:manage` | manage | Crear, editar y desactivar usuarios | superadmin, core_admin |
| **Core** | `core:roles:read` | read | Ver roles del sistema y personalizados | superadmin, core_admin |
| **Core** | `core:roles:manage` | manage | Crear, editar y eliminar roles personalizados | superadmin, core_admin |
| **Core** | `core:modules:read` | read | Ver módulos instalados y estado | superadmin, core_admin |
| **Core** | `core:theme:manage` | manage | Configurar tema corporativo de la empresa | superadmin, core_admin |
| **Core** | `core:audit:read` | read | Ver registros de auditoría de plataforma | superadmin, core_admin, tenant_admin |
| **Tenant** | `tenant:tenants:read` | read | Ver directorio de organizaciones SaaS | superadmin, tenant_admin |
| **Tenant** | `tenant:tenants:manage` | manage | Crear, editar y suspender tenants | superadmin, tenant_admin |
| **Tenant** | `tenant:modules:manage` | manage | Licenciar o deslicenciar módulos para un tenant | superadmin, tenant_admin |
| **Tenant** | `tenant:quotas:manage` | manage | Ajustar cuotas de usuarios y pedidos | superadmin, tenant_admin |
| **Kanban** | `kanban:orders:read` | read | Ver pedidos en tablero y explorador | superadmin, kanban_admin, kanban_operator |
| **Kanban** | `kanban:orders:ingest` | ingest | Ingesta y parseo automático de PDF | superadmin, kanban_admin |
| **Kanban** | `kanban:orders:assign` | assign | Asignar y reasignar operarios a pedidos | superadmin, kanban_admin |
| **Kanban** | `kanban:orders:dispatch` | dispatch | Mover estados y despachar pedidos | superadmin, kanban_admin, kanban_operator |
| **Scanner** | `scanner:orders:view_assigned` | read | Ver pedidos asignados para escaneo | superadmin, scanner_operator |
| **Scanner** | `scanner:items:scan` | scan | Escanear códigos de barra EAN-13 | superadmin, scanner_operator |
| **Scanner** | `scanner:items:verify` | verify | Verificar discrepancias y cantidades | superadmin, scanner_operator |
| **4see** | `4see:catalog:read` | read | Ver monitor de precios y catálogo | superadmin, 4see_admin, 4see_user |
| **4see** | `4see:catalog:audit` | audit | Auditar catálogo y ver diffs de competidores | superadmin, 4see_admin, 4see_user |
| **4see** | `4see:pricing:write` | write | Actualizar precios y reglas de catálogo | superadmin, 4see_admin |
| **4see** | `4see:margins:manage` | manage | Crear y modificar reglas de margen de ganancia | superadmin, 4see_admin |

### 1.2 Catálogo de los 8 Roles del Sistema Basados en Módulos

1. **`superadmin` (Super Administrador):** Control global de infraestructura y todos los tenants (`*`).
2. **`tenant_admin` (Tenant Administrador):** Gobierno SaaS, alta/baja de tenants, cuotas y licencias modulares.
3. **`core_admin` (Core Administrador):** Gobierno de usuarios, asignación de roles, temas y auditoría interna.
4. **`kanban_admin` (Kanban Administrador):** Control logístico completo, ingesta de comprobantes PDF y asignación a operarios.
5. **`kanban_operator` (Kanban Operador):** Monitoreo de tablero logístico y despacho operativo de pedidos.
6. **`scanner_operator` (Scanner Operario):** Escaneo EAN-13 móvil en depósito y verificación de picking.
7. **`4see_admin` (4see Administrador):** Repricing dinámico, auditoría de catálogo y control de márgenes netos.
8. **`4see_user` (4see Usuario / Analista):** Consulta de competidores y catálogo en modo de solo lectura.

### 1.3 Roles Personalizados (Custom Roles)
Cada organización puede crear roles adicionales a medida a través del módulo Core (`/core`) combinando cualquier selección de permisos del catálogo canónico.

## 2. Catálogo Oficial de Planes SaaS y Facturación B2B (lib/billing.js)

La plataforma ofrece una estructura comercial de doble entrada: planes verticales especializados por producto (**Kanban** y **4see**) con cuotas desglosadas por rol, coexistiendo con los planes bundles consolidados para organizaciones globales.

### 2.1 Línea Vertical Logística: Planes Módulo Kanban (con Scanner EAN-13)
| Plan | Código | Módulos | Cuota Admins | Cuota Operarios | Usuarios Totales | Pedidos / Mes | Precio Mensual |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Kanban Simple** | `kanban_simple` | `core`, `kanban`, `scanner` | 1 Admin | 3 Operarios | 4 usuarios | 500 pedidos | $39 USD |
| **Kanban Business** | `kanban_business` | `core`, `kanban`, `scanner` | 3 Admins | 15 Operarios | 18 usuarios | 3.000 pedidos | $119 USD |
| **Kanban Enterprise** | `kanban_enterprise` | `core`, `kanban`, `scanner` | Ilimitado | Ilimitado | Ilimitado | Ilimitado | $299 USD |

### 2.2 Línea Vertical E-Commerce: Planes Módulo 4see (Inteligencia & Repricing)
| Plan | Código | Módulos | Cuota Admins | Cuota Analistas | Usuarios Totales | SKUs / Monitores | Precio Mensual |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **4see Simple** | `fourseee_simple` | `core`, `4see` | 1 Admin | 2 Analistas | 3 usuarios | 50 productos | $49 USD |
| **4see Business** | `fourseee_business` | `core`, `4see` | 2 Admins | 8 Analistas | 10 usuarios | 500 productos | $149 USD |
| **4see Enterprise** | `fourseee_enterprise` | `core`, `4see` | Ilimitado | Ilimitado | Ilimitado | Ilimitado | $349 USD |

### 2.3 Planes Bundles Consolidados Multi-Módulo (Catálogo General)
```javascript
const PLANS = {
  starter: {
    code: 'starter',
    name: 'Plan Starter Inicial',
    priceUsd: 49,
    maxUsers: 5,
    maxOrdersMonthly: 500,
    includedModules: ['core', 'kanban', 'scanner'],
    roleQuotas: { max_admins: 1, max_operators: 4, max_analysts: 0 },
    description: 'Ideal para depósitos pequeños o pilotos operativos.'
  },
  pro: {
    code: 'pro',
    name: 'Plan Pro Profesional',
    priceUsd: 149,
    maxUsers: 15,
    maxOrdersMonthly: 3000,
    includedModules: ['core', 'kanban', 'scanner', '4see'],
    roleQuotas: { max_admins: 3, max_operators: 12, max_analysts: 5 },
    description: 'Para centros de distribución y empresas medianas con inteligencia e-commerce.'
  },
  enterprise: {
    code: 'enterprise',
    name: 'Plan Enterprise Ilimitado',
    priceUsd: 499,
    maxUsers: 999,
    maxOrdersMonthly: 999999,
    includedModules: ['core', 'tenant', 'kanban', 'scanner', '4see'],
    roleQuotas: { max_admins: 999, max_operators: 999, max_analysts: 999 },
    description: 'Capacidad ilimitada, soporte prioritario y todos los módulos desbloqueados.'
  }
};
```

---

## 3. Estrategia de Diseño UX/UI y Sistema de Temas

### A. Jerarquía de Temas Visuales (Tenant vs Usuario)
1. **Scope Tenant (Nivel Empresa):** Tema base para toda la organización (`POST /api/theme` con `scope: 'tenant'`).
2. **Scope Usuario (Nivel Personal):** Preferencia personal de cada usuario (`POST /api/theme` con `scope: 'user'`).
3. **Resolución en Cascada:**
   `Preferencia de Usuario` $ightarrow$ `Tema Base del Tenant` $ightarrow$ `Omarchy Tiling WM (Default)`.

### B. Catálogo de Temas Disponibles:
- **Omarchy Tiling WM:** Dracula palette, bordes 2px solid, tipografía JetBrains Mono y logo Press Start 2P.
- **Omarchy Aetheria:** Acentos Teal y Violeta suave.
- **Dark Glassmorphism:** Fondos translúcidos con blur(12px) y acentos Esmeralda.
- **Cyberpunk Glassmorphism:** Alto contraste Neón.
- **Soft Minimal Pastel:** Colores pasteles y bordes suaves.

### C. Cero Alerts del Sistema:
Todos los modales y diálogos son componentes HTML/CSS customizados (`showCustomAlert`, `showCustomConfirm`).
