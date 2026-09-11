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

```javascript
const PLANS = {
  starter: {
    code: 'starter',
    name: 'Plan Starter Inicial',
    priceUsd: 49,
    maxUsers: 5,
    maxOrdersMonthly: 500,
    includedModules: ['core', 'kanban', 'scanner'],
    description: 'Ideal para depósitos pequeños o pilotos operativos.'
  },
  pro: {
    code: 'pro',
    name: 'Plan Pro Profesional',
    priceUsd: 149,
    maxUsers: 15,
    maxOrdersMonthly: 3000,
    includedModules: ['core', 'kanban', 'scanner', '4see'],
    description: 'Para centros de distribución y empresas medianas con inteligencia e-commerce.'
  },
  enterprise: {
    code: 'enterprise',
    name: 'Plan Enterprise Ilimitado',
    priceUsd: 499,
    maxUsers: 999,
    maxOrdersMonthly: 999999,
    includedModules: ['core', 'tenant', 'kanban', 'scanner', '4see'],
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
